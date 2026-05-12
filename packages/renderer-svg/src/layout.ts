import type {
  GraphEdgeSnapshot,
  GraphNodeSnapshot,
  GraphSnapshot,
  Port
} from "@kaiisuuwii/core";
import { addVec2, boundsFromPoints, vec2, type Bounds, type Vec2 } from "@kaiisuuwii/shared";

import { bezierPathD, svgCircle, svgGroup, svgPath, svgRect, svgText } from "./elements.js";
import type {
  CameraState,
  RendererViewport,
  SvgAccessibilityOptions,
  SvgCubicBezierCurve,
  SvgEdgeLayout,
  SvgElement,
  SvgGroupLayout,
  SvgNodeLayout,
  SvgPortLayout,
  SvgTheme
} from "./types.js";

const NODE_HEADER_HEIGHT = 28;
const NODE_CORNER_RADIUS = 6;
const GROUP_PADDING = 32;
const HEADER_LABEL_GAP = 18;

const buildPortPosition = (
  port: Port,
  index: number,
  total: number,
  node: GraphNodeSnapshot
): Vec2 => {
  const step = node.dimensions.y / (total + 1);
  const y = node.position.y + step * (index + 1);
  const x =
    port.direction === "input" ? node.position.x : node.position.x + node.dimensions.x;

  return vec2(x, y);
};

export const getPortAnchor = (
  node: GraphNodeSnapshot,
  portId: string | undefined,
  direction: "input" | "output"
): Vec2 => {
  const matching = node.ports.filter((p) => p.direction === direction);
  const idx = matching.findIndex((p) => p.id === portId);
  const portIndex = idx >= 0 ? idx : 0;
  const port = matching[portIndex];

  if (port === undefined) {
    return vec2(
      direction === "input" ? node.position.x : node.position.x + node.dimensions.x,
      node.position.y + node.dimensions.y / 2
    );
  }

  return buildPortPosition(port, portIndex, matching.length, node);
};

export const buildNodeLayout = (
  node: GraphNodeSnapshot,
  theme: SvgTheme,
  selected: boolean
): SvgNodeLayout => {
  const inputPorts = node.ports.filter((p) => p.direction === "input");
  const outputPorts = node.ports.filter((p) => p.direction === "output");
  const ports: SvgPortLayout[] = [];

  inputPorts.forEach((port, index) => {
    ports.push({
      id: port.id,
      name: port.name,
      direction: "input",
      position: buildPortPosition(port, index, inputPorts.length, node),
      radius: theme.portRadius,
      color: theme.portColor
    });
  });

  outputPorts.forEach((port, index) => {
    ports.push({
      id: port.id,
      name: port.name,
      direction: "output",
      position: buildPortPosition(port, index, outputPorts.length, node),
      radius: theme.portRadius,
      color: theme.portColor
    });
  });

  return {
    id: node.id,
    label: node.label,
    type: node.type,
    position: { ...node.position },
    size: { ...node.dimensions },
    headerHeight: NODE_HEADER_HEIGHT,
    cornerRadius: NODE_CORNER_RADIUS,
    bodyColor: theme.nodeBodyColor,
    headerColor: theme.nodeHeaderColor,
    borderColor: theme.nodeBorderColor,
    borderWidth: theme.nodeBorderWidth,
    labelColor: theme.nodeHeaderTextColor,
    ports,
    selected,
    invalid: false,
    pluginVisuals: [],
    accessibilityLabel: `${node.label} node of type ${node.type}`
  };
};

export const buildBezierCurve = (start: Vec2, end: Vec2): SvgCubicBezierCurve => {
  const deltaX = Math.max(48, Math.abs(end.x - start.x) * 0.5);

  return {
    start,
    control1: vec2(start.x + deltaX, start.y),
    control2: vec2(end.x - deltaX, end.y),
    end
  };
};

export const buildEdgeLayout = (
  edge: GraphEdgeSnapshot,
  snapshot: GraphSnapshot,
  theme: SvgTheme,
  selected: boolean
): SvgEdgeLayout | undefined => {
  const sourceNode = snapshot.nodes.find((n) => n.id === edge.source);
  const targetNode = snapshot.nodes.find((n) => n.id === edge.target);

  if (sourceNode === undefined || targetNode === undefined) {
    return undefined;
  }

  const invalid = edge.source === edge.target;
  const start = getPortAnchor(sourceNode, edge.sourcePortId, "output");
  const end = getPortAnchor(targetNode, edge.targetPortId, "input");

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    curve: buildBezierCurve(start, end),
    width: theme.edgeWidth,
    color: invalid
      ? "#b4493f"
      : selected
        ? theme.edgeSelectedColor
        : theme.edgeColor,
    selected,
    invalid,
    pluginVisuals: [],
    accessibilityLabel: `Edge from ${sourceNode.label} to ${targetNode.label}`
  };
};

