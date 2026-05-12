import {
  accessibilityVerificationChecklist,
  createCoreApiExample,
  createCyclicExecutionExample,
  createPluginAuthoringExample,
  createRendererApiExample,
  createSerializationExample,
  createSvgRendererExample,
  docsManifest,
  documentationSections,
  releaseHardeningChecklist
} from "@kaiisuuwii/docs";
import { describe, expect, it } from "vitest";

describe("docs public api", () => {
  it("exposes Sprint 11 documentation metadata", () => {
    expect(docsManifest).toEqual({
      sprint: "cyclic-execution",
      sectionCount: 10,
      exampleCount: 6
    });
    expect(documentationSections).toHaveLength(10);
    expect(accessibilityVerificationChecklist).toHaveLength(4);
    expect(releaseHardeningChecklist).toHaveLength(5);
  });

  it("validates svg renderer example", () => {
    const result = createSvgRendererExample();

    expect(result.isValidSvg).toBe(true);
    expect(result.visibleNodeCount).toBeGreaterThan(0);
    expect(result.layerKinds).toContain("node");
    expect(result.layerKinds).toContain("edge");
  });

  it("validates core, renderer, plugin, and serialization examples against real APIs", () => {
    expect(createCoreApiExample()).toMatchObject({
      nodeCount: 3,
      edgeCount: 2,
      selectionMode: "node"
    });
    expect(createRendererApiExample()).toMatchObject({
      themeMode: "dark"
    });
    expect(createPluginAuthoringExample()).toMatchObject({
      canExport: true
    });
    expect(createSerializationExample()).toMatchObject({
      exportedVersion: 1,
      exportedNodeCount: 1
    });
  });

  it("validates the cyclic execution example against the real API", async () => {
    await expect(createCyclicExecutionExample()).resolves.toMatchObject({
      status: "completed",
      converged: true,
      cycleGroupCount: 1
    });
  });
});
