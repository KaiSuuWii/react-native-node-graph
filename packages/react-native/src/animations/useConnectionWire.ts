import { createBezierCurve } from "@kaiisuuwii/renderer-skia";
import type { Vec2 } from "@kaiisuuwii/shared";

import { createSharedValue, withSpring } from "../runtime.js";
import type { AnimatedCameraState, ConnectionWireController } from "../types.js";

export const useConnectionWire = (_camera: AnimatedCameraState): ConnectionWireController => {
  const connectionWireEnd = createSharedValue<Vec2 | undefined>(undefined);
  let sourcePosition: Vec2 | undefined;

  return {
    connectionWireEnd,
    getCurve: () =>
      sourcePosition !== undefined && connectionWireEnd.value !== undefined
        ? createBezierCurve(sourcePosition, connectionWireEnd.value)
        : undefined,
    onConnectionStart: (sourcePortPosition) => {
      sourcePosition = sourcePortPosition;
      connectionWireEnd.value = sourcePortPosition;
    },
    onConnectionMove: (screenPosition) => {
      connectionWireEnd.value = screenPosition;
    },
    onConnectionEnd: () => {
      if (connectionWireEnd.value !== undefined) {
        withSpring(connectionWireEnd, connectionWireEnd.value);
      }

      connectionWireEnd.value = undefined;
      sourcePosition = undefined;
    }
  };
};
