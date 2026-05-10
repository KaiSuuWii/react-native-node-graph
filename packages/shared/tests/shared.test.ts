import {
  addVec2,
  boundsFromPoints,
  createEdgeId,
  createGraphId,
  createNodeId,
  scaleVec2,
  subtractVec2,
  vec2
} from "@react-native-node-graph/shared";
import { describe, expect, it } from "vitest";

describe("shared ids", () => {
  it("creates prefixed identifiers", () => {
    expect(createGraphId("alpha")).toMatch(/^graph_alpha_/);
    expect(createNodeId("alpha")).toMatch(/^node_alpha_/);
    expect(createEdgeId("alpha")).toMatch(/^edge_alpha_/);
  });

  it("maintains practical uniqueness across calls", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => createNodeId("smoke"))
    );

    expect(ids.size).toBe(50);
  });
});

describe("shared vector math", () => {
  it("adds, subtracts, and scales vectors", () => {
    const start = vec2(2, 3);
    const delta = vec2(4, -1);

    expect(addVec2(start, delta)).toEqual(vec2(6, 2));
    expect(subtractVec2(start, delta)).toEqual(vec2(-2, 4));
    expect(scaleVec2(start, 3)).toEqual(vec2(6, 9));
  });
});

describe("shared bounds helpers", () => {
  it("computes min and max extents from points", () => {
    expect(
      boundsFromPoints([vec2(-2, 4), vec2(5, -1), vec2(1, 8)])
    ).toEqual({
      min: vec2(-2, -1),
      max: vec2(5, 8)
    });
  });

  it("returns a zero bounds fallback for empty inputs", () => {
    expect(boundsFromPoints([])).toEqual({
      min: vec2(0, 0),
      max: vec2(0, 0)
    });
  });
});
