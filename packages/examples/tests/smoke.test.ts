import {
  EXAMPLE_FIXTURES,
  FOUNDATION_EXAMPLE_DOCUMENT,
  createExampleAppModel,
  createRendererFoundationExampleScreen,
  examplesManifest
} from "@kaiisuuwii/examples";
import { describe, expect, it } from "vitest";

describe("examples public api", () => {
  it("exposes the Sprint 08 example manifest entries", () => {
    expect(examplesManifest).toEqual(
      expect.arrayContaining([
        "small-graph",
        "medium-graph",
        "large-graph",
        "invalid-graph",
        "custom-node",
        "plugin-example",
        "cyclic-graph",
        "renderer-foundation-static"
      ])
    );
  });

  it("builds the example application model with focusable accessibility state", () => {
    const app = createExampleAppModel("small-graph");
    const plan = app.getRenderPlan();

    expect(plan.scene.theme.mode).toBe("light");
    expect(plan.scene.accessibility.focusOrder.length).toBeGreaterThan(0);
    expect(plan.scene.layers.map((layer) => layer.kind)).toContain("plugin");
    expect(app.getValidationResult().isValid).toBe(true);
    expect(EXAMPLE_FIXTURES["small-graph"].version).toBe(1);
  });

  it("builds the legacy renderer foundation screen on top of the new app model", async () => {
    const screen = createRendererFoundationExampleScreen();

    expect(FOUNDATION_EXAMPLE_DOCUMENT.version).toBe(1);
    expect(screen.id).toBe("renderer-foundation-static");
    expect(screen.snapshot.nodes).toHaveLength(3);
    expect(screen.rendererProps.viewport).toEqual({
      width: 1280,
      height: 720
    });
    expect(screen.editor.getRenderPlan().nodes).toHaveLength(3);
    expect(screen.editor.getRenderPlan().scene.layers.map((layer) => layer.kind)).toContain("plugin");
    await expect(screen.initialExecution?.result).resolves.toMatchObject({
      status: "completed"
    });
  });
});
