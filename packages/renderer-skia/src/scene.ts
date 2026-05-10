import type { GraphSnapshot } from "@react-native-node-graph/core";
import { addVec2, vec2 } from "@react-native-node-graph/shared";

import { createEdgeLayout, createGroupLayout, createNodeLayout } from "./layout.js";
import type {
  BuildSceneOptions,
  RenderNodeLayout,
  SceneGridLayer,
  SceneLayer,
  SceneSelectionLayer,
  SelectionHighlight,
  SkiaRenderScene
} from "./types.js";

const createGridLayer = ({
  viewport,
  camera,
  theme
}: Pick<BuildSceneOptions, "viewport" | "camera" | "theme">): SceneGridLayer => {
  if (!theme.grid.visible) {
    return {
      kind: "grid",
      lines: [],
      color: theme.grid.color,
      majorColor: theme.grid.majorColor
    };
  }

  const spacing = theme.grid.spacing;
  const majorSpacing = spacing * theme.grid.majorSpacingMultiplier;
  const graphMinX = camera.position.x;
  const graphMinY = camera.position.y;
  const graphMaxX = camera.position.x + viewport.width / camera.zoom;
  const graphMaxY = camera.position.y + viewport.height / camera.zoom;
  const startX = Math.floor(graphMinX / spacing) * spacing;
  const startY = Math.floor(graphMinY / spacing) * spacing;
  const lines: Array<SceneGridLayer["lines"][number]> = [];

  for (let x = startX; x <= graphMaxX; x += spacing) {
    const major = Math.round(x / majorSpacing) * majorSpacing === x;
    lines.push({
      from: vec2(x, graphMinY),
      to: vec2(x, graphMaxY),
      major
    });
  }

  for (let y = startY; y <= graphMaxY; y += spacing) {
    const major = Math.round(y / majorSpacing) * majorSpacing === y;
    lines.push({
      from: vec2(graphMinX, y),
      to: vec2(graphMaxX, y),
      major
    });
  }

  return {
    kind: "grid",
    lines,
    color: theme.grid.color,
    majorColor: theme.grid.majorColor
  };
};

const createSelectionLayer = (
  snapshot: GraphSnapshot,
  nodeLayouts: readonly RenderNodeLayout[],
  selectionColor: string,
  selectionWidth: number
): SceneSelectionLayer => {
  const items: SelectionHighlight[] = nodeLayouts.flatMap((layout) =>
    snapshot.selection.nodeIds.includes(layout.id)
      ? [
          {
            targetId: layout.id,
            position: addVec2(layout.position, vec2(-6, -6)),
            size: vec2(layout.size.x + 12, layout.size.y + 12),
            color: selectionColor,
            width: selectionWidth
          }
        ]
      : []
  );

  return {
    kind: "selection",
    items
  };
};

export const buildSkiaRenderScene = (options: BuildSceneOptions): SkiaRenderScene => {
  const nodeLayouts = options.snapshot.nodes.map((node) => createNodeLayout(node, options.theme));
  const edgeLayouts = options.snapshot.edges.flatMap((edge) => {
    const isSelected = options.snapshot.selection.edgeIds.includes(edge.id);
    const isInvalid = edge.source === edge.target;
    const layout = createEdgeLayout(edge, options.snapshot, options.theme, {
      selected: isSelected,
      invalid: isInvalid
    });

    return layout === undefined ? [] : [layout];
  });
  const layers: SceneLayer[] = [
    {
      kind: "background",
      color: options.theme.backgroundColor
    },
    createGridLayer(options),
    {
      kind: "group",
      items: createGroupLayout(options.snapshot, options.theme)
    },
    {
      kind: "edge",
      items: edgeLayouts
    },
    {
      kind: "node",
      items: nodeLayouts
    },
    createSelectionLayer(
      options.snapshot,
      nodeLayouts,
      options.theme.selection.color,
      options.theme.selection.width
    ),
    {
      kind: "debug",
      enabled: false,
      messages: [`plugins:${options.plugins.length}`, `zoom:${options.camera.zoom.toFixed(2)}`],
      color: options.theme.debugColor
    }
  ];

  return {
    snapshot: options.snapshot,
    camera: options.camera,
    viewport: options.viewport,
    layers,
    interaction: options.interaction,
    theme: options.theme,
    plugins: options.plugins,
    interactionOptions: options.interactionOptions
  };
};
