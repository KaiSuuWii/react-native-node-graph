import {
  FOUNDATION_EXAMPLE_DOCUMENT,
  createRendererFoundationExampleScreen,
  examplesManifest
} from "@react-native-node-graph/examples";
import { describe, expect, it } from "vitest";

describe("examples public api", () => {
  it("exposes the renderer foundation example manifest entry", () => {
    expect(examplesManifest).toContain("renderer-foundation-static");
  });

  it("builds a static renderer example screen from a serialized graph fixture", () => {
    const screen = createRendererFoundationExampleScreen();

    expect(FOUNDATION_EXAMPLE_DOCUMENT.version).toBe(1);
    expect(screen.id).toBe("renderer-foundation-static");
    expect(screen.snapshot.nodes).toHaveLength(3);
    expect(screen.rendererProps.viewport).toEqual({
      width: 1280,
      height: 720
    });
    expect(screen.editor.getRenderPlan().nodes).toHaveLength(3);
  });
});
