import { performance } from "node:perf_hooks";

import { createCoreEngine, createGraphSnapshot, type GraphSnapshot } from "@kaiisuuwii/core";
import { createEdgeId, createGraphId, createNodeId, vec2 } from "@kaiisuuwii/shared";

import { createSkiaRenderPlan } from "./index.js";
import type { RendererViewport } from "./types.js";

export interface RendererBenchmarkScenario {
  readonly name:
    | "10k-nodes"
    | "50k-edges"
    | "100k-edge-traversal"
    | "rapid-mutation-replay";
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface RendererBenchmarkResult extends RendererBenchmarkScenario {
  readonly durationMs: number;
  readonly visibleNodeCount: number;
  readonly visibleEdgeCount: number;
}

const DEFAULT_VIEWPORT: RendererViewport = {
  width: 1440,
  height: 900
};

const createLargeGraphSnapshot = (nodeCount: number, edgeCount: number): GraphSnapshot => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeCount)));
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: createNodeId(`bench-node-${index}`),
    type: "bench",
    position: vec2((index % columns) * 220, Math.floor(index / columns) * 140),
    dimensions: vec2(180, 88),
    label: `Node ${index}`,
    ports: [
      {
        id: `port_bench_out_${index}` as const,
        name: "out",
        direction: "output" as const,
        dataType: "number"
      },
      {
        id: `port_bench_in_${index}` as const,
        name: "in",
        direction: "input" as const,
        dataType: "number"
      }
    ]
  }));
  const edges = Array.from({ length: edgeCount }, (_, index) => {
    const sourceIndex = index % nodeCount;
    const targetIndex = (index * 17 + 1) % nodeCount;

    return {
      id: createEdgeId(`bench-edge-${index}`),
      source: nodes[sourceIndex]!.id,
      target: nodes[targetIndex]!.id,
      sourcePortId: `port_bench_out_${sourceIndex}` as const,
      targetPortId: `port_bench_in_${targetIndex}` as const,
      dataType: "number"
    };
  });

  return createGraphSnapshot({
    id: createGraphId(`bench-${nodeCount}-${edgeCount}`),
    metadata: {
      name: `Benchmark ${nodeCount}/${edgeCount}`,
      version: "0.1.0",
      tags: ["benchmark"],
      createdAtIso: "2026-05-10T00:00:00.000Z"
    },
    nodes,
    edges,
    groups: []
  });
};

const measurePlanBuild = (snapshot: GraphSnapshot): RendererBenchmarkResult => {
  const startedAt = performance.now();
  const plan = createSkiaRenderPlan({
    snapshot,
    interaction: { onEvent: () => undefined },
    viewport: DEFAULT_VIEWPORT,
    camera: {
      position: vec2(0, 0),
      zoom: 0.6
    }
  });
  const durationMs = performance.now() - startedAt;

  return {
    name: snapshot.edges.length === 0 ? "10k-nodes" : "50k-edges",
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges.length,
    durationMs,
    visibleNodeCount: plan.scene.diagnostics.visibleNodeCount,
    visibleEdgeCount: plan.scene.diagnostics.visibleEdgeCount
  };
};

const measureEdgeTraversal = (snapshot: GraphSnapshot): RendererBenchmarkResult => {
  const plan = createSkiaRenderPlan({
    snapshot,
    interaction: { onEvent: () => undefined },
    viewport: DEFAULT_VIEWPORT,
    camera: {
      position: vec2(0, 0),
      zoom: 0.5
    }
  });
  const startedAt = performance.now();
  let traversalChecksum = 0;

  for (let index = 0; index < 100_000; index += 1) {
    const edge = plan.edges[index % plan.edges.length]!;
    traversalChecksum += edge.curve.start.x + edge.curve.end.y;
  }

  const durationMs = performance.now() - startedAt;

  return {
    name: "100k-edge-traversal",
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges.length + Math.trunc(traversalChecksum * 0),
    durationMs,
    visibleNodeCount: plan.scene.diagnostics.visibleNodeCount,
    visibleEdgeCount: plan.scene.diagnostics.visibleEdgeCount
  };
};

const measureRapidMutationReplay = (snapshot: GraphSnapshot): RendererBenchmarkResult => {
  const engine = createCoreEngine({
    graph: snapshot,
    nodeTypes: [{ type: "bench" }]
  });
  const startedAt = performance.now();

  for (let index = 0; index < 1_000; index += 1) {
    const node = snapshot.nodes[index % snapshot.nodes.length]!;

    engine.updateNode(node.id, {
      position: vec2(node.position.x + (index % 5), node.position.y + (index % 3))
    });
  }

  const durationMs = performance.now() - startedAt;
  const plan = createSkiaRenderPlan({
    snapshot: engine.getSnapshot(),
    interaction: { onEvent: () => undefined },
    viewport: DEFAULT_VIEWPORT,
    camera: {
      position: vec2(0, 0),
      zoom: 0.7
    }
  });

  return {
    name: "rapid-mutation-replay",
    nodeCount: plan.scene.snapshot.nodes.length,
    edgeCount: plan.scene.snapshot.edges.length,
    durationMs,
    visibleNodeCount: plan.scene.diagnostics.visibleNodeCount,
    visibleEdgeCount: plan.scene.diagnostics.visibleEdgeCount
  };
};

export const runRendererBenchmarkSuite = (): readonly RendererBenchmarkResult[] => {
  const nodesOnlySnapshot = createLargeGraphSnapshot(10_000, 0);
  const denseEdgeSnapshot = createLargeGraphSnapshot(2_000, 50_000);

  return [
    measurePlanBuild(nodesOnlySnapshot),
    {
      ...measurePlanBuild(denseEdgeSnapshot),
      name: "50k-edges"
    },
    measureEdgeTraversal(denseEdgeSnapshot),
    measureRapidMutationReplay(denseEdgeSnapshot)
  ];
};
