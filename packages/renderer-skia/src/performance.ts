import type { GraphNodeSnapshot } from "@kaiisuuwii/core";
import { vec2, type Bounds } from "@kaiisuuwii/shared";

import type {
  CameraState,
  CubicBezierCurve,
  RenderNodeLevelOfDetail,
  RendererDebugOptions,
  RendererVirtualizationOptions,
  RendererViewport,
  SceneGroupItem
} from "./types.js";

export const boundsIntersect = (left: Bounds, right: Bounds): boolean =>
  left.min.x <= right.max.x &&
  left.max.x >= right.min.x &&
  left.min.y <= right.max.y &&
  left.max.y >= right.min.y;

export const expandBounds = (bounds: Bounds, padding: number): Bounds => ({
  min: vec2(bounds.min.x - padding, bounds.min.y - padding),
  max: vec2(bounds.max.x + padding, bounds.max.y + padding)
});

export const unionBounds = (boundsList: readonly Bounds[]): Bounds | undefined => {
  if (boundsList.length === 0) {
    return undefined;
  }

  return boundsList.reduce(
    (accumulator, bounds) => ({
      min: vec2(
        Math.min(accumulator.min.x, bounds.min.x),
        Math.min(accumulator.min.y, bounds.min.y)
      ),
      max: vec2(
        Math.max(accumulator.max.x, bounds.max.x),
        Math.max(accumulator.max.y, bounds.max.y)
      )
    }),
    boundsList[0]!
  );
};

export const getViewportBounds = (
  viewport: RendererViewport,
  camera: CameraState,
  padding = 0
): Bounds =>
  expandBounds(
    {
      min: vec2(camera.position.x, camera.position.y),
      max: vec2(
        camera.position.x + viewport.width / camera.zoom,
        camera.position.y + viewport.height / camera.zoom
      )
    },
    padding
  );

export const getNodeSnapshotBounds = (node: GraphNodeSnapshot): Bounds => ({
  min: node.position,
  max: vec2(node.position.x + node.dimensions.x, node.position.y + node.dimensions.y)
});

export const getGroupItemBounds = (group: SceneGroupItem): Bounds => ({
  min: group.position,
  max: vec2(group.position.x + group.size.x, group.position.y + group.size.y)
});

export const getCurveBounds = (curve: CubicBezierCurve, padding = 0): Bounds => {
  const minX = Math.min(curve.start.x, curve.control1.x, curve.control2.x, curve.end.x);
  const minY = Math.min(curve.start.y, curve.control1.y, curve.control2.y, curve.end.y);
  const maxX = Math.max(curve.start.x, curve.control1.x, curve.control2.x, curve.end.x);
  const maxY = Math.max(curve.start.y, curve.control1.y, curve.control2.y, curve.end.y);

  return {
    min: vec2(minX - padding, minY - padding),
    max: vec2(maxX + padding, maxY + padding)
  };
};

export const resolveNodeLevelOfDetail = (
  zoom: number,
  virtualization: RendererVirtualizationOptions
): RenderNodeLevelOfDetail => ({
  zoom,
  showLabel: zoom >= virtualization.levelOfDetail.labels,
  showPorts: zoom >= virtualization.levelOfDetail.ports,
  showDecorations: zoom >= virtualization.levelOfDetail.decorations
});

export const estimateFrameMetrics = (
  previousTimestampMs: number | undefined,
  nextTimestampMs: number | undefined,
  debug: RendererDebugOptions
): { readonly frameDurationMs?: number; readonly fps?: number } => {
  if (!debug.enabled || !debug.showFpsOverlay || previousTimestampMs === undefined || nextTimestampMs === undefined) {
    return {};
  }

  const frameDurationMs = Math.max(0, nextTimestampMs - previousTimestampMs);
  const fps = frameDurationMs > 0 ? 1000 / frameDurationMs : undefined;

  return {
    frameDurationMs,
    ...(fps !== undefined ? { fps } : {})
  };
};
