import {
  EXAMPLE_FIXTURES,
  FOUNDATION_EXAMPLE_DOCUMENT,
  createAnimatedEditorScreen,
  createExampleAppModel,
  createImageNodesScreen,
  createPersistenceExampleScreen,
  createRendererFoundationExampleScreen,
  createSyncExampleScreen,
  createTextNodesScreen,
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
        "image-nodes-graph",
        "text-nodes-graph",
        "renderer-foundation-static",
        "animated-editor-screen",
        "persistence-example",
        "sync-example"
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

  it("builds the text node example screen with measured body content", () => {
    const screen = createTextNodesScreen();

    expect(screen.snapshot.nodes).toHaveLength(3);
    expect(screen.renderPlan.nodes.some((node) => node.textContentItems.length > 0)).toBe(true);
    expect(screen.svgString).toContain("<tspan");
  });

  it("builds the image node example screen with image content states", () => {
    const screen = createImageNodesScreen();

    expect(screen.snapshot.nodes).toHaveLength(3);
    expect(screen.renderPlan.nodes.some((node) => node.imageContentItems.length > 0)).toBe(true);
    expect(screen.svgString).toContain("<image");
  });

  it("builds the animated editor screen on top of the react-native canvas integration", () => {
    const screen = createAnimatedEditorScreen();

    expect(screen.id).toBe("animated-editor-screen");
    expect(screen.renderPlan.nodes).toHaveLength(3);
    expect(screen.canvas.getRenderPlan().scene.layers.map((layer) => layer.kind)).toContain("node");
    screen.canvas.dispose();
  });

  it("builds the persistence example screen with a saved round-trip", async () => {
    const screen = await createPersistenceExampleScreen();

    expect(screen.id).toBe("persistence-example");
    expect(screen.originalNodeCount).toBe(3);
    expect(screen.loadedNodeCount).toBe(3);
    expect(typeof screen.savedAt).toBe("string");
  });

  it("builds the sync example screen with two converged engines", async () => {
    const screen = await createSyncExampleScreen();

    expect(screen.id).toBe("sync-example");
    expect(screen.user1NodeCount).toBe(1);
    expect(screen.user2NodeCount).toBe(1);
    expect(screen.presenceCount).toBe(1);
  });
});
