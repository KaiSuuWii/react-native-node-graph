import { vec2, type Bounds } from "@kaiisuuwii/shared";

import type { CameraState, RendererViewport } from "./types.js";

export const DEFAULT_SVG_CAMERA: CameraState = {
  position: vec2(0, 0),
  zoom: 1
};

export const createSvgCameraState = (input?: Partial<CameraState>): CameraState => ({
  position: input?.position !== undefined ? { ...input.position } : DEFAULT_SVG_CAMERA.position,
  zoom: input?.zoom ?? DEFAULT_SVG_CAMERA.zoom
});

export const computeSvgViewBox = (
  camera: CameraState,
  viewport: RendererViewport
): string => {
  const minX = camera.position.x;
  const minY = camera.position.y;
  const width = viewport.width / camera.zoom;
  const height = viewport.height / camera.zoom;

  return `${minX} ${minY} ${width} ${height}`;
};

export const computeSvgTransform = (camera: CameraState): string =>
  `scale(${camera.zoom}) translate(${-camera.position.x}, ${-camera.position.y})`;

export const getSvgViewportBounds = (
  viewport: RendererViewport,
  camera: CameraState,
  padding = 0
): Bounds => ({
  min: vec2(camera.position.x - padding, camera.position.y - padding),
  max: vec2(
    camera.position.x + viewport.width / camera.zoom + padding,
    camera.position.y + viewport.height / camera.zoom + padding
  )
});
