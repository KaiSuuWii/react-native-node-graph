import {
  addVec2,
  boundsFromPoints,
  createFallbackTextMeasurer,
  isImageContent,
  isTextContent,
  vec2,
  type Bounds,
  type TextMeasurer,
  type Vec2
} from "@kaiisuuwii/shared";
import type {
  GraphEdgeSnapshot,
  GraphNodeSnapshot,
  GraphSnapshot,
  NodeTypeDefinition,
  Port
} from "@kaiisuuwii/core";

import type {
  CubicBezierCurve,
  EdgeRenderState,
  ImageContentItem,
  RenderEdgeLayout,
  RendererInteractionState,
  RenderNodeLevelOfDetail,
  RenderNodeLayout,
  RenderPortLayout,
  RendererTheme,
  SceneGroupItem
} from "./types.js";
import type { CachedImage, RendererImageCache } from "./image-cache.js";

const HEADER_LABEL_GAP = 18;
const GROUP_PADDING = 32;
const NODE_BODY_PADDING_X = 12;
const NODE_BODY_PADDING_Y = 10;
const NODE_TEXT_ITEM_GAP = 8;
const DEFAULT_MIN_BODY_HEIGHT = 48;

const intersectBounds = (left: Bounds, right: Bounds): Bounds => ({
  min: vec2(Math.max(left.min.x, right.min.x), Math.max(left.min.y, right.min.y)),
  max: vec2(Math.min(left.max.x, right.max.x), Math.min(left.max.y, right.max.y))
});

const clampOpacity = (opacity: number | undefined): number =>
  Math.max(0, Math.min(1, opacity ?? 1));

const resolveImageDimensions = (
  availableBodyWidth: number,
  theme: RendererTheme,
  content: ImageContentItem["content"],
  cachedImage: CachedImage | undefined
): Pick<ImageContentItem, "resolvedWidth" | "resolvedHeight"> => {
  if (content.width !== undefined && content.height !== undefined) {
    return {
      resolvedWidth: content.width,
      resolvedHeight: content.height
    };
  }

  const aspectRatio =
    cachedImage?.width !== undefined &&
    cachedImage.height !== undefined &&
    cachedImage.width > 0
      ? cachedImage.height / cachedImage.width
      : undefined;

  if (content.width !== undefined) {
    return {
      resolvedWidth: content.width,
      resolvedHeight:
        content.height ??
        (aspectRatio !== undefined
          ? content.width * aspectRatio
          : theme.image.defaultImageHeight)
    };
  }

  if (content.height !== undefined && aspectRatio !== undefined) {
    return {
      resolvedWidth: content.height / aspectRatio,
      resolvedHeight: content.height
    };
  }

  return {
    resolvedWidth: availableBodyWidth,
    resolvedHeight: content.height ?? theme.image.defaultImageHeight
  };
};

const splitPorts = (
  ports: readonly Port[]
): { readonly inputPorts: readonly Port[]; readonly outputPorts: readonly Port[] } => ({
  inputPorts: ports.filter((port) => port.direction === "input"),
  outputPorts: ports.filter((port) => port.direction === "output")
});

const createPortLayout = (
  port: Port,
  index: number,
  total: number,
  node: GraphNodeSnapshot,
  theme: RendererTheme
): RenderPortLayout => {
  const step = node.dimensions.y / (total + 1);
  const y = node.position.y + step * (index + 1);
  const x =
    port.direction === "input" ? node.position.x : node.position.x + node.dimensions.x;

  return {
    id: port.id,
    name: port.name,
    direction: port.direction,
    position: vec2(x, y),
    radius: theme.node.portRadius,
    color: theme.node.portColor,
    accessibilityLabel: `${node.label} ${port.direction} port ${port.name}`
  };
};

