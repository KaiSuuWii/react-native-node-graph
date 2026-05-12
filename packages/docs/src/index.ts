export {
  accessibilityVerificationChecklist,
  documentationSections,
  releaseHardeningChecklist,
  type DocumentationSection
} from "./content.js";
export {
  createCoreApiExample,
  createCyclicExecutionExample,
  createPluginAuthoringExample,
  createRendererApiExample,
  createSerializationExample,
  createSvgRendererExample,
  documentationExamples
} from "./examples.js";

export const docsManifest = {
  sprint: "cyclic-execution",
  sectionCount: 10,
  exampleCount: 6
} as const;
