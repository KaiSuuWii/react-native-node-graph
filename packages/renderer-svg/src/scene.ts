import type { GraphNodeSnapshot } from "@kaiisuuwii/core";
import { type Bounds } from "@kaiisuuwii/shared";

import { getSvgViewportBounds } from "./camera.js";
import {
  buildEdgeLayout,
  buildGroupLayouts,
  buildNodeLayout,
  createSvgEdgeElements,
  createSvgGridElements,
  createSvgGroupElements,
  createSvgNodeElements,
  getNodeBounds,
  isEdgeVisible,
  isNodeVisible
} from "./layout.js";
import { svgRect } from "./elements.js";
import type {
  SvgAccessibilityState,
  SvgBuildSceneOptions,
  SvgEdgeLayout,
  SvgElement,
  SvgLayer,
  SvgNodeLayout,
  SvgPluginContext,
  SvgPluginOverlay,
  SvgRenderPlan,
  SvgScenePluginContext
} from "./types.js";

const buildPluginLayer = (
  options: SvgBuildSceneOptions,
  nodeLayouts: readonly SvgNodeLayout[],
  edgeLayouts: readonly SvgEdgeLayout[]
): readonly SvgElement[] => {
  const context: SvgScenePluginContext = {
    snapshot: options.snapshot,
    viewport: options.viewport,
    camera: options.camera,
    theme: options.theme,
    nodes: nodeLayouts,
    edges: edgeLayouts
  };
  const overlays: SvgPluginOverlay[] = [];

  options.plugins.forEach((plugin) => {
    try {
      overlays.push(...(plugin.createOverlays?.(context) ?? []));
    } catch {
      // Plugin errors are isolated.
    }
  });

  return overlays.flatMap((overlay): SvgElement[] => {
    if (overlay.kind === "text" && overlay.position !== undefined) {
      return [
        {
          kind: "text",
          x: overlay.position.x,
          y: overlay.position.y,
          content: overlay.text ?? overlay.label,
          fontSize: 12,
          fontFamily: "system-ui, sans-serif",
          fill: overlay.color
        }
      ];
    }

    if (overlay.kind === "bounds" && overlay.bounds !== undefined) {
      const { min, max } = overlay.bounds;

      return [
        {
          kind: "rect",
          x: min.x,
          y: min.y,
          width: max.x - min.x,
          height: max.y - min.y,
          fill: "none",
          stroke: overlay.color,
          strokeWidth: 1,
          strokeDasharray: "4 2"
        }
      ];
    }

    if (overlay.kind === "path" && overlay.points !== undefined && overlay.points.length >= 2) {
      const [first, ...rest] = overlay.points;

      if (first === undefined) {
        return [];
      }

      const d = [`M ${first.x} ${first.y}`, ...rest.map((p) => `L ${p.x} ${p.y}`)].join(" ");

      return [
        {
          kind: "path",
          d,
          stroke: overlay.color,
          strokeWidth: 1,
          fill: "none"
        }
      ];
    }

    return [];
  });
};

const buildAccessibilityState = (
  nodeLayouts: readonly SvgNodeLayout[],
  options: SvgBuildSceneOptions
): SvgAccessibilityState => {
  const sorted = [...nodeLayouts].sort((a, b) =>
    a.position.y === b.position.y ? a.position.x - b.position.x : a.position.y - b.position.y
  );
  const focusOrder = sorted.map((n) => n.id);
  const labels: Record<string, string> = {};
  const titleById: Record<string, string> = {};

  nodeLayouts.forEach((layout) => {
    labels[layout.id] = layout.accessibilityLabel;

    if (options.accessibility.addTitleElements) {
      titleById[layout.id] = layout.accessibilityLabel;
    }

    layout.ports.forEach((port) => {
      labels[port.id] = `${layout.label} ${port.direction} port ${port.name}`;
    });
  });

  options.snapshot.groups.forEach((group) => {
    labels[group.id] = `${group.name} group`;
  });

  return { focusOrder, labels, titleById };
};

