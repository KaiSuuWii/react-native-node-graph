import { performance } from "node:perf_hooks";
import { vec2, type Vec2 } from "@kaiisuuwii/shared";
import type {
  LayoutDirection,
  LayoutGraphInput,
  LayoutNodeInput,
  LayoutResult,
  TreeLayoutOptions
} from "./types.js";
import { buildAdjacency, detectRoots } from "./utils.js";

// Compute the width of a subtree rooted at nodeId
const computeSubtreeWidths = (
  nodeId: string,
  adj: Map<string, string[]>,
  sizeMap: Map<string, Vec2>,
  nodePaddingX: number,
  widths: Map<string, number>,
  visited: Set<string>
): number => {
  visited.add(nodeId);
  const nodeW = (sizeMap.get(nodeId) ?? vec2(0, 0)).x;
  const children = (adj.get(nodeId) ?? []).filter((id) => !visited.has(id));

  if (children.length === 0) {
    widths.set(nodeId, nodeW);
    return nodeW;
  }

  let childrenTotalW = 0;
  for (const childId of children) {
    childrenTotalW += computeSubtreeWidths(
      childId,
      adj,
      sizeMap,
      nodePaddingX,
      widths,
      visited
    );
    childrenTotalW += nodePaddingX;
  }
  childrenTotalW -= nodePaddingX;

  const subtreeW = Math.max(nodeW, childrenTotalW);
  widths.set(nodeId, subtreeW);
  return subtreeW;
};

// Assign X/Y positions top-down using subtree width allocations
const assignPositions = (
  nodeId: string,
  adj: Map<string, string[]>,
  depth: number,
  sizeMap: Map<string, Vec2>,
  nodePaddingX: number,
  nodePaddingY: number,
  centerSubtrees: boolean,
  positions: Map<string, Vec2>,
  subtreeWidths: Map<string, number>,
  leftEdge: number,
  visited: Set<string>
): void => {
  visited.add(nodeId);
  const size = sizeMap.get(nodeId) ?? vec2(0, 0);
  const subtreeW = subtreeWidths.get(nodeId) ?? size.x;
  const children = (adj.get(nodeId) ?? []).filter((id) => !visited.has(id));
  const nodeY = depth * (size.y + nodePaddingY);

  if (children.length === 0) {
    positions.set(nodeId, vec2(leftEdge + (subtreeW - size.x) / 2, nodeY));
    return;
  }

  // Total width consumed by direct children
  const childrenTotalW =
    children.reduce((acc, cId) => acc + (subtreeWidths.get(cId) ?? 0), 0) +
    Math.max(0, children.length - 1) * nodePaddingX;

  // Left margin so children block is centered within the subtree allocation
  let childLeft = leftEdge + (subtreeW - childrenTotalW) / 2;

  for (const childId of children) {
    const childW = subtreeWidths.get(childId) ?? 0;
    assignPositions(
      childId,
      adj,
      depth + 1,
      sizeMap,
      nodePaddingX,
      nodePaddingY,
      centerSubtrees,
      positions,
      subtreeWidths,
      childLeft,
      visited
    );
    childLeft += childW + nodePaddingX;
  }

  if (centerSubtrees) {
    // Center parent over the mean of children center X positions
    let sumCx = 0;
    let count = 0;
    for (const childId of children) {
      const childPos = positions.get(childId);
      const childSize = sizeMap.get(childId) ?? vec2(0, 0);
      if (childPos !== undefined) {
        sumCx += childPos.x + childSize.x / 2;
        count += 1;
      }
    }
    const cx = count > 0 ? sumCx / count : leftEdge + subtreeW / 2;
    positions.set(nodeId, vec2(cx - size.x / 2, nodeY));
  } else {
    positions.set(nodeId, vec2(leftEdge + (subtreeW - size.x) / 2, nodeY));
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

export const runTreeLayout = (
  input: LayoutGraphInput,
  options: TreeLayoutOptions
): LayoutResult => {
  const start = performance.now();

  if (input.nodes.length === 0) {
    return { positions: [], algorithm: "tree", durationMs: performance.now() - start };
  }

  const adj = buildAdjacency(input.nodes, input.edges);
  const sizeMap = new Map<string, Vec2>(input.nodes.map((n) => [n.id, n.size]));

  // Detect roots
  let roots: string[];
  if (options.rootNodeId !== undefined) {
    roots = [options.rootNodeId];
  } else {
    roots = detectRoots(input.nodes, input.edges);
    if (roots.length === 0) {
      // Cyclic — pick first node as root
      const first = input.nodes[0];
      roots = first !== undefined ? [first.id] : [];
    }
  }

  // Compute subtree widths per root
  const subtreeWidths = new Map<string, number>();
  const widthVisited = new Set<string>();
  for (const rootId of roots) {
    computeSubtreeWidths(rootId, adj, sizeMap, options.nodePaddingX, subtreeWidths, widthVisited);
  }
  // Nodes not reachable from any root get their own width
  for (const node of input.nodes) {
    if (!subtreeWidths.has(node.id)) {
      subtreeWidths.set(node.id, node.size.x);
    }
  }

  // Assign positions for each root's tree, laid out side by side
  const positions = new Map<string, Vec2>();
  const posVisited = new Set<string>();
  let xOffset = 0;

  for (const rootId of roots) {
    const rootW = subtreeWidths.get(rootId) ?? 0;
    assignPositions(
      rootId,
      adj,
      0,
      sizeMap,
      options.nodePaddingX,
      options.nodePaddingY,
      options.centerSubtrees,
      positions,
      subtreeWidths,
      xOffset,
      posVisited
    );
    xOffset += rootW + options.nodePaddingX * 2;
  }

  // Disconnected nodes placed after the main forest
  for (const node of input.nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, vec2(xOffset, 0));
      xOffset += node.size.x + options.nodePaddingX * 2;
    }
  }

  const transformed = applyDirection(positions, options.direction);

  const result: Array<{ id: string; position: Vec2 }> = [];
  for (const node of input.nodes) {
    const pos = transformed.get(node.id);
    if (pos !== undefined) result.push({ id: node.id, position: pos });
  }

  return { positions: result, algorithm: "tree", durationMs: performance.now() - start };
};

// Exported for testing — returns max depth of the tree from root
export const computeTreeDepth = (
  rootId: string,
  adj: Map<string, string[]>,
  visited = new Set<string>()
): number => {
  if (visited.has(rootId)) return 0;
  visited.add(rootId);
  const children = (adj.get(rootId) ?? []).filter((id) => !visited.has(id));
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((cId) => computeTreeDepth(cId, adj, visited)));
};

// Exported for testing — returns which layer (depth) each node sits in
export const getNodeDepths = (
  rootId: string,
  adj: Map<string, string[]>,
  nodes: readonly LayoutNodeInput[]
): Map<string, number> => {
  const depths = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
  const visited = new Set<string>([rootId]);

  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) break;
    depths.set(item.id, item.depth);
    for (const childId of (adj.get(item.id) ?? []).filter((id) => !visited.has(id))) {
      visited.add(childId);
      queue.push({ id: childId, depth: item.depth + 1 });
    }
  }

  // Nodes not reachable from root
  for (const node of nodes) {
    if (!depths.has(node.id)) depths.set(node.id, 0);
  }

  return depths;
};
