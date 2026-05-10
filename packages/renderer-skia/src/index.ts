import type { GraphInteractionContract, GraphSnapshot } from "@react-native-node-graph/core";
import type { GraphInteractionEventPayload } from "@react-native-node-graph/shared";
import { createCameraState } from "./camera.js";
import { createGraphEditor } from "./editor.js";
import {
  boundsIntersect,
  buildSceneSpatialIndex,
  hitTestSceneBounds,
  hitTestScenePoint,
  isPointInBounds
} from "./hit-testing.js";
import { createSpatialIndex } from "./spatial-index.js";
import { buildSkiaRenderScene } from "./scene.js";
import { resolveInteractionOptions, resolveRendererTheme } from "./theme.js";
import type {
  BuildSceneOptions,
  NodeGraphRendererProps,
  RendererInteractionOptions,
  RendererPluginPlaceholder,
  RendererTheme,
  SkiaRenderPlan
} from "./types.js";

export const createSkiaRenderPlan = (
  snapshotOrProps: GraphSnapshot | NodeGraphRendererProps,
  interaction?: GraphInteractionContract
): SkiaRenderPlan => {
  const props = isRendererProps(snapshotOrProps)
    ? snapshotOrProps
    : {
        snapshot: snapshotOrProps,
        interaction: interaction ?? { onEvent: () => undefined },
        viewport: { width: 1280, height: 720 }
      };
  const theme = resolveRendererTheme(props.theme);
  const interactionOptions = resolveInteractionOptions(props.interactionOptions);
  const sceneOptions: BuildSceneOptions = {
    snapshot: props.snapshot,
    viewport: props.viewport,
    camera: createCameraState(props.camera),
    theme,
    plugins: props.plugins ?? [],
    interaction: props.interaction,
    interactionOptions,
    ...(props.interactionState !== undefined ? { interactionState: props.interactionState } : {})
  };
  const scene = buildSkiaRenderScene(sceneOptions);
  const nodeLayer = scene.layers.find((layer) => layer.kind === "node");
  const edgeLayer = scene.layers.find((layer) => layer.kind === "edge");

  return {
    scene,
    nodes: nodeLayer?.kind === "node" ? nodeLayer.items : [],
    edges: edgeLayer?.kind === "edge" ? edgeLayer.items : [],
    interaction: props.interaction
  };
};

export const forwardInteractionEvent = (
  interaction: GraphInteractionContract,
  payload: GraphInteractionEventPayload
): void => {
  interaction.onEvent(payload);
};

const isRendererProps = (
  input: GraphSnapshot | NodeGraphRendererProps
): input is NodeGraphRendererProps => "snapshot" in input;

export { DEFAULT_CAMERA_STATE, clampZoom, createCameraState, graphToScreenSpace, panCamera, screenToGraphSpace, zoomCameraAtScreenPoint } from "./camera.js";
export { createGraphEditor } from "./editor.js";
export { boundsIntersect, buildSceneSpatialIndex, hitTestSceneBounds, hitTestScenePoint, isPointInBounds } from "./hit-testing.js";
export { createBezierCurve, createEdgeLayout, createGroupLayout, createNodeLayout, getNodeBounds, getPortAnchor } from "./layout.js";
export { buildSkiaRenderScene } from "./scene.js";
export { createSpatialIndex } from "./spatial-index.js";
export { DEFAULT_INTERACTION_OPTIONS, DEFAULT_RENDERER_THEME, resolveInteractionOptions, resolveRendererTheme } from "./theme.js";
export type {
  BuildSceneOptions,
  CameraState,
  CameraVelocity,
  ConnectionPreviewState,
  CreateGraphEditorOptions,
  CubicBezierCurve,
  EdgeRenderState,
  EdgeSpatialIndexEntry,
  GraphEditor,
  GroupSpatialIndexEntry,
  HitTestResult,
  HitTestTarget,
  MarqueeSelectionState,
  NodeGraphRendererProps,
  NodeSpatialIndexEntry,
  PortSpatialIndexEntry,
  RenderConnectionPreview,
  RenderEdgeLayout,
  RenderMarqueeSelection,
  RenderNodeLayout,
  RenderPortLayout,
  RendererEdgeSnapshot,
  RendererGridTheme,
  RendererInteractionOptions,
  RendererInteractionState,
  RendererNodeSnapshot,
  RendererNodeTheme,
  RendererPluginPlaceholder,
  RendererSelectionTheme,
  RendererTheme,
  RendererViewport,
  SceneBackgroundLayer,
  SceneDebugLayer,
  SceneEdgeLayer,
  SceneGridLayer,
  SceneInteractionLayer,
  SceneGroupItem,
  SceneGroupLayer,
  SceneLayer,
  SceneLayerKind,
  SceneNodeLayer,
  SceneSelectionLayer,
  SelectionHighlight,
  SkiaRenderPlan,
  SkiaRenderScene,
  SpatialIndex,
  SpatialIndexEntry,
  SpatialIndexEntryKind,
  StaticGraphExampleScreen
} from "./types.js";
