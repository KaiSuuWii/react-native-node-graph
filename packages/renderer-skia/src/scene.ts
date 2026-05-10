import type { GraphSnapshot } from "@react-native-node-graph/core";
import { addVec2, vec2 } from "@react-native-node-graph/shared";

import { createEdgeLayout, createGroupLayout, createNodeLayout } from "./layout.js";
import type {
  BuildSceneOptions,
  RenderConnectionPreview,
  RenderEdgeLayout,
  RenderNodeLayout,
  SceneGroupItem,
  SceneGridLayer,
  SceneInteractionLayer,
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
  edgeLayouts: readonly RenderEdgeLayout[],
  nodeLayouts: readonly RenderNodeLayout[],
  groupItems: readonly SceneGroupItem[],
  selectionColor: string,
  selectionWidth: number
): SceneSelectionLayer => ({
  kind: "selection",
  items: [
    ...nodeLayouts.flatMap((layout) =>
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
    ),
    ...edgeLayouts.flatMap((layout) =>
      snapshot.selection.edgeIds.includes(layout.id)
        ? [
            {
              targetId: layout.id,
              position: vec2(
                Math.min(layout.curve.start.x, layout.curve.end.x) - 6,
                Math.min(layout.curve.start.y, layout.curve.end.y) - 6
              ),
              size: vec2(
                Math.abs(layout.curve.end.x - layout.curve.start.x) + 12,
                Math.abs(layout.curve.end.y - layout.curve.start.y) + 12
              ),
              color: selectionColor,
              width: selectionWidth
            }
          ]
        : []
    ),
    ...groupItems.flatMap((group) =>
      snapshot.selection.groupIds.includes(group.id)
        ? [
            {
              targetId: group.id,
              position: addVec2(group.position, vec2(-8, -8)),
              size: vec2(group.size.x + 16, group.size.y + 16),
              color: selectionColor,
              width: selectionWidth
            }
          ]
        : []
    )
  ] satisfies SelectionHighlight[]
});

const createInteractionLayer = (options: BuildSceneOptions): SceneInteractionLayer => {
  const connectionPreview = options.interactionState?.connectionPreview;
  const marqueeSelection = options.interactionState?.marqueeSelection;

  const renderedPreview: RenderConnectionPreview | undefined =
    connectionPreview === undefined
      ? undefined
      : {
          sourceNodeId: connectionPreview.sourceNodeId,
          sourcePortId: connectionPreview.sourcePortId,
          sourcePosition: connectionPreview.sourcePosition,
          targetPosition: connectionPreview.currentPosition,
          ...(connectionPreview.targetNodeId !== undefined
            ? { targetNodeId: connectionPreview.targetNodeId }
            : {}),
          ...(connectionPreview.targetPortId !== undefined
            ? { targetPortId: connectionPreview.targetPortId }
            : {}),
          valid: connectionPreview.valid
        };

  return {
    kind: "interaction",
    ...(renderedPreview !== undefined ? { connectionPreview: renderedPreview } : {}),
    ...(marqueeSelection !== undefined
      ? {
          marqueeSelection: {
            bounds: {
              min: vec2(
                Math.min(marqueeSelection.start.x, marqueeSelection.current.x),
                Math.min(marqueeSelection.start.y, marqueeSelection.current.y)
              ),
              max: vec2(
                Math.max(marqueeSelection.start.x, marqueeSelection.current.x),
                Math.max(marqueeSelection.start.y, marqueeSelection.current.y)
              )
            },
            mode: marqueeSelection.mode
          }
        }
      : {})
  };
};

export const buildSkiaRenderScene = (options: BuildSceneOptions): SkiaRenderScene => {
  const nodeLayouts = options.snapshot.nodes.map((node) => createNodeLayout(node, options.theme));
  const groupItems = createGroupLayout(options.snapshot, options.theme);
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
      items: groupItems
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
      edgeLayouts,
      nodeLayouts,
      groupItems,
      options.theme.selection.color,
      options.theme.selection.width
    ),
    createInteractionLayer(options),
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