export const createNodeLayout = (
  node: GraphNodeSnapshot,
  theme: RendererTheme,
  options:
    | RenderNodeLevelOfDetail
    | {
        readonly lod?: RenderNodeLevelOfDetail;
        readonly measurer?: TextMeasurer;
        readonly interactionState?: RendererInteractionState;
        readonly resolveNodeType?: (type: string) => NodeTypeDefinition | undefined;
        readonly imageCache?: RendererImageCache;
      } = {
      zoom: 1,
      showLabel: true,
      showPorts: true,
      showDecorations: true
    }
): RenderNodeLayout => {
  const resolvedOptions =
    "zoom" in options
      ? { lod: options }
      : options;
  const lod = resolvedOptions.lod ?? {
    zoom: 1,
    showLabel: true,
    showPorts: true,
    showDecorations: true
  };
  const measurer = resolvedOptions.measurer ?? createFallbackTextMeasurer();
  const definition = resolvedOptions.resolveNodeType?.(node.type);
  const availableBodyWidth = Math.max(24, node.dimensions.x - NODE_BODY_PADDING_X * 2);
  const textContentItems: RenderNodeLayout["textContentItems"] = [];
  const imageContentItems: RenderNodeLayout["imageContentItems"] = [];
  let contentCursorY = node.position.y + theme.node.headerHeight + NODE_BODY_PADDING_Y;
  let totalContentHeight = 0;

  (definition?.textProperties ?? []).forEach((propertyKey) => {
    const value = node.properties[propertyKey];

    if (!isTextContent(value)) {
      return;
    }

    const fontSize = value.fontSize ?? theme.text.defaultFontSize;
    const lineHeight = value.lineHeight ?? theme.text.defaultLineHeight;
    const measureResult = measurer.measure({
      text: value.value,
      fontSize,
      fontWeight: value.fontWeight ?? "normal",
      fontStyle: value.fontStyle ?? "normal",
      maxWidth: availableBodyWidth,
      lineHeight,
      maxLines: value.maxLines
    });
    const itemBounds: Bounds = {
      min: vec2(node.position.x + NODE_BODY_PADDING_X, contentCursorY),
      max: vec2(
        node.position.x + NODE_BODY_PADDING_X + availableBodyWidth,
        contentCursorY + measureResult.totalHeight
      )
    };

    textContentItems.push({
      kind: "text-content",
      propertyKey,
      content: value,
      measuredLines: measureResult.lines,
      measuredHeight: measureResult.totalHeight,
      lineHeightPx: measureResult.lineHeightPx,
      truncated: measureResult.truncated,
      bounds: itemBounds,
      isEditing:
        resolvedOptions.interactionState?.editingNodeId === node.id &&
        resolvedOptions.interactionState?.editingPropertyKey === propertyKey
    });

    contentCursorY += measureResult.totalHeight + NODE_TEXT_ITEM_GAP;
    totalContentHeight += measureResult.totalHeight + NODE_TEXT_ITEM_GAP;
  });

  (definition?.imageProperties ?? []).forEach((propertyKey) => {
    const value = node.properties[propertyKey];

    if (!isImageContent(value)) {
      return;
    }

    const cachedImage = resolvedOptions.imageCache?.get(value.uri);
    const { resolvedWidth, resolvedHeight } = resolveImageDimensions(
      availableBodyWidth,
      theme,
      value,
      cachedImage
    );
    const bounds: Bounds = {
      min: vec2(node.position.x + NODE_BODY_PADDING_X, contentCursorY),
      max: vec2(
        node.position.x + NODE_BODY_PADDING_X + resolvedWidth,
        contentCursorY + resolvedHeight
      )
    };
    const nodeBodyBounds: Bounds = {
      min: vec2(node.position.x + NODE_BODY_PADDING_X, node.position.y + theme.node.headerHeight),
      max: vec2(
        node.position.x + node.dimensions.x - NODE_BODY_PADDING_X,
        node.position.y + node.dimensions.y - NODE_BODY_PADDING_Y
      )
    };

    imageContentItems.push({
      kind: "image-content",
      propertyKey,
      content: value,
      loadState: cachedImage?.state ?? "idle",
      skiaImage: cachedImage?.skiaImage,
      resolvedWidth,
      resolvedHeight,
      bounds,
      clipBounds: intersectBounds(bounds, nodeBodyBounds),
      opacity: clampOpacity(value.opacity)
    });

    contentCursorY += resolvedHeight + NODE_TEXT_ITEM_GAP;
    totalContentHeight += resolvedHeight + NODE_TEXT_ITEM_GAP;
  });

  if (textContentItems.length > 0 || imageContentItems.length > 0) {
    totalContentHeight = Math.max(0, totalContentHeight - NODE_TEXT_ITEM_GAP);
  }

  const minBodyHeight = Math.max(DEFAULT_MIN_BODY_HEIGHT, node.dimensions.y - theme.node.headerHeight);
  const resolvedBodyHeight =
    textContentItems.length === 0 && imageContentItems.length === 0
      ? minBodyHeight
      : Math.max(minBodyHeight, totalContentHeight + NODE_BODY_PADDING_Y * 2);
  const size = vec2(node.dimensions.x, theme.node.headerHeight + resolvedBodyHeight);
  const { inputPorts, outputPorts } = splitPorts(node.ports);
  const ports: RenderPortLayout[] = [];

  if (lod.showPorts) {
    inputPorts.forEach((port, index) => {
      ports.push(
        createPortLayout(
          port,
          index,
          inputPorts.length,
          {
            ...node,
            dimensions: size
          },
          theme
        )
      );
    });

    outputPorts.forEach((port, index) => {
      ports.push(
        createPortLayout(
          port,
          index,
          outputPorts.length,
          {
            ...node,
            dimensions: size
          },
          theme
        )
      );
    });
  }

  return {
    id: node.id,
    label: node.label,
    type: node.type,
    position: { ...node.position },
    size,
    headerHeight: theme.node.headerHeight,
    cornerRadius: theme.node.cornerRadius,
    bodyColor: theme.node.bodyColor,
    headerColor: theme.node.headerColor,
    borderColor: theme.node.borderColor,
    borderWidth: theme.node.borderWidth,
    labelColor: theme.node.labelColor,
    subLabelColor: theme.node.subLabelColor,
    ports,
    textContentItems,
    imageContentItems,
    autoHeight: size.y > node.dimensions.y,
    minBodyHeight,
    lod,
    pluginVisuals: [],
    accessibilityLabel: `${node.label} node of type ${node.type}`,
    accessibilityHint:
      ports.length > 0
        ? `Contains ${ports.length} port${ports.length === 1 ? "" : "s"} for graph connections.`
        : "Static node with no ports."
  };
};

