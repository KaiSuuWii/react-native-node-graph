import { addVec2, scaleVec2, subtractVec2, vec2, type Vec2 } from "@react-native-node-graph/shared";

import type { CameraState, RendererInteractionOptions } from "./types.js";

export const DEFAULT_CAMERA_STATE: CameraState = {
  position: vec2(0, 0),
  zoom: 1
};

export const createCameraState = (input?: Partial<CameraState>): CameraState => ({
  position: input?.position === undefined ? DEFAULT_CAMERA_STATE.position : { ...input.position },
  zoom: input?.zoom ?? DEFAULT_CAMERA_STATE.zoom,
  ...(input?.velocity !== undefined ? { velocity: { ...input.velocity } } : {})
});

export const clampZoom = (
  zoom: number,
  options: Pick<RendererInteractionOptions, "minZoom" | "maxZoom">
): number => Math.min(options.maxZoom, Math.max(options.minZoom, zoom));

export const graphToScreenSpace = (point: Vec2, camera: CameraState): Vec2 =>
  addVec2(scaleVec2(subtractVec2(point, camera.position), camera.zoom), vec2(0, 0));

export const screenToGraphSpace = (point: Vec2, camera: CameraState): Vec2 =>
  addVec2(scaleVec2(point, 1 / camera.zoom), camera.position);

export const panCamera = (camera: CameraState, screenDelta: Vec2): CameraState => ({
  ...camera,
  position: subtractVec2(camera.position, scaleVec2(screenDelta, 1 / camera.zoom))
});

export const zoomCameraAtScreenPoint = (
  camera: CameraState,
  nextZoom: number,
  origin: Vec2,
  options: Pick<RendererInteractionOptions, "minZoom" | "maxZoom">
): CameraState => {
  const clampedZoom = clampZoom(nextZoom, options);
  const graphPoint = screenToGraphSpace(origin, camera);

  return {
    ...camera,
    zoom: clampedZoom,
    position: subtractVec2(graphPoint, scaleVec2(origin, 1 / clampedZoom))
  };
};
