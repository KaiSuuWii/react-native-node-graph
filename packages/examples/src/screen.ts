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

  return {
    id: "renderer-foundation-static",
    title: "Renderer Foundation Static Graph",
    snapshot,
    rendererProps,
    initialNodeCount: renderPlan.nodes.length
  };
};