export const buildGroupLayouts = (
  snapshot: GraphSnapshot
): readonly SvgGroupLayout[] =>
  snapshot.groups.flatMap((group) => {
    const members = snapshot.nodes.filter((n) => group.nodeIds.includes(n.id));

    if (members.length === 0) {
      return [];
    }

    const memberBounds = boundsFromPoints(
      members.flatMap((n) => [
        n.position,
        addVec2(n.position, vec2(n.dimensions.x, n.dimensions.y))
      ])
    );

    return [
      {
        id: group.id,
        label: group.name,
        position: vec2(
          memberBounds.min.x - GROUP_PADDING,
          memberBounds.min.y - GROUP_PADDING
        ),
        size: vec2(
          memberBounds.max.x - memberBounds.min.x + GROUP_PADDING * 2,
          memberBounds.max.y - memberBounds.min.y + GROUP_PADDING * 2 + HEADER_LABEL_GAP
        ),
        color: "rgba(63, 94, 88, 0.10)"
      }
    ];
  });

const boundsIntersect = (a: Bounds, b: Bounds): boolean =>
  a.min.x <= b.max.x &&
  a.max.x >= b.min.x &&
  a.min.y <= b.max.y &&
  a.max.y >= b.min.y;

export const getNodeBounds = (layout: SvgNodeLayout): Bounds => ({
  min: layout.position,
  max: addVec2(layout.position, layout.size)
});

const getCurveBounds = (curve: SvgCubicBezierCurve, padding = 0): Bounds => ({
  min: vec2(
    Math.min(curve.start.x, curve.control1.x, curve.control2.x, curve.end.x) - padding,
    Math.min(curve.start.y, curve.control1.y, curve.control2.y, curve.end.y) - padding
  ),
  max: vec2(
    Math.max(curve.start.x, curve.control1.x, curve.control2.x, curve.end.x) + padding,
    Math.max(curve.start.y, curve.control1.y, curve.control2.y, curve.end.y) + padding
  )
});

export const isNodeVisible = (node: GraphNodeSnapshot, viewportBounds: Bounds): boolean =>
  boundsIntersect(
    { min: node.position, max: addVec2(node.position, vec2(node.dimensions.x, node.dimensions.y)) },
    viewportBounds
  );

export const isEdgeVisible = (
  layout: SvgEdgeLayout,
  visibleNodeIds: ReadonlySet<string>,
  viewportBounds: Bounds
): boolean =>
  visibleNodeIds.has(layout.source) ||
  visibleNodeIds.has(layout.target) ||
  boundsIntersect(getCurveBounds(layout.curve, 8), viewportBounds);

export const createSvgNodeElements = (
  layout: SvgNodeLayout,
  theme: SvgTheme,
  acc: SvgAccessibilityOptions
): readonly SvgElement[] => {
  const { position: pos, size, cornerRadius, bodyColor, headerColor, borderColor, borderWidth, headerHeight } = layout;
  const elements: SvgElement[] = [];

  const titleId = `title-${layout.id}`;
  const groupChildren: SvgElement[] = [];

  if (acc.addTitleElements) {
    groupChildren.push(svgRect({
      x: pos.x,
      y: pos.y,
      width: size.x,
      height: size.y,
      fill: "transparent",
      id: titleId
    }));
  }

  groupChildren.push(svgRect({
    x: pos.x,
    y: pos.y,
    width: size.x,
    height: size.y,
    rx: cornerRadius,
    ry: cornerRadius,
    fill: bodyColor,
    stroke: borderColor,
    strokeWidth: borderWidth
  }));

  groupChildren.push(svgRect({
    x: pos.x,
    y: pos.y,
    width: size.x,
    height: headerHeight,
    rx: cornerRadius,
    ry: cornerRadius,
    fill: headerColor,
    stroke: borderColor,
    strokeWidth: borderWidth
  }));

  groupChildren.push(svgRect({
    x: pos.x,
    y: pos.y + cornerRadius,
    width: size.x,
    height: headerHeight - cornerRadius,
    fill: headerColor
  }));

  groupChildren.push(svgText(
    pos.x + size.x / 2,
    pos.y + headerHeight / 2,
    layout.label,
    {
      fontSize: theme.nodeLabelFontSize,
      fontFamily: theme.nodeFontFamily,
      fill: layout.labelColor,
      textAnchor: "middle",
      dominantBaseline: "central"
    }
  ));

  layout.ports.forEach((port) => {
    groupChildren.push(svgCircle({
      cx: port.position.x,
      cy: port.position.y,
      r: port.radius,
      fill: port.color,
      stroke: borderColor,
      strokeWidth: 1
    }));

    groupChildren.push(svgText(
      port.direction === "input"
        ? port.position.x + port.radius + 3
        : port.position.x - port.radius - 3,
      port.position.y,
      port.name,
      {
        fontSize: theme.portLabelFontSize,
        fontFamily: theme.nodeFontFamily,
        fill: layout.labelColor,
        textAnchor: port.direction === "input" ? "start" : "end",
        dominantBaseline: "central"
      }
    ));
  });

  layout.pluginVisuals.forEach((visual) => {
    if (visual.kind === "badge") {
      groupChildren.push(svgRect({
        x: pos.x + size.x - 48,
        y: pos.y + headerHeight + 4,
        width: 44,
        height: 16,
        rx: 4,
        fill: visual.color
      }));
      groupChildren.push(svgText(
        pos.x + size.x - 26,
        pos.y + headerHeight + 12,
        visual.label,
        {
          fontSize: 10,
          fontFamily: theme.nodeFontFamily,
          fill: "#ffffff",
          textAnchor: "middle",
          dominantBaseline: "central"
        }
      ));
    }
  });

  elements.push(svgGroup(groupChildren, {
    ...(acc.addRoleAttributes ? { role: "img" } : {}),
    ...(acc.addAriaLabels ? { ariaLabel: layout.accessibilityLabel } : {})
  }));

  return elements;
};

