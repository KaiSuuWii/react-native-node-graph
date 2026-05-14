import {
  addVec2,
  boundsFromPoints,
  createFallbackTextMeasurer,
  createEdgeId,
  createGraphId,
  createNodeId,
  isImageContent,
  isTextContent,
  scaleVec2,
  subtractVec2,
  type ImageContent,
  type TextContent,
  vec2
} from "@kaiisuuwii/shared";
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

describe("shared text helpers", () => {
  it("wraps text using the fallback measurer", () => {
    const result = createFallbackTextMeasurer().measure({
      text: "alpha beta gamma delta",
      fontSize: 10,
      fontWeight: "normal",
      fontStyle: "normal",
      maxWidth: 36,
      lineHeight: 1.4
    });

    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lineHeightPx).toBe(14);
    expect(result.truncated).toBe(false);
  });

  it("respects maxLines and reports truncation", () => {
    const result = createFallbackTextMeasurer().measure({
      text: "alpha beta gamma delta epsilon",
      fontSize: 10,
      fontWeight: "normal",
      fontStyle: "normal",
      maxWidth: 36,
      lineHeight: 1.4,
      maxLines: 2
    });

    expect(result.lines).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("detects text content payloads", () => {
    const value: TextContent = {
      kind: "text",
      value: "hello"
    };

    expect(isTextContent(value)).toBe(true);
    expect(isTextContent(null)).toBe(false);
    expect(isTextContent(undefined)).toBe(false);
    expect(isTextContent("string")).toBe(false);
    expect(isTextContent(42)).toBe(false);
  });

  it("detects image content payloads", () => {
    const value: ImageContent = {
      kind: "image",
      uri: "data:image/png;base64,AAAA"
    };

    expect(isImageContent(value)).toBe(true);
    expect(isImageContent(null)).toBe(false);
    expect(isImageContent(undefined)).toBe(false);
    expect(isImageContent("string")).toBe(false);
    expect(isImageContent(42)).toBe(false);
    expect(
      isImageContent({
        kind: "text",
        value: "hello"
      })
    ).toBe(false);
  });
});
