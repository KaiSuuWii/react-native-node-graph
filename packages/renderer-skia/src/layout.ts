import { addVec2, boundsFromPoints, vec2, type Bounds, type Vec2 } from "@kaiisuuwii/shared";
import type { GraphEdgeSnapshot, GraphNodeSnapshot, GraphSnapshot, Port } from "@kaiisuuwii/core";

import type {
  CubicBezierCurve,
  EdgeRenderState,
  RenderEdgeLayout,
  RenderNodeLevelOfDetail,
  RenderNodeLayout,
  RenderPortLayout,
  RendererTheme,
  SceneGroupItem
} from "./types.js";

const HEADER_LABEL_GAP = 18;
const GROUP_PADDING = 32;

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
  lod: RenderNodeLevelOfDetail = {
    zoom: 1,
    showLabel: true,
    showPorts: true,
    showDecorations: true
  }
): RenderNodeLayout => {
  const { inputPorts, outputPorts } = splitPorts(node.ports);
  const ports: RenderPortLayout[] = [];

  if (lod.showPorts) {
    inputPorts.forEach((port, index) => {
      ports.push(createPortLayout(port, index, inputPorts.length, node, theme));
    });

    outputPorts.forEach((port, index) => {
      ports.push(createPortLayout(port, index, outputPorts.length, node, theme));
    });
  }

  return {
    id: node.id,
    label: node.label,
    type: node.type,
    position: { ...node.position },
    size: { ...node.dimensions },
    headerHeight: theme.node.headerHeight,
    cornerRadius: theme.node.cornerRadius,
    bodyColor: theme.node.bodyColor,
    headerColor: theme.node.headerColor,
    borderColor: theme.node.borderColor,
    borderWidth: theme.node.borderWidth,
    labelColor: theme.node.labelColor,
    subLabelColor: theme.node.subLabelColor,
    ports,
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
