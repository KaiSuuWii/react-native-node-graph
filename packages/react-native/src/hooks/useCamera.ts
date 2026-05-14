import {
  clampZoom,
  screenToGraphSpace
} from "@kaiisuuwii/renderer-skia";
import { subtractVec2, vec2, type Vec2 } from "@kaiisuuwii/shared";

import { createSharedValue, withDecay, withSpring } from "../runtime.js";
import type { AnimatedCameraState, UseCameraOptions } from "../types.js";

const DEFAULT_ZOOM_MIN = 0.1;
const DEFAULT_ZOOM_MAX = 4;

export const useCamera = (options: UseCameraOptions = {}): AnimatedCameraState => {
  const offsetX = createSharedValue(options.initial?.position?.x ?? 0);
  const offsetY = createSharedValue(options.initial?.position?.y ?? 0);
  const zoom = createSharedValue(options.initial?.zoom ?? 1);
  const zoomMin = options.zoomMin ?? DEFAULT_ZOOM_MIN;
  const zoomMax = options.zoomMax ?? DEFAULT_ZOOM_MAX;
  const panDecelerationRate = options.panDecelerationRate ?? 0.98;

  const toPlain = () => ({
    position: vec2(offsetX.value, offsetY.value),
    zoom: zoom.value
  });

  return {
    offsetX,
    offsetY,
    zoom,
    toPlain,
    animatePanTo: (target) => {
      withSpring(offsetX, target.x);
      withSpring(offsetY, target.y);
    },
    animateZoomTo: (targetZoom, originScreen: Vec2) => {
      const currentCamera = toPlain();
      const clamped = clampZoom(targetZoom, {
        minZoom: zoomMin,
        maxZoom: zoomMax
      });
      const graphPoint = screenToGraphSpace(originScreen, currentCamera);
      const nextPosition = subtractVec2(graphPoint, vec2(originScreen.x / clamped, originScreen.y / clamped));

      withSpring(zoom, clamped);
      withSpring(offsetX, nextPosition.x);
      withSpring(offsetY, nextPosition.y);
    },
    applyMomentum: (velocity) => {
      withDecay(offsetX, -velocity.x / Math.max(zoom.value, 0.0001), panDecelerationRate);
      withDecay(offsetY, -velocity.y / Math.max(zoom.value, 0.0001), panDecelerationRate);
    }
  };
};