export const buildSvgRenderScene = (options: SvgBuildSceneOptions): SvgRenderPlan => {
  const startMs = Date.now();
  const viewportPadding = options.virtualization.enabled
    ? options.viewport.width * (options.virtualization.viewportPaddingFactor - 1) * 0.5
    : 0;
  const viewportBounds: Bounds = getSvgViewportBounds(
    options.viewport,
    options.camera,
    viewportPadding
  );

  const pluginContext: SvgPluginContext = {
    snapshot: options.snapshot,
    viewport: options.viewport,
    camera: options.camera,
    theme: options.theme
  };

  const visibleNodeSnapshots = options.snapshot.nodes.filter((node: GraphNodeSnapshot) => {
    if (!options.virtualization.enabled || !options.virtualization.cullOffscreenNodes) {
      return true;
    }

    const isSelected = options.snapshot.selection.nodeIds.includes(node.id);

    return isSelected || isNodeVisible(node, viewportBounds);
  });

  const nodeLayouts: SvgNodeLayout[] = visibleNodeSnapshots.map((node) => {
    const isSelected = options.snapshot.selection.nodeIds.includes(node.id);
    let layout = buildNodeLayout(node, options.theme, isSelected, {
      ...(options.resolveNodeType !== undefined
        ? { resolveNodeType: options.resolveNodeType }
        : {}),
      ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
      ...(options.resolveImageState !== undefined
        ? { resolveImageState: options.resolveImageState }
        : {})
    });

    options.plugins.forEach((plugin) => {
      try {
        layout = plugin.decorateNodeLayout?.(layout, pluginContext) ?? layout;
      } catch {
        // Plugin errors are isolated.
      }
    });

    return layout;
  });

  const visibleNodeIdSet = new Set(visibleNodeSnapshots.map((n) => n.id));

  const edgeLayouts: SvgEdgeLayout[] = options.snapshot.edges.flatMap((edge) => {
    const isSelected = options.snapshot.selection.edgeIds.includes(edge.id);
    const layout = buildEdgeLayout(edge, options.snapshot, options.theme, isSelected);

    if (layout === undefined) {
      return [];
    }

    let decorated = layout;

    options.plugins.forEach((plugin) => {
      try {
        decorated = plugin.decorateEdgeLayout?.(decorated, pluginContext) ?? decorated;
      } catch {
        // Plugin errors are isolated.
      }
    });

    if (!options.virtualization.enabled || !options.virtualization.cullOffscreenEdges) {
      return [decorated];
    }

    const isSelectedEdge = options.snapshot.selection.edgeIds.includes(edge.id);

    return isSelectedEdge || isEdgeVisible(decorated, visibleNodeIdSet, viewportBounds)
      ? [decorated]
      : [];
  });

  const groupLayouts = buildGroupLayouts(options.snapshot);
  const pluginElements = buildPluginLayer(options, nodeLayouts, edgeLayouts);
  const accessibility = buildAccessibilityState(nodeLayouts, options);

  const vb = options.camera;
  const w = options.viewport.width / vb.zoom;
  const h = options.viewport.height / vb.zoom;
  const bgRect = svgRect({
    x: vb.position.x,
    y: vb.position.y,
    width: w,
    height: h,
    fill: options.theme.backgroundColor
  });

  const layers: SvgLayer[] = [
    {
      kind: "background",
      elements: [bgRect]
    },
    {
      kind: "grid",
      elements: createSvgGridElements(options.viewport, options.camera, options.theme)
    },
    {
      kind: "group",
      elements: groupLayouts.flatMap((g) => createSvgGroupElements(g, options.theme))
    },
    {
      kind: "edge",
      elements: edgeLayouts.flatMap((layout) => createSvgEdgeElements(layout, options.theme))
    },
    {
      kind: "node",
      elements: nodeLayouts.flatMap((layout) =>
        createSvgNodeElements(layout, options.theme, options.accessibility)
      )
    },
    {
      kind: "selection",
      elements: nodeLayouts
        .filter((layout) => layout.selected)
        .map((layout) => {
          const bounds = getNodeBounds(layout);

          return svgRect({
            x: bounds.min.x - 6,
            y: bounds.min.y - 6,
            width: bounds.max.x - bounds.min.x + 12,
            height: bounds.max.y - bounds.min.y + 12,
            rx: layout.cornerRadius + 4,
            ry: layout.cornerRadius + 4,
            fill: "none",
            stroke: options.theme.selectionColor,
            strokeWidth: options.theme.selectionWidth,
            strokeDasharray: "6 3"
          });
        })
    },
    {
      kind: "plugin",
      elements: pluginElements
    },
    {
      kind: "debug",
      elements: []
    }
  ];

  const totalNodeCount = options.snapshot.nodes.length;
  const visibleNodeCount = nodeLayouts.length;
  const buildDurationMs = Date.now() - startMs;

  const viewBox = `${options.camera.position.x} ${options.camera.position.y} ${w} ${h}`;

  const defs: SvgElement[] = [];

  return {
    viewBox,
    width: options.viewport.width,
    height: options.viewport.height,
    defs,
    layers,
    accessibility,
    diagnostics: {
      visibleNodeCount,
      culledNodeCount: totalNodeCount - visibleNodeCount,
      buildDurationMs
    }
  };
};
