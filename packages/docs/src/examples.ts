import { createCoreEngine } from "@kaiisuuwii/core";
import { createSkiaRenderPlan } from "@kaiisuuwii/renderer-skia";
import { createSvgRenderPlan, serializeSvgRenderPlan } from "@kaiisuuwii/renderer-svg";
import { vec2 } from "@kaiisuuwii/shared";
import {
  createAnnotationNodePlugin,
  createExecutableNodePlugin,
  createExecutableRendererPlugin
} from "@kaiisuuwii/plugins";
import {
  createCyclicExecutionScreen,
  CUSTOM_NODE_EXAMPLE_DOCUMENT,
  SMALL_GRAPH_EXAMPLE_DOCUMENT
} from "@kaiisuuwii/examples";

export const createCoreApiExample = () => {
  const engine = createCoreEngine({
    plugins: [createExecutableNodePlugin()]
  });

  engine.importGraph(SMALL_GRAPH_EXAMPLE_DOCUMENT);

  return {
    nodeCount: engine.getSnapshot().nodes.length,
    edgeCount: engine.getSnapshot().edges.length,
    selectionMode: engine.getSnapshot().selection.activeSelectionMode
  };
};

export const createRendererApiExample = () => {
  const plan = createSkiaRenderPlan({
    snapshot: SMALL_GRAPH_EXAMPLE_DOCUMENT.graph,
    interaction: {
      onEvent: () => undefined
    },
    viewport: {
      width: 1024,
      height: 768
    },
    themeMode: "dark",
    themeScale: "large",
    plugins: [createExecutableRendererPlugin()],
    accessibility: {
      enabled: true,
      keyboardNavigationEnabled: true,
      screenReaderEnabled: true,
      scalableUiEnabled: true
    }
  });

  return {
    layerKinds: plan.scene.layers.map((layer) => layer.kind),
    themeMode: plan.scene.theme.mode,
    fontScale: plan.scene.theme.fontScale,
    focusableCount: plan.scene.accessibility.focusOrder.length
  };
};

export const createPluginAuthoringExample = () => {
  const engine = createCoreEngine({
    plugins: [createExecutableNodePlugin(), createAnnotationNodePlugin()]
  });

  engine.importGraph(CUSTOM_NODE_EXAMPLE_DOCUMENT);

  return {
    pluginNodeTypes: engine.getSnapshot().nodes.map((node) => node.type),
    canExport: engine.exportGraph().version === 1
  };
};

export const createSerializationExample = () => {
  const engine = createCoreEngine({
    plugins: [createExecutableNodePlugin()]
  });

  engine.importGraph(SMALL_GRAPH_EXAMPLE_DOCUMENT);
  engine.clearSelection();
  const exported = engine.exportPartialGraph({
    nodeIds: [engine.getSnapshot().nodes[0]!.id]
  });

  return {
    exportedVersion: exported.version,
    exportedNodeCount: exported.graph.nodes.length,
    importedPosition: vec2(
      exported.graph.nodes[0]?.position.x ?? 0,
      exported.graph.nodes[0]?.position.y ?? 0
    )
  };
};

export const createSvgRendererExample = () => {
  const plan = createSvgRenderPlan({
    snapshot: SMALL_GRAPH_EXAMPLE_DOCUMENT.graph,
    viewport: { width: 1280, height: 720 },
    themeMode: "light"
  });
  const svgString = serializeSvgRenderPlan(plan);

  return {
    layerKinds: plan.layers.map((l) => l.kind),
    visibleNodeCount: plan.diagnostics.visibleNodeCount,
    viewBox: plan.viewBox,
    svgByteLength: svgString.length,
    isValidSvg: svgString.startsWith("<?xml") && svgString.endsWith("</svg>")
  };
};

export const createCyclicExecutionExample = async () => {
  const result = await createCyclicExecutionScreen();

  return {
    status: result.status,
    converged: result.converged,
    iterationsRun: result.iterationsRun,
    cycleGroupCount: result.cycleGroups.length
  };
};

export const documentationExamples = {
  createCoreApiExample,
  createCyclicExecutionExample,
  createRendererApiExample,
  createPluginAuthoringExample,
  createSerializationExample,
  createSvgRendererExample
} as const;
