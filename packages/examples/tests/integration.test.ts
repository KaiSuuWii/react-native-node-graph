import {
  CYCLIC_GRAPH_EXAMPLE_DOCUMENT,
  INVALID_GRAPH_EXAMPLE_DOCUMENT,
  MEDIUM_GRAPH_EXAMPLE_DOCUMENT,
  PLUGIN_EXAMPLE_DOCUMENT,
  createCyclicExecutionScreen,
  createExampleAppModel,
  createSyncExampleScreen
} from "@kaiisuuwii/examples";
import { describe, expect, it } from "vitest";

describe("examples integration flows", () => {
  it("supports import and export actions through the example app model", () => {
    const app = createExampleAppModel("small-graph");
    const importedSnapshot = app.importGraph(MEDIUM_GRAPH_EXAMPLE_DOCUMENT);
    const exportedDocument = app.exportGraph();

    expect(importedSnapshot.nodes).toHaveLength(MEDIUM_GRAPH_EXAMPLE_DOCUMENT.graph.nodes.length);
    expect(exportedDocument.graph.nodes).toHaveLength(MEDIUM_GRAPH_EXAMPLE_DOCUMENT.graph.nodes.length);
    expect(exportedDocument.version).toBe(1);
  });

  it("switches theme state and drives deterministic focus navigation", () => {
    const app = createExampleAppModel("plugin-example");
    const firstFocus = app.focusNext();
    const secondFocus = app.focusNext();

    expect(firstFocus).toBeDefined();
    expect(secondFocus).toBeDefined();
    expect(secondFocus).not.toBe(firstFocus);
    expect(app.setThemeMode("dark").themeMode).toBe("dark");
    expect(app.setThemeScale("large").themeScale).toBe("large");
    expect(app.getRenderPlan().scene.theme.mode).toBe("dark");
    expect(app.getRenderPlan().scene.theme.scale).toBe("large");
  });

  it("keeps invalid imports in validation-only mode so overlays can report errors", () => {
    const app = createExampleAppModel("plugin-example");
    const snapshot = app.importGraph(INVALID_GRAPH_EXAMPLE_DOCUMENT);
    const validation = app.getValidationResult();

    expect(snapshot.nodes).toHaveLength(INVALID_GRAPH_EXAMPLE_DOCUMENT.graph.nodes.length);
    expect(validation.isValid).toBe(false);
    expect(app.getRenderPlan().scene.accessibility.announcements.length).toBeGreaterThan(0);
  });

  it("executes plugin-backed graphs from the example app model", async () => {
    const app = createExampleAppModel("plugin-example");
    app.importGraph(PLUGIN_EXAMPLE_DOCUMENT);

    await expect(app.executeCurrentGraph()?.result).resolves.toMatchObject({
      status: "completed"
    });
  });

  it("executes the cyclic example fixture to convergence", async () => {
    const screen = await createCyclicExecutionScreen();

    expect(screen.snapshot.id).toBe(CYCLIC_GRAPH_EXAMPLE_DOCUMENT.graph.id);
    expect(screen.status).toBe("completed");
    expect(screen.converged).toBe(true);
    expect(screen.iterationsRun).toBeGreaterThan(0);
    expect(screen.cycleGroups).toHaveLength(1);
  });

  it("converges the sync example across two in-process clients", async () => {
    const screen = await createSyncExampleScreen();

    expect(screen.user1NodeCount).toBe(screen.user2NodeCount);
    expect(screen.presenceCount).toBe(1);
  });
});
