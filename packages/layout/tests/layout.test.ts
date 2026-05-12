import { vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";

import {
  applyLayout,
  applyResultToEngine,
  buildAdjacency,
  createIncrementalLayout,
  detectRoots,
  graphInputFromSnapshot,
  LayoutError,
  runForceDirectedLayout,
  runLayeredLayout,
  runRadialLayout,
  runTreeLayout
} from "../src/index.js";
import type {
  ForceDirectedLayoutOptions,
  LayoutEdgeInput,
  LayoutGraphInput,
  LayoutNodeInput
} from "../src/index.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const node = (id: string, w = 120, h = 60): LayoutNodeInput => ({
  id,
  size: vec2(w, h)
});

const edge = (id: string, src: string, tgt: string): LayoutEdgeInput => ({
  id,
  sourceNodeId: src,
  targetNodeId: tgt
});

const dag = (nodeCount: number): LayoutGraphInput => ({
  nodes: Array.from({ length: nodeCount }, (_, i) => node(`n${i}`)),
  edges: Array.from({ length: Math.max(0, nodeCount - 1) }, (_, i) => edge(`e${i}`, `n${i}`, `n${i + 1}`))
});

const DEFAULT_FORCE_OPTS: ForceDirectedLayoutOptions = {
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
};

// ─── utils: graphInputFromSnapshot ──────────────────────────────────────────

describe("graphInputFromSnapshot", () => {
  it("maps nodes and edges correctly", () => {
    const snapshot = {
      nodes: [
        { id: "node_a", dimensions: vec2(200, 80) },
        { id: "node_b", dimensions: vec2(160, 60) }
      ],
      edges: [{ id: "edge_ab", source: "node_a", target: "node_b" }]
    };

    const result = graphInputFromSnapshot(snapshot);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toEqual({ id: "node_a", size: vec2(200, 80) });
    expect(result.nodes[1]).toEqual({ id: "node_b", size: vec2(160, 60) });
    expect(result.edges[0]).toEqual({
      id: "edge_ab",
      sourceNodeId: "node_a",
      targetNodeId: "node_b"
    });
  });
});

// ─── utils: detectRoots ─────────────────────────────────────────────────────

describe("detectRoots", () => {
  it("returns only nodes with no incoming edges", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    expect(detectRoots(nodes, edges)).toEqual(["a"]);
  });

  it("returns all nodes when there are no edges", () => {
    const nodes = [node("x"), node("y")];
    expect(detectRoots(nodes, [])).toEqual(["x", "y"]);
  });
});

// ─── utils: buildAdjacency ──────────────────────────────────────────────────

describe("buildAdjacency", () => {
  it("builds correct adjacency lists", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")];

    const adj = buildAdjacency(nodes, edges);

    expect(adj.get("a")).toEqual(["b", "c"]);
    expect(adj.get("b")).toEqual([]);
    expect(adj.get("c")).toEqual([]);
  });
});

// ─── runLayeredLayout ────────────────────────────────────────────────────────

describe("runLayeredLayout", () => {
  it("returns positions for all nodes in a DAG", () => {
    const result = runLayeredLayout(dag(5), {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: true
    });

    expect(result.algorithm).toBe("layered");
    expect(result.positions).toHaveLength(5);
  });

  it("layer assignment is monotonically increasing along edge direction", () => {
    const input = dag(5);
    const result = runLayeredLayout(input, {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: false
    });

    const posById = new Map(result.positions.map((p) => [p.id, p.position]));
    for (const e of input.edges) {
      const srcY = posById.get(e.sourceNodeId)?.y ?? 0;
      const tgtY = posById.get(e.targetNodeId)?.y ?? 0;
      expect(tgtY).toBeGreaterThan(srcY);
    }
  });

  it("node positions do not overlap within a layer", () => {
    const input: LayoutGraphInput = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [] // all nodes in layer 0
    };

    const result = runLayeredLayout(input, {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: false
    });

    const xs = result.positions.map((p) => p.position.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const prev = xs[i - 1] ?? 0;
      const curr = xs[i] ?? 0;
      expect(curr - prev).toBeGreaterThan(0);
    }
  });

  it("handles cyclic graphs without crashing", () => {
    const input: LayoutGraphInput = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "a")]
    };
    expect(() => runLayeredLayout(input, {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: true
    })).not.toThrow();
  });
});

// ─── runForceDirectedLayout ──────────────────────────────────────────────────

