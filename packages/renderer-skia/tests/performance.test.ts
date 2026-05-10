import {
  DEFAULT_VIRTUALIZATION_OPTIONS,
  getViewportBounds,
  resolveNodeLevelOfDetail
} from "@react-native-node-graph/renderer-skia";
import { vec2 } from "@react-native-node-graph/shared";
import { describe, expect, it } from "vitest";

describe("renderer-skia performance helpers", () => {
  it("derives graph-space viewport bounds from camera and viewport size", () => {
    expect(
      getViewportBounds(
        { width: 800, height: 600 },
        {
          position: vec2(120, 80),
          zoom: 2
        },
        40
      )
    ).toEqual({
      min: vec2(80, 40),
      max: vec2(560, 420)
    });
  });

  it("resolves LOD gates from zoom thresholds", () => {
    expect(resolveNodeLevelOfDetail(0.4, DEFAULT_VIRTUALIZATION_OPTIONS)).toEqual({
      zoom: 0.4,
      showLabel: false,
      showPorts: false,
      showDecorations: false
    });
    expect(resolveNodeLevelOfDetail(0.8, DEFAULT_VIRTUALIZATION_OPTIONS)).toEqual({
      zoom: 0.8,
      showLabel: true,
      showPorts: true,
      showDecorations: false
    });
  });
});