export const createSvgEdgeElements = (
  layout: SvgEdgeLayout,
  theme: SvgTheme
): readonly SvgElement[] => {
  const elements: SvgElement[] = [];

  if (layout.selected) {
    elements.push(svgPath({
      d: bezierPathD(layout.curve),
      stroke: theme.selectionColor,
      strokeWidth: layout.width + 4,
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: 0.4
    }));
  }

  elements.push(svgPath({
    d: bezierPathD(layout.curve),
    stroke: layout.color,
    strokeWidth: layout.width,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    markerEnd: "url(#svg-arrowhead)"
  }));

  layout.pluginVisuals.forEach((visual) => {
    if (visual.kind === "label") {
      elements.push(svgText(
        visual.position.x,
        visual.position.y,
        visual.label,
        {
          fontSize: 11,
          fontFamily: "system-ui, sans-serif",
          fill: visual.color,
          textAnchor: "middle",
          dominantBaseline: "central"
        }
      ));
    }
  });

  return elements;
};

export const createSvgGroupElements = (
  group: SvgGroupLayout,
  theme: SvgTheme
): readonly SvgElement[] => {
  const labelFontSize = theme.nodeLabelFontSize;

  return [
    svgRect({
      x: group.position.x,
      y: group.position.y,
      width: group.size.x,
      height: group.size.y,
      rx: 8,
      ry: 8,
      fill: theme.groupFillColor,
      stroke: theme.groupBorderColor,
      strokeWidth: theme.groupBorderWidth,
      strokeDasharray: "6 4"
    }),
    svgText(
      group.position.x + 12,
      group.position.y + 12,
      group.label,
      {
        fontSize: labelFontSize,
        fontFamily: "system-ui, sans-serif",
        fill: theme.groupBorderColor,
        dominantBaseline: "hanging"
      }
    )
  ];
};

export const createSvgGridElements = (
  viewport: RendererViewport,
  camera: CameraState,
  theme: SvgTheme
): readonly SvgElement[] => {
  if (camera.zoom < 0.3) {
    return [];
  }

  const spacing = theme.gridSpacing;
  const graphMinX = camera.position.x;
  const graphMinY = camera.position.y;
  const graphMaxX = camera.position.x + viewport.width / camera.zoom;
  const graphMaxY = camera.position.y + viewport.height / camera.zoom;
  const startX = Math.floor(graphMinX / spacing) * spacing;
  const startY = Math.floor(graphMinY / spacing) * spacing;
  const elements: SvgElement[] = [];

  for (let x = startX; x <= graphMaxX; x += spacing) {
    elements.push(svgPath({
      d: `M ${x} ${graphMinY} L ${x} ${graphMaxY}`,
      stroke: theme.gridColor,
      strokeWidth: 1,
      fill: "none"
    }));
  }

  for (let y = startY; y <= graphMaxY; y += spacing) {
    elements.push(svgPath({
      d: `M ${graphMinX} ${y} L ${graphMaxX} ${y}`,
      stroke: theme.gridColor,
      strokeWidth: 1,
      fill: "none"
    }));
  }

  return elements;
};
