import type { TextEditCommitEvent } from "@kaiisuuwii/renderer-skia";

import { createNodeGraphGestures } from "./gestures.js";
import { useGraphEditor } from "./hooks/useGraphEditor.js";
import type { NodeGraphCanvasHandle, NodeGraphCanvasProps } from "./types.js";

const ENGINE_EVENTS = [
  "nodeAdded",
  "nodeRemoved",
  "edgeCreated",
  "edgeDeleted",
  "selectionChanged"
] as const;

export const NodeGraphCanvas = (props: NodeGraphCanvasProps): NodeGraphCanvasHandle => {
  const graphEditor = useGraphEditor(props.engine, props);
  let renderPlan = graphEditor.buildRenderPlan();
  let renderCount = 1;
  let disposed = false;

  const rerender = () => {
    if (disposed) {
      return renderPlan;
    }

    renderPlan = graphEditor.syncSnapshot();
    renderCount += 1;
    return renderPlan;
  };

  const unsubs = ENGINE_EVENTS.map((eventName) => props.engine.on(eventName, () => {
    rerender();
  }));
  const gestures = createNodeGraphGestures({
    editor: graphEditor.editor,
    camera: graphEditor.cameraState,
    dragController: graphEditor.dragController,
    options: props
  });

  const commitTextEdit = (): TextEditCommitEvent | undefined => {
    const result = graphEditor.editor.commitTextEdit();

    if (result !== undefined) {
      props.onTextEditCommit?.(result);
      rerender();
    }

    return result;
  };

  return {
    type: "NodeGraphCanvas",
    props,
    editor: graphEditor.editor,
    gestures,
    animationState: graphEditor.animationState,
    getRenderPlan: () => renderPlan,
    getRenderCount: () => renderCount,
    commitTextEdit,
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      unsubs.forEach((unsubscribe) => unsubscribe());
      graphEditor.dispose();
    }
  };
};