export const getNodeBounds = (layout: RenderNodeLayout): Bounds => ({
  min: layout.position,
  max: addVec2(layout.position, layout.size)
});

export const getPortAnchor = (
  node: GraphNodeSnapshot,
  portId: string | undefined,
  direction: "input" | "output",
  theme: RendererTheme
): Vec2 => {
  const matchingPorts = node.ports.filter((port) => port.direction === direction);
  const targetIndex = matchingPorts.findIndex((port) => port.id === portId);
  const portIndex = targetIndex >= 0 ? targetIndex : 0;
  const fallbackPort = matchingPorts[portIndex];

  if (fallbackPort === undefined) {
    return vec2(
      direction === "input" ? node.position.x : node.position.x + node.dimensions.x,
      node.position.y + node.dimensions.y / 2
    );
  }

  return createPortLayout(fallbackPort, portIndex, matchingPorts.length, node, theme).position;
};

export const createBezierCurve = (start: Vec2, end: Vec2): CubicBezierCurve => {
  const deltaX = Math.max(48, Math.abs(end.x - start.x) * 0.5);

  return {
    start,
    control1: vec2(start.x + deltaX, start.y),
    control2: vec2(end.x - deltaX, end.y),
    end
  };
};

export const createSimplifiedBezierCurve = (start: Vec2, end: Vec2): CubicBezierCurve => ({
  start,
  control1: vec2(start.x + (end.x - start.x) / 3, start.y + (end.y - start.y) / 3),
  control2: vec2(start.x + ((end.x - start.x) * 2) / 3, start.y + ((end.y - start.y) * 2) / 3),
  end
});

export const createEdgeLayout = (
  edge: GraphEdgeSnapshot,
  snapshot: GraphSnapshot,
  theme: RendererTheme,
  state?: Partial<EdgeRenderState>,
  options?: {
    readonly simplified?: boolean;
  }
): RenderEdgeLayout | undefined => {
  const sourceNode = snapshot.nodes.find((node) => node.id === edge.source);
  const targetNode = snapshot.nodes.find((node) => node.id === edge.target);

  if (sourceNode === undefined || targetNode === undefined) {
    return undefined;
  }

  const selected = state?.selected ?? false;
  const invalid = state?.invalid ?? false;
  const start = getPortAnchor(sourceNode, edge.sourcePortId, "output", theme);
  const end = getPortAnchor(targetNode, edge.targetPortId, "input", theme);
  const simplified = options?.simplified ?? false;
  const curve = simplified ? createSimplifiedBezierCurve(start, end) : createBezierCurve(start, end);

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    curve,
    routePoints: simplified
      ? [curve.start, curve.end]
      : [curve.start, curve.control1, curve.control2, curve.end],
    width: theme.edge.width,
    color: invalid
      ? theme.edge.invalidColor
      : selected
        ? theme.edge.selectedColor
        : theme.edge.color,
    selected,
    invalid,
    simplified,
    pluginVisuals: [],
    accessibilityLabel: `Edge from ${sourceNode.label} to ${targetNode.label}`,
    accessibilityHint: invalid
      ? "Connection is currently invalid."
      : simplified
        ? "Connection is simplified at the current zoom level."
        : "Connection is interactive and can be inspected."
  };
};

export const createGroupLayout = (
  snapshot: GraphSnapshot,
  theme: RendererTheme
): readonly SceneGroupItem[] =>
  snapshot.groups.flatMap((group) => {
    const members = snapshot.nodes.filter((node) => group.nodeIds.includes(node.id));

    if (members.length === 0) {
      return [];
    }

    const memberBounds = boundsFromPoints(
      members.flatMap((node) => [
        node.position,
        addVec2(node.position, vec2(node.dimensions.x, node.dimensions.y))
      ])
    );

    return [
      {
        id: group.id,
        label: group.name,
        position: vec2(memberBounds.min.x - GROUP_PADDING, memberBounds.min.y - GROUP_PADDING),
        size: vec2(
          memberBounds.max.x - memberBounds.min.x + GROUP_PADDING * 2,
          memberBounds.max.y - memberBounds.min.y + GROUP_PADDING * 2 + HEADER_LABEL_GAP
        ),
        color: theme.groupColor,
        accessibilityLabel: `${group.name} group containing ${members.length} node${
          members.length === 1 ? "" : "s"
        }`
      }
    ];
  });
