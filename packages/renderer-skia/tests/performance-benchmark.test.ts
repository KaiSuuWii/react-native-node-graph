import { runRendererBenchmarkSuite } from "@react-native-node-graph/renderer-skia";
import { describe, expect, it } from "vitest";

describe("renderer-skia benchmark harness", () => {
  it("runs the fixed Sprint 06 benchmark scenarios", () => {
    const results = runRendererBenchmarkSuite();

    expect(results.map((result) => result.name)).toEqual([
      "10k-nodes",
      "50k-edges",
      "100k-edge-traversal",
      "rapid-mutation-replay"
    ]);
    expect(results[0]?.nodeCount).toBe(10_000);
    expect(results[1]?.edgeCount).toBe(50_000);
    expect(results[2]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(results[3]?.visibleNodeCount).toBeGreaterThan(0);
  }, 60000);
});