describe("runForceDirectedLayout", () => {
  it("spreads 50 nodes (average inter-node distance ≥ 80)", () => {
    const input = dag(50);
    const result = runForceDirectedLayout(input, DEFAULT_FORCE_OPTS);

    expect(result.algorithm).toBe("force-directed");
    expect(result.positions).toHaveLength(50);

    // Sample a few pairs and verify average separation
    const positions = result.positions;
    let totalDist = 0;
    let sampleCount = 0;
    for (let i = 0; i < positions.length && sampleCount < 20; i++) {
      for (let j = i + 1; j < positions.length && sampleCount < 20; j++) {
        const a = positions[i];
        const b = positions[j];
        if (a === undefined || b === undefined) continue;
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
        sampleCount += 1;
      }
    }
    const avgDist = sampleCount > 0 ? totalDist / sampleCount : 0;
    expect(avgDist).toBeGreaterThanOrEqual(80);
  });

  it("fixed nodes do not move", () => {
    const input: LayoutGraphInput = {
      nodes: [
        { id: "fixed", size: vec2(100, 60), fixed: true, initialPosition: vec2(999, 999) },
        node("free")
      ],
      edges: [edge("e1", "fixed", "free")]
    };

    const result = runForceDirectedLayout(input, DEFAULT_FORCE_OPTS);
    const fixedPos = result.positions.find((p) => p.id === "fixed")?.position;

    expect(fixedPos?.x).toBeCloseTo(999);
    expect(fixedPos?.y).toBeCloseTo(999);
  });

  it("returns iterationsRun and converged flags", () => {
    const result = runForceDirectedLayout(dag(5), DEFAULT_FORCE_OPTS);
    expect(result.iterationsRun).toBeGreaterThan(0);
    expect(typeof result.converged).toBe("boolean");
  });
});

// ─── runTreeLayout ───────────────────────────────────────────────────────────

describe("runTreeLayout", () => {
  const treeOpts = {
    algorithm: "tree" as const,
    direction: "top-bottom" as const,
    nodePaddingX: 40,
    nodePaddingY: 80,
    edgeRouting: "curved" as const,
    centerSubtrees: true
  };

  it("places all nodes and sets algorithm", () => {
    const result = runTreeLayout(dag(7), treeOpts);
    expect(result.algorithm).toBe("tree");
    expect(result.positions).toHaveLength(7);
  });

  it("all nodes at the same depth share the same Y (top-bottom)", () => {
    // Binary-ish tree: n0 → n1, n0 → n2, n1 → n3
    const input: LayoutGraphInput = {
      nodes: [node("n0"), node("n1"), node("n2"), node("n3")],
      edges: [edge("e1", "n0", "n1"), edge("e2", "n0", "n2"), edge("e3", "n1", "n3")]
    };

    const result = runTreeLayout(input, treeOpts);
    const posById = new Map(result.positions.map((p) => [p.id, p.position]));

    // n1 and n2 are both at depth 1 — same Y
    const y1 = posById.get("n1")?.y ?? 0;
    const y2 = posById.get("n2")?.y ?? 0;
    expect(y1).toBeCloseTo(y2);

    // Root is above children
    const y0 = posById.get("n0")?.y ?? 0;
    expect(y1).toBeGreaterThan(y0);
  });

  it("parent node X is the centroid of its children X positions (center-subtrees)", () => {
    const input: LayoutGraphInput = {
      nodes: [node("root"), node("left"), node("right")],
      edges: [edge("e1", "root", "left"), edge("e2", "root", "right")]
    };

    const result = runTreeLayout(input, treeOpts);
    const posById = new Map(result.positions.map((p) => [p.id, p.position]));

    const rootPos = posById.get("root");
    const leftPos = posById.get("left");
    const rightPos = posById.get("right");

    expect(rootPos).toBeDefined();
    expect(leftPos).toBeDefined();
    expect(rightPos).toBeDefined();

    if (rootPos !== undefined && leftPos !== undefined && rightPos !== undefined) {
      const nodeW = 120;
      const childCenterX = (leftPos.x + nodeW / 2 + rightPos.x + nodeW / 2) / 2;
      expect(rootPos.x + nodeW / 2).toBeCloseTo(childCenterX, 0);
    }
  });
});

// ─── runRadialLayout ─────────────────────────────────────────────────────────

describe("runRadialLayout", () => {
  const radialOpts = {
    algorithm: "radial" as const,
    centerNodeId: "n0",
    radiusStep: 120,
    startAngle: 0,
    edgeRouting: "curved" as const
  };

  it("places all nodes", () => {
    const result = runRadialLayout(dag(7), radialOpts);
    expect(result.algorithm).toBe("radial");
    expect(result.positions).toHaveLength(7);
  });

  it("center node is at approximately vec2(0, 0) adjusted for node size", () => {
    const result = runRadialLayout(dag(5), radialOpts);
    const centerPos = result.positions.find((p) => p.id === "n0")?.position;

    // Center node top-left is at -size/2
    expect(centerPos).toBeDefined();
    if (centerPos !== undefined) {
      expect(Math.abs(centerPos.x)).toBeLessThan(100);
      expect(Math.abs(centerPos.y)).toBeLessThan(100);
    }
  });

  it("all ring-1 nodes are equidistant from origin", () => {
    // Star: n0 → n1, n0 → n2, n0 → n3
    const input: LayoutGraphInput = {
      nodes: [node("n0"), node("n1"), node("n2"), node("n3")],
      edges: [edge("e1", "n0", "n1"), edge("e2", "n0", "n2"), edge("e3", "n0", "n3")]
    };

    const result = runRadialLayout(input, {
      algorithm: "radial",
      centerNodeId: "n0",
      radiusStep: 120,
      startAngle: 0,
      edgeRouting: "curved"
    });

    const posById = new Map(result.positions.map((p) => [p.id, p.position]));

    const nodeHalfW = 60; // size.x / 2
    const nodeHalfH = 30; // size.y / 2
    const ringNodes = ["n1", "n2", "n3"];
    const distances = ringNodes.map((id) => {
      const p = posById.get(id);
      if (p === undefined) return 0;
      // Compute distance from center of node to origin
      const cx = p.x + nodeHalfW;
      const cy = p.y + nodeHalfH;
      return Math.sqrt(cx * cx + cy * cy);
    });

    const first = distances[0] ?? 0;
    for (const d of distances) {
      expect(d).toBeCloseTo(first, 0);
    }
  });
});

