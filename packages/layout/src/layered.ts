import { performance } from "node:perf_hooks";
import { vec2, type Vec2 } from "@kaiisuuwii/shared";
import type {
  LayeredLayoutOptions,
  LayoutDirection,
  LayoutEdgeInput,
  LayoutGraphInput,
  LayoutNodeInput,
  LayoutResult
} from "./types.js";
import { centerPositions } from "./utils.js";

// Detect back edges via iterative DFS to handle cycles
const findBackEdges = (
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[]
): Set<string> => {
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const edgeIdByPair = new Map<string, string>();

  for (const edge of edges) {
    adj.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    edgeIdByPair.set(`${edge.sourceNodeId}→${edge.targetNodeId}`, edge.id);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const backEdgeIds = new Set<string>();

  const dfs = (start: string): void => {
    const stack: Array<{ id: string; childIndex: number }> = [{ id: start, childIndex: 0 }];
    visited.add(start);
    inStack.add(start);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;

      const children = adj.get(frame.id) ?? [];
      if (frame.childIndex >= children.length) {
        inStack.delete(frame.id);
        stack.pop();
        continue;
      }

      const childId = children[frame.childIndex];
      frame.childIndex += 1;
      if (childId === undefined) continue;

      if (inStack.has(childId)) {
        const edgeId = edgeIdByPair.get(`${frame.id}→${childId}`);
        if (edgeId !== undefined) backEdgeIds.add(edgeId);
      } else if (!visited.has(childId)) {
        visited.add(childId);
        inStack.add(childId);
        stack.push({ id: childId, childIndex: 0 });
      }
    }
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  return backEdgeIds;
};

// Assign integer layer ranks via longest-path from sources
const assignLayers = (
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[],
  backEdgeIds: Set<string>
): Map<string, number> => {
  const forwardEdges = edges.filter((e) => !backEdgeIds.has(e.id));
  const inEdges = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const edge of forwardEdges) {
    inEdges.get(edge.targetNodeId)?.push(edge.sourceNodeId);
  }

  const layers = new Map<string, number>();

  const compute = (nodeId: string, stack: Set<string>): number => {
    const cached = layers.get(nodeId);
    if (cached !== undefined) return cached;
    if (stack.has(nodeId)) return 0;

    stack.add(nodeId);
    const preds = inEdges.get(nodeId) ?? [];
    let maxPred = -1;
    for (const predId of preds) {
      maxPred = Math.max(maxPred, compute(predId, stack));
    }
    stack.delete(nodeId);

    const layer = maxPred + 1;
    layers.set(nodeId, layer);
    return layer;
  };

  for (const node of nodes) compute(node.id, new Set<string>());
  return layers;
};

interface InternalNode {
  id: string;
  size: Vec2;
}

// Insert dummy nodes for edges spanning more than one layer
const insertDummies = (
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[],
  layers: Map<string, number>,
  backEdgeIds: Set<string>
): {
  allNodes: InternalNode[];
  allEdges: Array<{ sourceNodeId: string; targetNodeId: string }>;
} => {
  const allNodes: InternalNode[] = nodes.map((n) => ({ id: n.id, size: n.size }));
  const allEdges: Array<{ sourceNodeId: string; targetNodeId: string }> = [];
  let counter = 0;

  for (const edge of edges) {
    if (backEdgeIds.has(edge.id)) continue;

    const srcLayer = layers.get(edge.sourceNodeId) ?? 0;
    const tgtLayer = layers.get(edge.targetNodeId) ?? 0;

    if (tgtLayer - srcLayer <= 1) {
      allEdges.push(edge);
      continue;
    }

    let prevId = edge.sourceNodeId;
    for (let l = srcLayer + 1; l < tgtLayer; l++) {
      counter += 1;
      const dummyId = `_dummy_${counter}`;
      allNodes.push({ id: dummyId, size: vec2(0, 0) });
      layers.set(dummyId, l);
      allEdges.push({ sourceNodeId: prevId, targetNodeId: dummyId });
      prevId = dummyId;
    }
    allEdges.push({ sourceNodeId: prevId, targetNodeId: edge.targetNodeId });
  }

  return { allNodes, allEdges };
};

const groupByLayer = (
  nodes: InternalNode[],
  layers: Map<string, number>
): Map<number, string[]> => {
  const byLayer = new Map<number, string[]>();
  for (const node of nodes) {
    const l = layers.get(node.id) ?? 0;
    let arr = byLayer.get(l);
    if (arr === undefined) {
      arr = [];
      byLayer.set(l, arr);
    }
    arr.push(node.id);
  }
  return byLayer;
};

