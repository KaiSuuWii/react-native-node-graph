import { createCoreEngine } from "@react-native-node-graph/core";
import { createSkiaRenderPlan } from "@react-native-node-graph/renderer-skia";

import { createFoundationExampleSnapshot } from "./fixtures.js";

export const createRendererFoundationExampleScreen = () => {
  const snapshot = createFoundationExampleSnapshot();
  const interaction = {
    onEvent: () => undefined
  };
  const rendererProps = {
    snapshot,
    interaction,
    viewport: {
      width: 1280,
      height: 720
    },
    camera: {
      position: { x: 0, y: 0 },
      zoom: 1
    },
    plugins: [{ id: "plugin-placeholder" }]
  };
  const renderPlan = createSkiaRenderPlan(snapshot, interaction);
  const engine = createCoreEngine({
    graph: snapshot,
    nodeTypes: [
      { type: "number", defaultLabel: "Number" },
      { type: "math", defaultLabel: "Math" },
      { type: "display", defaultLabel: "Display" }
    ]
  });
  const editor = {
    getRenderPlan: () => createSkiaRenderPlan(engine.getSnapshot(), interaction),
    selectNode: engine.selectNode,
    dragNode: engine.updateNode,
    createEdge: engine.createEdge,
    clearSelection: engine.clearSelection
  };

  return {
    id: "renderer-foundation-static",
    title: "Renderer Foundation Editing Harness",
    snapshot,
    rendererProps,
    initialNodeCount: renderPlan.nodes.length,
    engine,
    editor
  };
};
