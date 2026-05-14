import type { GraphInteractionContract, GraphSnapshot } from "@kaiisuuwii/core";
import type { GraphInteractionEventPayload } from "@kaiisuuwii/shared";
import { createCameraState } from "./camera.js";
import { buildSkiaRenderScene } from "./scene.js";
import {
  resolveRendererAccessibilityOptions,
  resolveDebugOptions,
  resolveInteractionOptions,
  resolveRendererTheme,
  resolveVirtualizationOptions
} from "./theme.js";
import type {
  BuildSceneOptions,
  NodeGraphRendererProps,
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
  const theme = resolveRendererTheme(
    props.theme,
    props.themeMode,
    props.themeScale
  );
  const interactionOptions = resolveInteractionOptions(props.interactionOptions);
  const sceneOptions: BuildSceneOptions = {
    snapshot: props.snapshot,
    viewport: props.viewport,
    camera: createCameraState(props.camera),
    theme,
    plugins: props.plugins ?? [],
    interaction: props.interaction,
    interactionOptions,
    virtualization: resolveVirtualizationOptions(props.virtualization),
    debug: resolveDebugOptions(props.debug),
    accessibility: resolveRendererAccessibilityOptions(props.accessibility),
    ...(props.resolveNodeType !== undefined ? { resolveNodeType: props.resolveNodeType } : {}),
    ...(props.measurer !== undefined ? { measurer: props.measurer } : {}),
    ...(props.imageCache !== undefined ? { imageCache: props.imageCache } : {}),
    ...(props.presenceOverlays !== undefined ? { presenceOverlays: props.presenceOverlays } : {}),
    ...(props.interactionState !== undefined ? { interactionState: props.interactionState } : {}),
    ...(props.previousScene !== undefined ? { previousScene: props.previousScene } : {}),
    ...(props.frameTimestampMs !== undefined ? { frameTimestampMs: props.frameTimestampMs } : {})
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
export { runRendererBenchmarkSuite } from "./benchmark.js";
export type { RendererBenchmarkResult, RendererBenchmarkScenario } from "./benchmark.js";
export { createGraphEditor } from "./editor.js";
export { createRendererImageCache } from "./image-cache.js";
export { createImageLoader } from "./image-loader.js";
export { buildSceneSpatialIndex, hitTestSceneBounds, hitTestScenePoint, isPointInBounds } from "./hit-testing.js";
export { createBezierCurve, createEdgeLayout, createGroupLayout, createNodeLayout, getNodeBounds, getPortAnchor } from "./layout.js";
export {
  boundsIntersect,
  expandBounds,
  getCurveBounds,
  getGroupItemBounds,
  getNodeSnapshotBounds,
  getViewportBounds,
  resolveNodeLevelOfDetail,
  unionBounds
} from "./performance.js";
export { buildSkiaRenderScene } from "./scene.js";
export { createSpatialIndex } from "./spatial-index.js";
export { createSkiaTextMeasurer } from "./text-measurement.js";
export type { CachedImage, ImageCacheOptions, RendererImageCache } from "./image-cache.js";
export type { ImageLoader, ImageLoaderOptions } from "./image-loader.js";
export {
  createRendererThemeController,
  DARK_RENDERER_THEME,
  DEFAULT_RENDERER_ACCESSIBILITY,
  DEFAULT_DEBUG_OPTIONS,
  DEFAULT_INTERACTION_OPTIONS,
  DEFAULT_RENDERER_THEME,
  DEFAULT_VIRTUALIZATION_OPTIONS,
  LIGHT_RENDERER_THEME,
  resolveRendererAccessibilityOptions,
  resolveDebugOptions,
  resolveInteractionOptions,
  resolveRendererTheme,
  resolveVirtualizationOptions
} from "./theme.js";
export type {
  BuildSceneOptions,
  CameraState,
  CameraVelocity,
  DebugBoundsOverlay,
  DebugOverlay,
  DebugPathOverlay,
  DebugTextOverlay,
  AccessibilityDescriptor,
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
  RenderNodeLevelOfDetail,
  RenderMarqueeSelection,
  RenderNodeLayout,
  RenderPortLayout,
  ImageContentItem,
  TextContentItem,
  TextEditCommitEvent,
  RendererDebugOptions,
  RendererEdgeSnapshot,
  RendererGridTheme,
  RendererInteractionOptions,
  RendererInteractionState,
  RendererInteractionHandler,
  RendererAccessibilityOptions,
  RendererLevelOfDetailThresholds,
  RendererNodeSnapshot,
  RendererNodeTheme,
  RendererNodeBadgeVisual,
  RendererNodeVisual,
  RendererPlugin,
  RendererPluginContext,
  RendererPluginDescriptor,
  RendererPluginOverlay,
  RendererSelectionTheme,
  RendererFocusTheme,
  RendererImageTheme,
  RendererTextTheme,
  RendererEdgeLabelVisual,
  RendererEdgeVisual,
  RendererTheme,
  RendererThemeController,
  RendererThemeControllerState,
  RendererThemeMode,
  RendererThemeScale,
  RendererVirtualizationOptions,
  RendererViewport,
  SceneAccessibilityState,
  SceneBackgroundLayer,
  SceneDebugLayer,
  SceneDiagnostics,
  SceneEdgeLayer,
  SceneGridLayer,
  SceneInteractionLayer,
  SceneGroupItem,
  SceneGroupLayer,
  SceneLayer,
  SceneLayerKind,
  SceneNodeLayer,
  ScenePresenceLayer,
  ScenePluginLayer,
  SceneSelectionLayer,
  SelectionHighlight,
  SkiaRenderPlan,
  SkiaRenderScene,
  SpatialIndex,
  SpatialIndexEntry,
  SpatialIndexEntryKind,
  StaticGraphExampleScreen,
  SyncPresenceOverlay
} from "./types.js";
