import { createGraphEditor, createSkiaRenderPlan } from "@kaiisuuwii/renderer-skia";
import { addVec2, vec2 } from "@kaiisuuwii/shared";
import type { CoreEngine, GraphSnapshot } from "@kaiisuuwii/core";

import { useConnectionWire } from "../animations/useConnectionWire.js";
import { useSelectionPulse } from "../animations/useSelectionPulse.js";
import type { GraphEditorHookResult, NodeGraphCanvasProps } from "../types.js";
import { useCamera } from "./useCamera.js";
import { useDragNode } from "./useDragNode.js";

const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 720
} as const;

export const useGraphEditor = (
  engine: CoreEngine,
  props: NodeGraphCanvasProps
): GraphEditorHookResult => {
  const cameraState = useCamera({
    initial: props.initialCamera,
    zoomMin: props.zoomMin,
    zoomMax: props.zoomMax,
    panDecelerationRate: props.panDecelerationRate,
    zoomDecelerationRate: props.zoomDecelerationRate,
    panSpringConfig: props.panSpringConfig,
    zoomSpringConfig: props.zoomSpringConfig
  });
  const dragController = useDragNode(engine, cameraState, {
    springConfig: props.nodeDragSpringConfig
  });
  const connectionWire = useConnectionWire(cameraState);
  const selectionPulseController = useSelectionPulse(engine.getSnapshot());

  const editor = createGraphEditor({
    engine,
    interaction: { onEvent: () => undefined },
    viewport: DEFAULT_VIEWPORT,
    plugins: props.rendererPlugins ?? [],
    imageCache: props.imageCache,
    imageLoader: props.imageLoader,
    theme: props.theme,
    themeMode: props.themeMode,
    themeScale: props.themeScale,
    accessibility: props.accessibility,
    virtualization: props.virtualization,
    debug: props.debug,
    camera: cameraState.toPlain(),
    resolveNodeType: engine.getNodeType
  });

  const animationState = {
    camera: cameraState,
    draggingNodeId: dragController.draggingNodeId,
    draggingNodeOffset: dragController.dragOffset,
    connectionWireEnd: connectionWire.connectionWireEnd,
    marqueeStart: {
      value: undefined as ReturnType<typeof vec2> | undefined
    },
    marqueeEnd: {
      value: undefined as ReturnType<typeof vec2> | undefined
    },
    selectionPulse: selectionPulseController.pulse
  };

  const syncSnapshot = (snapshot: GraphSnapshot = engine.getSnapshot()) => {
    selectionPulseController.sync(snapshot);
    return buildRenderPlan();
  };

  const buildRenderPlan = () => {
    const basePlan = createSkiaRenderPlan({
      snapshot: engine.getSnapshot(),
      interaction: { onEvent: () => undefined },
      viewport: DEFAULT_VIEWPORT,
      camera: cameraState.toPlain(),
      plugins: props.rendererPlugins ?? [],
      imageCache: props.imageCache,
      theme: props.theme,
      themeMode: props.themeMode,
      themeScale: props.themeScale,
      accessibility: props.accessibility,
      virtualization: props.virtualization,
      debug: props.debug,
      resolveNodeType: engine.getNodeType,
      interactionState: editor.getInteractionState()
    });

    if (dragController.draggingNodeId.value === undefined) {
      return basePlan;
    }

    const draggedNodeId = dragController.draggingNodeId.value;
    const dragOffset = dragController.dragOffset.value;
    const updatedNodes = basePlan.nodes.map((node) =>
      node.id === draggedNodeId
        ? {
            ...node,
            position: addVec2(node.position, dragOffset)
          }
        : node
    );
    const updatedLayers = basePlan.scene.layers.map((layer) =>
      layer.kind === "node"
        ? {
            ...layer,
            items: updatedNodes
          }
        : layer.kind === "selection"
          ? {
              ...layer,
              items: layer.items.map((item) =>
                item.targetId === draggedNodeId
                  ? {
                      ...item,
                      position: addVec2(item.position, dragOffset),
                      width: item.width + animationState.selectionPulse.value
                    }
                  : {
                      ...item,
                      width: item.width + animationState.selectionPulse.value
                    }
              )
            }
          : layer
    );

    return {
      ...basePlan,
      nodes: updatedNodes,
      scene: {
        ...basePlan.scene,
        camera: cameraState.toPlain(),
        layers: updatedLayers
      }
    };
  };

  return {
    cameraState,
    animationState,
    buildRenderPlan,
    editor,
    dragController,
    connectionWire,
    syncSnapshot,
    dispose: () => {
      editor.dispose();
    }
  };
};
