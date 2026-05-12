import { describe, it } from "vitest";
import { vec2 } from "@kaiisuuwii/shared";
import {
  runLayeredLayout,
  runForceDirectedLayout,
  runTreeLayout
} from "../src/index.js";
import type { LayoutEdgeInput, LayoutNodeInput } from "../src/index.js";

const n = (id: string): LayoutNodeInput => ({ id, size: vec2(120, 60) });
const e = (id: string, src: string, tgt: string): LayoutEdgeInput => ({
  id,
  sourceNodeId: src,
  targetNodeId: tgt
});

const dagInput = (nodeCount: number, edgeCount: number) => {
  const nodes = Array.from({ length: nodeCount }, (_, i) => n(`n${i}`));
  const edges = Array.from({ length: Math.min(edgeCount, nodeCount - 1) }, (_, i) => {
    const src = i % nodeCount;
    const tgt = Math.min(src + 1 + (i % 4), nodeCount - 1);
    return e(`e${i}`, `n${src}`, `n${tgt}`);
  });
  return { nodes, edges };
};

const binaryTree = (depth: number) => {
  const nodes: LayoutNodeInput[] = [];
  const edges: LayoutEdgeInput[] = [];
  const total = Math.pow(2, depth + 1) - 1;
  for (let i = 0; i < total; i++) nodes.push(n(`t${i}`));
  for (let i = 0; i < Math.floor(total / 2); i++) {
    edges.push(e(`te${i * 2}`, `t${i}`, `t${2 * i + 1}`));
    edges.push(e(`te${i * 2 + 1}`, `t${i}`, `t${2 * i + 2}`));
  }
  return { nodes, edges };
};

describe("layout benchmarks", () => {
  it("1k-nodes-layered (1000 nodes, 1200 edges)", () => {
    const input = dagInput(1000, 1200);
    const t0 = performance.now();
    const result = runLayeredLayout(input, {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: true
    });
    const ms = performance.now() - t0;
    console.log(`1k-nodes-layered: ${ms.toFixed(1)}ms, positions=${result.positions.length}`);
  }, 30000);

  it("1k-nodes-force (1000 nodes, 1200 edges, 300 iterations)", () => {
    const input = dagInput(1000, 1200);
    const t0 = performance.now();
    const result = runForceDirectedLayout(input, {
      algorithm: "force-directed",
      iterations: 300,
      convergenceThreshold: 0.5,
      repulsionStrength: 8000,
      attractionStrength: 0.1,
      idealEdgeLength: 150,
      gravity: 0.05,
      cooling: 0.98,
      initialTemperature: 200,
      edgeRouting: "curved"
    });
    const ms = performance.now() - t0;
    console.log(
      `1k-nodes-force: ${ms.toFixed(1)}ms, iterations=${result.iterationsRun ?? 0}, converged=${result.converged ?? false}`
    );
  }, 60000);

  it("5k-nodes-force (5000 nodes, force-directed until convergence)", () => {
    const input = dagInput(5000, 5000);
    const t0 = performance.now();
    const result = runForceDirectedLayout(input, {
      algorithm: "force-directed",
      iterations: 300,
      convergenceThreshold: 0.5,
      repulsionStrength: 8000,
      attractionStrength: 0.05,
      idealEdgeLength: 150,
      gravity: 0.05,
      cooling: 0.98,
      initialTemperature: 200,
      edgeRouting: "curved"
    });
    const ms = performance.now() - t0;
    console.log(
      `5k-nodes-force: ${ms.toFixed(1)}ms, iterations=${result.iterationsRun ?? 0}, converged=${result.converged ?? false}`
    );
  }, 120000);

  it("sparse-tree (binary tree, 511 nodes)", () => {
    const input = binaryTree(8); // 2^9 - 1 = 511 nodes
    const t0 = performance.now();
    const result = runTreeLayout(input, {
      algorithm: "tree",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 80,
      edgeRouting: "curved",
      centerSubtrees: true
    });
    const ms = performance.now() - t0;
    console.log(`sparse-tree: ${ms.toFixed(1)}ms, positions=${result.positions.length}`);
  }, 10000);
});