const minimizeCrossings = (
  byLayer: Map<number, string[]>,
  edges: Array<{ sourceNodeId: string; targetNodeId: string }>,
  passes: number
): void => {
  if (byLayer.size < 2) return;
  const maxLayer = Math.max(...byLayer.keys());

  for (let pass = 0; pass < passes; pass++) {
    for (let l = 1; l <= maxLayer; l++) {
      const layer = byLayer.get(l);
      const prev = byLayer.get(l - 1);
      if (layer === undefined || prev === undefined || prev.length === 0) continue;

      const prevPos = new Map<string, number>(prev.map((id, i) => [id, i]));
      const scored = layer.map((id) => {
        const ins = edges.filter((e) => e.targetNodeId === id);
        if (ins.length === 0) return { id, score: Infinity };
        const sum = ins.reduce((acc, e) => acc + (prevPos.get(e.sourceNodeId) ?? 0), 0);
        return { id, score: sum / ins.length };
      });
      scored.sort((a, b) => a.score - b.score);
      byLayer.set(l, scored.map((s) => s.id));
    }

    for (let l = maxLayer - 1; l >= 0; l--) {
      const layer = byLayer.get(l);
      const next = byLayer.get(l + 1);
      if (layer === undefined || next === undefined || next.length === 0) continue;

      const nextPos = new Map<string, number>(next.map((id, i) => [id, i]));
      const scored = layer.map((id) => {
        const outs = edges.filter((e) => e.sourceNodeId === id);
        if (outs.length === 0) return { id, score: Infinity };
        const sum = outs.reduce((acc, e) => acc + (nextPos.get(e.targetNodeId) ?? 0), 0);
        return { id, score: sum / outs.length };
      });
      scored.sort((a, b) => a.score - b.score);
      byLayer.set(l, scored.map((s) => s.id));
    }
  }
};

const applyDirection = (
  positions: Map<string, Vec2>,
  direction: LayoutDirection
): Map<string, Vec2> => {
  if (direction === "top-bottom") return positions;

  const result = new Map<string, Vec2>();
  for (const [id, p] of positions) {
    switch (direction) {
      case "bottom-top":
        result.set(id, vec2(p.x, -p.y));
        break;
      case "left-right":
        result.set(id, vec2(p.y, p.x));
        break;
      case "right-left":
        result.set(id, vec2(-p.y, p.x));
        break;
    }
  }
  return result;
};

export const runLayeredLayout = (
  input: LayoutGraphInput,
  options: LayeredLayoutOptions
): LayoutResult => {
  const start = performance.now();

  if (input.nodes.length === 0) {
    return { positions: [], algorithm: "layered", durationMs: performance.now() - start };
  }

  const backEdgeIds = findBackEdges(input.nodes, input.edges);
  const layers = assignLayers(input.nodes, input.edges, backEdgeIds);
  const { allNodes, allEdges } = insertDummies(input.nodes, input.edges, layers, backEdgeIds);

  const byLayer = groupByLayer(allNodes, layers);
  minimizeCrossings(byLayer, allEdges, 4);

  const sizeMap = new Map<string, Vec2>(allNodes.map((n) => [n.id, n.size]));
  const positions = new Map<string, Vec2>();
  const maxLayer = Math.max(...byLayer.keys());

  let yAccum = 0;
  for (let l = 0; l <= maxLayer; l++) {
    const layerIds = byLayer.get(l) ?? [];

    let maxH = 0;
    let totalW = 0;
    for (const id of layerIds) {
      const s = sizeMap.get(id) ?? vec2(0, 0);
      if (s.y > maxH) maxH = s.y;
      totalW += s.x;
    }
    totalW += Math.max(0, layerIds.length - 1) * options.nodePaddingX;

    let xCursor = -totalW / 2;
    for (const id of layerIds) {
      const s = sizeMap.get(id) ?? vec2(0, 0);
      positions.set(id, vec2(xCursor, yAccum));
      xCursor += s.x + options.nodePaddingX;
    }

    yAccum += maxH + options.nodePaddingY + options.rankSeparation;
  }

  const transformed = applyDirection(positions, options.direction);
  const final = options.centerGraph
    ? centerPositions(transformed, input.nodes)
    : transformed;

  const result: Array<{ id: string; position: Vec2 }> = [];
  for (const node of input.nodes) {
    const pos = final.get(node.id);
    if (pos !== undefined) result.push({ id: node.id, position: pos });
  }

  return { positions: result, algorithm: "layered", durationMs: performance.now() - start };
};