// ─── applyLayout (dispatcher + error) ────────────────────────────────────────

describe("applyLayout", () => {
  it("dispatches to the correct algorithm", () => {
    const result = applyLayout(dag(3), {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: true
    });
    expect(result.algorithm).toBe("layered");
  });

  it("throws LayoutError for unknown algorithm value", () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyLayout(dag(2), { algorithm: "unknown" } as any)
    ).toThrow(LayoutError);
  });
});

// ─── applyResultToEngine (integration) ────────────────────────────────────────

describe("applyResultToEngine integration", () => {
  it("applyLayout → applyResultToEngine applies all positions", () => {
    const input = dag(5);
    const result = applyLayout(input, {
      algorithm: "layered",
      direction: "top-bottom",
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved",
      centerGraph: true
    });

    const applied = new Map<string, { x: number; y: number }>();
    applyResultToEngine(result, {
      updateNode: (input: { id: string; position: { x: number; y: number } }) => {
        applied.set(input.id, input.position);
      }
    });

    expect(applied.size).toBe(5);
    for (const [, pos] of applied) {
      // Positions should be finite numbers (not all zero since centerGraph: true)
      expect(isFinite(pos.x)).toBe(true);
      expect(isFinite(pos.y)).toBe(true);
    }
  });
});

// ─── incremental force-directed ───────────────────────────────────────────────

describe("createIncrementalLayout", () => {
  it("can be stepped frame-by-frame", () => {
    const engine = createIncrementalLayout(dag(5), DEFAULT_FORCE_OPTS);

    const state0 = engine.getState();
    expect(state0.iteration).toBe(0);

    engine.step();
    const state1 = engine.getState();
    expect(state1.iteration).toBe(1);

    engine.step();
    const state2 = engine.getState();
    expect(state2.iteration).toBe(2);
  });

  it("run() returns a result with iterationsRun > 0", () => {
    const engine = createIncrementalLayout(dag(10), DEFAULT_FORCE_OPTS);
    const result = engine.run();
    expect((result.iterationsRun ?? 0)).toBeGreaterThan(0);
  });

  it("setPositions warm-starts from provided positions", () => {
    const engine = createIncrementalLayout(dag(3), DEFAULT_FORCE_OPTS);
    const warmStart = new Map<string, { x: number; y: number }>([
      ["n0", vec2(100, 100)],
      ["n1", vec2(200, 100)],
      ["n2", vec2(300, 100)]
    ]);
    engine.setPositions(warmStart);

    const state = engine.getState();
    expect(state.iteration).toBe(0);
    expect(state.positions.get("n0")).toEqual(vec2(100, 100));
  });
});

// ─── benchmark smoke ──────────────────────────────────────────────────────────

describe("benchmark smoke", () => {
  it("1k-nodes-layered completes in under 500ms", () => {
    const nodes: LayoutNodeInput[] = Array.from({ length: 1000 }, (_, i) =>
      node(`n${i}`)
    );
    const edges: LayoutEdgeInput[] = Array.from({ length: 1200 }, (_, i) => {
      const src = i % 1000;
      const tgt = Math.min((i % 1000) + 1 + (i % 3), 999);
      return edge(`e${i}`, `n${src}`, `n${tgt}`);
    });

    const t0 = Date.now();
    const result = runLayeredLayout(
      { nodes, edges },
      {
        algorithm: "layered",
        direction: "top-bottom",
        nodePaddingX: 40,
        nodePaddingY: 60,
        rankSeparation: 20,
        edgeRouting: "curved",
        centerGraph: true
      }
    );
    const elapsed = Date.now() - t0;

    expect(result.positions).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500);
  }, 10000);
});

// ─── architecture: no forbidden imports ─────────────────────────────────────

describe("architecture: layout imports", () => {
  it("does not import from core, any renderer, react, or skia", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const srcDir = path.resolve(process.cwd(), "packages/layout/src");
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

    const forbidden = [
      "@kaiisuuwii/core",
      "@kaiisuuwii/renderer-skia",
      "@kaiisuuwii/renderer-svg",
      "@kaiisuuwii/renderer-web",
      "react-native",
      "@shopify/react-native-skia",
      "react"
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), "utf8");
      for (const pkg of forbidden) {
        const pattern = new RegExp(
          `from\\s+["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`
        );
        expect(pattern.test(content), `${file} should not import from ${pkg}`).toBe(false);
      }
    }
  });
});
