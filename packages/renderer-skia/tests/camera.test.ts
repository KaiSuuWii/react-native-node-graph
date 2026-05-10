import {
  clampZoom,
  createCameraState,
  graphToScreenSpace,
  panCamera,
  screenToGraphSpace,
  zoomCameraAtScreenPoint
} from "@kaiisuuwii/renderer-skia";
import { vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";

describe("renderer-skia camera math", () => {
  it("round-trips graph and screen coordinates", () => {
    const camera = createCameraState({
      position: vec2(100, 50),
      zoom: 2
    });
    const graphPoint = vec2(160, 95);
    const screenPoint = graphToScreenSpace(graphPoint, camera);

    expect(screenPoint).toEqual(vec2(120, 90));
    expect(screenToGraphSpace(screenPoint, camera)).toEqual(graphPoint);
  });

  it("pans in graph space based on screen-space movement", () => {
    const camera = createCameraState({
      position: vec2(10, 20),
      zoom: 2
    });

    expect(panCamera(camera, vec2(40, -20))).toEqual({
      position: vec2(-10, 30),
      zoom: 2
    });
  });

  it("keeps the zoom origin stable", () => {
    const camera = createCameraState({
      position: vec2(100, 50),
      zoom: 1
    });
    const origin = vec2(300, 200);
    const graphPointBeforeZoom = screenToGraphSpace(origin, camera);
    const nextCamera = zoomCameraAtScreenPoint(camera, 2, origin, {
      minZoom: 0.25,
      maxZoom: 4
    });

    expect(graphPointBeforeZoom).toEqual(screenToGraphSpace(origin, nextCamera));
  });

  it("clamps zoom within interaction bounds", () => {
    expect(clampZoom(0.1, { minZoom: 0.25, maxZoom: 3 })).toBe(0.25);
    expect(clampZoom(4, { minZoom: 0.25, maxZoom: 3 })).toBe(3);
  });
});
