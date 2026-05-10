import { vec2, type Bounds, type Vec2 } from "@kaiisuuwii/shared";

import { getCurveBounds } from "./performance.js";
import { createSpatialIndex } from "./spatial-index.js";
import type {
  CubicBezierCurve,
  HitTestResult,
  HitTestTarget,
  SceneNodeLayer,
  SkiaRenderScene,
  SpatialIndex,
  SpatialIndexEntry
} from "./types.js";

const HIT_PRIORITY: Record<HitTestTarget["kind"], number> = {
  port: 0,
  node: 1,
  edge: 2,
  group: 3,
  canvas: 4
};

export const isPointInBounds = (point: Vec2, bounds: Bounds): boolean =>
  point.x >= bounds.min.x &&
  point.x <= bounds.max.x &&
  point.y >= bounds.min.y &&
  point.y <= bounds.max.y;

const distanceToSegment = (point: Vec2, start: Vec2, end: Vec2): number => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared)
  );
  const projection = vec2(start.x + deltaX * t, start.y + deltaY * t);

  return Math.hypot(point.x - projection.x, point.y - projection.y);
};

const sampleBezierPoint = (curve: CubicBezierCurve, t: number): Vec2 => {
  const inverse = 1 - t;

  return vec2(
    inverse ** 3 * curve.start.x +
      3 * inverse ** 2 * t * curve.control1.x +
      3 * inverse * t ** 2 * curve.control2.x +
      t ** 3 * curve.end.x,
    inverse ** 3 * curve.start.y +
      3 * inverse ** 2 * t * curve.control1.y +
      3 * inverse * t ** 2 * curve.control2.y +
      t ** 3 * curve.end.y
  );
};

const distanceToBezierCurve = (point: Vec2, curve: CubicBezierCurve, samples = 20): number => {
  let minDistance = Number.POSITIVE_INFINITY;
  let previous = curve.start;

  for (let index = 1; index <= samples; index += 1) {
    const next = sampleBezierPoint(curve, index / samples);
    minDistance = Math.min(minDistance, distanceToSegment(point, previous, next));
    previous = next;
  }

  return minDistance;
};

const getNodeLayer = (scene: SkiaRenderScene): SceneNodeLayer | undefined =>
  scene.layers.find((layer): layer is SceneNodeLayer => layer.kind === "node");

export const buildSceneSpatialIndex = (
  scene: SkiaRenderScene,
  cellSize = 128
): SpatialIndex => {
  const index = createSpatialIndex(cellSize);
  const nodeLayer = getNodeLayer(scene);

  nodeLayer?.items.forEach((node) => {
    index.insert({
      kind: "node",
      id: node.id,
      bounds: {
        min: node.position,
        max: vec2(node.position.x + node.size.x, node.position.y + node.size.y)
      }
    });

    node.ports.forEach((port) => {
      index.insert({
        kind: "port",
        id: port.id,
        nodeId: node.id,
        portId: port.id,
        bounds: {
          min: vec2(port.position.x - port.radius, port.position.y - port.radius),
          max: vec2(port.position.x + port.radius, port.position.y + port.radius)
        }
      });
    });
  });

  scene.layers.forEach((layer) => {
    if (layer.kind === "group") {
      layer.items.forEach((group) => {
        index.insert({
          kind: "group",
          id: group.id,
          bounds: {
            min: group.position,
            max: vec2(group.position.x + group.size.x, group.position.y + group.size.y)
          }
        });
      });
    }

    if (layer.kind === "edge") {
      layer.items.forEach((edge) => {
        index.insert({
          kind: "edge",
          id: edge.id,
          bounds: getCurveBounds(edge.curve, scene.interactionOptions.edgeHitWidth)
        });
      });
    }
  });

  return index;
};

const resolveCandidateDistance = (
  scene: SkiaRenderScene,
  candidate: SpatialIndexEntry,
  point: Vec2
): number => {
  if (candidate.kind === "port") {
    const center = vec2(
      (candidate.bounds.min.x + candidate.bounds.max.x) * 0.5,
      (candidate.bounds.min.y + candidate.bounds.max.y) * 0.5
    );

    return Math.hypot(point.x - center.x, point.y - center.y);
  }

  if (candidate.kind === "edge") {
    const edgeLayer = scene.layers.find((layer) => layer.kind === "edge");
    const layout = edgeLayer?.kind === "edge" ? edgeLayer.items.find((item) => item.id === candidate.id) : undefined;

    return layout === undefined
      ? Number.POSITIVE_INFINITY
      : distanceToBezierCurve(point, layout.curve);
  }

  return 0;
};

const toHitTestTarget = (entry: SpatialIndexEntry): HitTestTarget => {
  switch (entry.kind) {
    case "port":
      return { kind: "port", nodeId: entry.nodeId, portId: entry.portId };
    case "node":
      return { kind: "node", nodeId: entry.id };
    case "edge":
      return { kind: "edge", edgeId: entry.id };
    case "group":
      return { kind: "group", groupId: entry.id };
  }
};

export const hitTestScenePoint = (
  scene: SkiaRenderScene,
  index: SpatialIndex,
  point: Vec2
): HitTestResult => {
  const expandedBounds = {
    min: vec2(point.x - scene.interactionOptions.hitSlop, point.y - scene.interactionOptions.hitSlop),
    max: vec2(point.x + scene.interactionOptions.hitSlop, point.y + scene.interactionOptions.hitSlop)
  };
  const candidates = [
    ...index.queryPoint(point),
    ...index.queryBounds(expandedBounds)
  ];
  const uniqueCandidates = [...new Map(candidates.map((entry) => [`${entry.kind}:${entry.id}`, entry])).values()];
  const ranked = uniqueCandidates
    .map((candidate) => ({
      candidate,
      priority: HIT_PRIORITY[toHitTestTarget(candidate).kind],
      distance: resolveCandidateDistance(scene, candidate, point)
    }))
    .sort((left, right) => left.priority - right.priority || left.distance - right.distance);

  const best = ranked[0];

  if (
    best === undefined ||
    (best.candidate.kind === "edge" && best.distance > scene.interactionOptions.edgeHitWidth)
  ) {
    return {
      target: { kind: "canvas" },
      point,
      distance: Number.POSITIVE_INFINITY
    };
  }

  return {
    target: toHitTestTarget(best.candidate),
    point,
    distance: best.distance
  };
};

export const hitTestSceneBounds = (
  _scene: SkiaRenderScene,
  index: SpatialIndex,
  bounds: Bounds
): readonly HitTestResult[] =>
  index.queryBounds(bounds)
    .filter((entry) => entry.kind === "node" || entry.kind === "group" || entry.kind === "edge")
    .map((entry) => ({
      target: toHitTestTarget(entry),
      point: bounds.min,
      distance: 0
    }))
    .sort(
      (left, right) =>
        HIT_PRIORITY[left.target.kind] - HIT_PRIORITY[right.target.kind] ||
        JSON.stringify(left.target).localeCompare(JSON.stringify(right.target))
    );
