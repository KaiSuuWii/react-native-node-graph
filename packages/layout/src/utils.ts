import { vec2, type Vec2 } from "@kaiisuuwii/shared";
import type { LayoutEdgeInput, LayoutGraphInput, LayoutNodeInput, LayoutResult } from "./types.js";

// Minimal structural interface — GraphSnapshot from @kaiisuuwii/core satisfies this
interface SnapshotLike {
  readonly nodes: readonly {
    readonly id: string;
    readonly dimensions: Vec2;
  }[];
  readonly edges: readonly {
    readonly id: string;
    readonly source: string;
    readonly target: string;
  }[];
}

export const graphInputFromSnapshot = (snapshot: SnapshotLike): LayoutGraphInput => ({
  nodes: snapshot.nodes.map((n) => ({ id: n.id, size: n.dimensions })),
  edges: snapshot.edges.map((e) => ({
    id: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target
  }))
});

interface EngineAdapter {
  updateNode(input: { readonly id: string; readonly position: Vec2 }): void;
}

export const applyResultToEngine = (result: LayoutResult, engine: EngineAdapter): void => {
  for (const { id, position } of result.positions) {
    engine.updateNode({ id, position });
  }
};

export const centerPositions = (
  positions: Map<string, Vec2>,
  nodes: readonly LayoutNodeInput[]
): Map<string, Vec2> => {
  if (nodes.length === 0) {
    return positions;
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos !== undefined) {
      sumX += pos.x;
      sumY += pos.y;
      count += 1;
    }
  }

  if (count === 0) {
    return positions;
  }

  const cx = sumX / count;
  const cy = sumY / count;
  const result = new Map<string, Vec2>();

  for (const [id, pos] of positions) {
    result.set(id, vec2(pos.x - cx, pos.y - cy));
  }

  return result;
};

export const detectRoots = (
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[]
): string[] => {
  const hasIncoming = new Set<string>(edges.map((e) => e.targetNodeId));
  return nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
};

export const buildAdjacency = (
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[]
): Map<string, string[]> => {
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const edge of edges) {
    const children = adj.get(edge.sourceNodeId);
    if (children !== undefined) {
      children.push(edge.targetNodeId);
    }
  }
  return adj;
};
