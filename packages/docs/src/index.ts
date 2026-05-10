export {
  accessibilityVerificationChecklist,
  documentationSections,
  releaseHardeningChecklist,
  type DocumentationSection
} from "./content.js";
export {
  createCoreApiExample,
  createPluginAuthoringExample,
  createRendererApiExample,
  createSerializationExample,
  documentationExamples
} from "./examples.js";

export const docsManifest = {
  sprint: "accessibility-docs-examples-release",
  sectionCount: 8,
  exampleCount: 4
} as const;
