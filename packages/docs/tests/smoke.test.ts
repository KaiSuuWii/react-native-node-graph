import {
  accessibilityVerificationChecklist,
  createCoreApiExample,
  createPluginAuthoringExample,
  createRendererApiExample,
  createSerializationExample,
  docsManifest,
  documentationSections,
  releaseHardeningChecklist
} from "@react-native-node-graph/docs";
import { describe, expect, it } from "vitest";

describe("docs public api", () => {
  it("exposes Sprint 08 documentation metadata", () => {
    expect(docsManifest).toEqual({
      sprint: "accessibility-docs-examples-release",
      sectionCount: 8,
      exampleCount: 4
    });
    expect(documentationSections).toHaveLength(8);
    expect(accessibilityVerificationChecklist).toHaveLength(4);
    expect(releaseHardeningChecklist).toHaveLength(5);
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
});
