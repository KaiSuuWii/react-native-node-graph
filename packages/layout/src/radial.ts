import { performance } from "node:perf_hooks";
import { vec2, type Vec2 } from "@kaiisuuwii/shared";
import type {
  LayoutGraphInput,
  LayoutResult,
  RadialLayoutOptions
} from "./types.js";

// Build undirected adjacency (both directions) for BFS
const buildUndirectedAdj = (
  nodes: LayoutGraphInput["nodes"],
  edges: LayoutGraphInput["edges"]
): Map<string, string[]> => {
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const edge of edges) {
    adj.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    adj.get(edge.targetNodeId)?.push(edge.sourceNodeId);
  }
  return adj;
};

// Pick the node with the highest total degree
const findHighestDegreeNode = (
  nodes: LayoutGraphInput["nodes"],
  edges: LayoutGraphInput["edges"]
): string => {
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    degree.set(edge.sourceNodeId, (degree.get(edge.sourceNodeId) ?? 0) + 1);
    degree.set(edge.targetNodeId, (degree.get(edge.targetNodeId) ?? 0) + 1);
  }

  let bestId = nodes[0]?.id ?? "";
  let bestDeg = 0;
  for (const [id, deg] of degree) {
    if (deg > bestDeg) {
      bestDeg = deg;
      bestId = id;
    }
  }
  return bestId;
};

export const runRadialLayout = (
  input: LayoutGraphInput,
  options: RadialLayoutOptions
): LayoutResult => {
  const start = performance.now();

  if (input.nodes.length === 0) {
    return { positions: [], algorithm: "radial", durationMs: performance.now() - start };
  }

  const sizeMap = new Map<string, Vec2>(input.nodes.map((n) => [n.id, n.size]));
  const adj = buildUndirectedAdj(input.nodes, input.edges);

  const centerNodeId =
    options.centerNodeId ?? findHighestDegreeNode(input.nodes, input.edges);

  // BFS to assign ring levels (distance in hops from center)
  const levels = new Map<string, number>();
  const bfsQueue: string[] = [centerNodeId];
  levels.set(centerNodeId, 0);

  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift();
    if (current === undefined) break;
    const currentLevel = levels.get(current) ?? 0;
    for (const neighbor of (adj.get(current) ?? [])) {
      if (!levels.has(neighbor)) {
        levels.set(neighbor, currentLevel + 1);
        bfsQueue.push(neighbor);
      }
    }
  }

  // Assign disconnected nodes to the outermost ring + 1
  const maxReachableLevel = levels.size > 0 ? Math.max(...levels.values()) : 0;
  let extraLevel = maxReachableLevel + 1;
  for (const node of input.nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, extraLevel);
      extraLevel += 1;
    }
  }

  // Group nodes by ring
  const byRing = new Map<number, string[]>();
  for (const [nodeId, level] of levels) {
    let ring = byRing.get(level);
    if (ring === undefined) {
      ring = [];
      byRing.set(level, ring);
    }
    ring.push(nodeId);
  }

  const positions = new Map<string, Vec2>();
  const startAngleRad = (options.startAngle * Math.PI) / 180;

  for (const [ringLevel, ringNodes] of byRing) {
    if (ringLevel === 0) {
      const size = sizeMap.get(centerNodeId) ?? vec2(0, 0);
      positions.set(centerNodeId, vec2(-size.x / 2, -size.y / 2));
      continue;
    }

    const radius = ringLevel * options.radiusStep;
    const angleStep = (2 * Math.PI) / ringNodes.length;

    for (let i = 0; i < ringNodes.length; i++) {
      const nodeId = ringNodes[i];
      if (nodeId === undefined) continue;
      const angle = startAngleRad + i * angleStep;
      const size = sizeMap.get(nodeId) ?? vec2(0, 0);
      positions.set(nodeId, vec2(
        radius * Math.cos(angle) - size.x / 2,
        radius * Math.sin(angle) - size.y / 2
      ));
    }
  }

  const result: Array<{ id: string; position: Vec2 }> = [];
  for (const node of input.nodes) {
    const pos = positions.get(node.id);
    if (pos !== undefined) result.push({ id: node.id, position: pos });
  }

  return { positions: result, algorithm: "radial", durationMs: performance.now() - start };
};
