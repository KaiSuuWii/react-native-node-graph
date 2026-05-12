export {
  CUSTOM_NODE_EXAMPLE_DOCUMENT,
  EXAMPLE_FIXTURES,
  FOUNDATION_EXAMPLE_DOCUMENT,
  INVALID_GRAPH_EXAMPLE_DOCUMENT,
  LARGE_GRAPH_EXAMPLE_DOCUMENT,
  MEDIUM_GRAPH_EXAMPLE_DOCUMENT,
  PLUGIN_EXAMPLE_DOCUMENT,
  SMALL_GRAPH_EXAMPLE_DOCUMENT,
  createFoundationExampleSnapshot,
  type ExampleFixtureId
} from "./fixtures.js";
export {
  createCyclicExecutionScreen,
  createExampleAppModel,
  createLayoutDemoScreen,
  createRendererFoundationExampleScreen,
  createSvgExportScreen,
  type ExampleAppModel,
  type ExampleDefinition,
  type ExampleMode,
  type ExampleDeveloperState
} from "./screen.js";

export {
  CYCLIC_GRAPH_EXAMPLE_DOCUMENT,
  LAYOUT_DEMO_DOCUMENT,
  SVG_STATIC_EXPORT_DOCUMENT
} from "./fixtures.js";

export const examplesManifest = [
  "small-graph",
  "medium-graph",
  "large-graph",
  "invalid-graph",
  "custom-node",
  "plugin-example",
  "cyclic-graph",
  "svg-static-export",
  "renderer-foundation-static"
] as const;
