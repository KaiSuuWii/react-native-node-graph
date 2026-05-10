import { createSpatialIndex } from "@react-native-node-graph/renderer-skia";
import { vec2 } from "@react-native-node-graph/shared";
import { describe, expect, it } from "vitest";

describe("renderer-skia spatial index", () => {
  it("supports inserts and point queries", () => {
    const index = createSpatialIndex(64);

    index.insert({
      kind: "node",
      id: "node_a",
      bounds: {
        min: vec2(0, 0),
        max: vec2(100, 80)
      }
    });

    expect(index.queryPoint(vec2(20, 20))).toHaveLength(1);
    expect(index.queryPoint(vec2(200, 200))).toHaveLength(0);
  });

  it("updates entries and bounds queries deterministically", () => {
    const index = createSpatialIndex(64);

    index.insert({
      kind: "node",
      id: "node_a",
      bounds: {
        min: vec2(0, 0),
        max: vec2(50, 50)
      }
    });
    index.update({
      kind: "node",
      id: "node_a",
      bounds: {
        min: vec2(120, 120),
        max: vec2(180, 180)
      }
    });

    expect(index.queryBounds({ min: vec2(0, 0), max: vec2(60, 60) })).toHaveLength(0);
    expect(index.queryBounds({ min: vec2(100, 100), max: vec2(200, 200) })[0]?.id).toBe("node_a");
  });

  it("removes entries cleanly", () => {
    const index = createSpatialIndex(64);

    index.insert({
      kind: "edge",
      id: "edge_a",
      bounds: {
        min: vec2(20, 20),
        max: vec2(80, 80)
      }
    });

    expect(index.remove("edge", "edge_a")).toBe(true);
    expect(index.getEntries()).toHaveLength(0);
  });
});
