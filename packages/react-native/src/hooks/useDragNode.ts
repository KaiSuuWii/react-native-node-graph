import { screenToGraphSpace } from "@kaiisuuwii/renderer-skia";
import { addVec2, subtractVec2, vec2 } from "@kaiisuuwii/shared";
import type { CoreEngine } from "@kaiisuuwii/core";

import { createSharedValue, withSpring } from "../runtime.js";
import type { AnimatedCameraState, DragController, DragOptions } from "../types.js";

const snap = (value: number, grid: number): number => Math.round(value / grid) * grid;

export const useDragNode = (
  engine: CoreEngine,
  camera: AnimatedCameraState,
  options: DragOptions = {}
): DragController => {
  const draggingNodeId = createSharedValue<string | undefined>(undefined);
  const dragOffset = createSharedValue(vec2(0, 0));
  let dragOrigin = vec2(0, 0);
  let initialPosition = vec2(0, 0);

  return {
    draggingNodeId,
    dragOffset,
    onDragStart: (nodeId, screenPosition) => {
      const node = engine.getSnapshot().nodes.find((entry) => entry.id === nodeId);

      if (node === undefined) {
        return;
      }

      draggingNodeId.value = nodeId;
      dragOrigin = screenToGraphSpace(screenPosition, camera.toPlain());
      initialPosition = node.position;
      withSpring(dragOffset, vec2(0, 0));
    },
    onDragMove: (screenPosition) => {
      if (draggingNodeId.value === undefined) {
        return;
      }

      const graphPosition = screenToGraphSpace(screenPosition, camera.toPlain());
      withSpring(dragOffset, subtractVec2(graphPosition, dragOrigin));
    },
    onDragEnd: () => {
      const nodeId = draggingNodeId.value;

      if (nodeId === undefined) {
        return;
      }

      const rawPosition = addVec2(initialPosition, dragOffset.value);
      const finalPosition =
        options.snapToGrid === undefined
          ? rawPosition
          : vec2(snap(rawPosition.x, options.snapToGrid), snap(rawPosition.y, options.snapToGrid));

      engine.updateNode(nodeId, {
        position: finalPosition
      });
      withSpring(dragOffset, vec2(0, 0));
      draggingNodeId.value = undefined;
    }
  };
};
