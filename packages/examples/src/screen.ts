import {
  createCoreEngine,
  type CoreEngine,
  type ExecutionRunHandle,
  type GraphDocumentEnvelope,
  type GraphPlugin,
  type GraphSnapshot,
  type ValidationResult
} from "@kaiisuuwii/core";
import {
  createRendererThemeController,
  createSkiaRenderPlan,
  type RendererPlugin,
  type RendererThemeMode,
  type RendererThemeScale,
  type SkiaRenderPlan
} from "@kaiisuuwii/renderer-skia";
import { vec2 } from "@kaiisuuwii/shared";
import {
  createAnnotationNodePlugin,
  createAnnotationRendererPlugin,
  createExecutableNodePlugin,
  createExecutableRendererPlugin
} from "@kaiisuuwii/plugins";

import {
  CUSTOM_NODE_EXAMPLE_DOCUMENT,
  EXAMPLE_FIXTURES,
  FOUNDATION_EXAMPLE_DOCUMENT,
  type ExampleFixtureId
} from "./fixtures.js";

export type ExampleMode = "engine" | "validation-only";

export interface ExampleDefinition {
  readonly id: ExampleFixtureId;
  readonly title: string;
  readonly description: string;
  readonly mode: ExampleMode;
  readonly document: GraphDocumentEnvelope;
  readonly createCorePlugins: () => readonly GraphPlugin[];
  readonly createRendererPlugins: () => readonly RendererPlugin[];
}

export interface ExampleDeveloperState {
  readonly selectedExampleId: ExampleFixtureId;
  readonly showValidationOverlay: boolean;
  readonly showDebugOverlay: boolean;
  readonly themeMode: RendererThemeMode;
  readonly themeScale: RendererThemeScale;
  readonly focusedTargetId: string | undefined;
}

export interface ExampleAppModel {
  readonly getExamples: () => readonly ExampleDefinition[];
  readonly getDeveloperState: () => ExampleDeveloperState;
  readonly getCurrentExample: () => ExampleDefinition;
  readonly getSnapshot: () => GraphSnapshot;
  readonly getValidationResult: () => ValidationResult;
  readonly getRenderPlan: () => SkiaRenderPlan;
  readonly getAccessibilityPolicy: () => readonly string[];
  readonly selectExample: (exampleId: ExampleFixtureId) => ExampleDefinition;
  readonly importGraph: (document: GraphDocumentEnvelope) => GraphSnapshot;
  readonly exportGraph: () => GraphDocumentEnvelope;
  readonly setThemeMode: (mode: RendererThemeMode) => ExampleDeveloperState;
  readonly setThemeScale: (scale: RendererThemeScale) => ExampleDeveloperState;
  readonly toggleDebugOverlay: () => ExampleDeveloperState;
  readonly toggleValidationOverlay: () => ExampleDeveloperState;
  readonly focusNext: () => string | undefined;
  readonly focusPrevious: () => string | undefined;
  readonly executeCurrentGraph: () => ExecutionRunHandle | undefined;
}

const EXAMPLE_DEFINITIONS: readonly ExampleDefinition[] = [
  {
    id: "small-graph",
    title: "Small Graph Fixture",
    description: "Minimal three-node pipeline for smoke coverage and quick UI checks.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["small-graph"],
    createCorePlugins: () => [createExecutableNodePlugin()],
    createRendererPlugins: () => [createExecutableRendererPlugin()]
  },
  {
    id: "medium-graph",
    title: "Medium Graph Fixture",
    description: "Longer execution chain used to test navigation and import/export.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["medium-graph"],
    createCorePlugins: () => [createExecutableNodePlugin()],
    createRendererPlugins: () => [createExecutableRendererPlugin()]
  },
  {
    id: "large-graph",
    title: "Large Graph Fixture",
    description: "Larger graph used to exercise diagnostics and scalable UI settings.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["large-graph"],
    createCorePlugins: () => [createExecutableNodePlugin()],
    createRendererPlugins: () => [createExecutableRendererPlugin()]
  },
  {
    id: "invalid-graph",
    title: "Invalid Graph Fixture",
    description: "Validation-only fixture with missing targets and broken selection references.",
    mode: "validation-only",
    document: EXAMPLE_FIXTURES["invalid-graph"],
    createCorePlugins: () => [createExecutableNodePlugin()],
    createRendererPlugins: () => [createExecutableRendererPlugin()]
  },
  {
    id: "custom-node",
    title: "Custom Node Example",
    description: "Demonstrates annotation nodes rendered through an external plugin.",
    mode: "engine",
    document: CUSTOM_NODE_EXAMPLE_DOCUMENT,
    createCorePlugins: () => [createExecutableNodePlugin(), createAnnotationNodePlugin()],
    createRendererPlugins: () => [
      createExecutableRendererPlugin(),
      createAnnotationRendererPlugin()
    ]
  },
  {
    id: "plugin-example",
    title: "Plugin Example",
    description: "Executable sample graph with both core and renderer plugin hooks enabled.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["plugin-example"],
    createCorePlugins: () => [createExecutableNodePlugin()],
    createRendererPlugins: () => [createExecutableRendererPlugin()]
  }
] as const;

const createValidationOverlayPlugin = (
  validationResult: ValidationResult
): RendererPlugin => ({
  name: "example-validation-overlay",
  createOverlays: ({ camera }) => {
    const messages = validationResult.isValid
      ? ["Validation: graph is valid."]
      : validationResult.errors.map((error) => `Validation: ${error.code}`);

    return messages.slice(0, 6).map((message, index) => ({
      id: `validation:${index}`,
      kind: "text" as const,
      label: `validation:${index}`,
      color: validationResult.isValid ? "#0f766e" : "#b91c1c",
      position: vec2(camera.position.x + 24, camera.position.y + 24 + index * 18),
      text: message
    }));
  }
});

const createEngineForExample = (example: ExampleDefinition): CoreEngine => {
  const engine = createCoreEngine({
    plugins: example.createCorePlugins()
  });

  engine.importGraph(example.document);
  return engine;
};

const findExample = (exampleId: ExampleFixtureId): ExampleDefinition =>
  EXAMPLE_DEFINITIONS.find((example) => example.id === exampleId) ?? EXAMPLE_DEFINITIONS[0]!;

export const createExampleAppModel = (
  initialExampleId: ExampleFixtureId = "plugin-example"
): ExampleAppModel => {
  const themeController = createRendererThemeController();
  let currentExample = findExample(initialExampleId);
  let engine = currentExample.mode === "engine" ? createEngineForExample(currentExample) : undefined;
  let importedDocument: GraphDocumentEnvelope | undefined;
  let developerState: ExampleDeveloperState = {
    selectedExampleId: currentExample.id,
    showValidationOverlay: true,
    showDebugOverlay: false,
    themeMode: themeController.getState().mode,
    themeScale: themeController.getState().scale,
    focusedTargetId: undefined
  };

  const getActiveDocument = (): GraphDocumentEnvelope =>
    importedDocument ?? currentExample.document;

  const getSnapshot = (): GraphSnapshot =>
    engine?.getSnapshot() ?? getActiveDocument().graph;

  const getValidationResult = (): ValidationResult => {
    if (engine !== undefined) {
      return engine.validateGraph();
    }

    const validationEngine = createCoreEngine({
      plugins: currentExample.createCorePlugins()
    });
    const result = validationEngine.validateGraph(getActiveDocument().graph);
    validationEngine.dispose();
    return result;
  };

  const getRenderPlan = (): SkiaRenderPlan => {
    const validationResult = getValidationResult();
    const rendererPlugins = [
      ...currentExample.createRendererPlugins(),
      ...(developerState.showValidationOverlay
        ? [createValidationOverlayPlugin(validationResult)]
        : [])
    ];

    return createSkiaRenderPlan({
      snapshot: getSnapshot(),
      interaction: {
        onEvent: () => undefined
      },
      viewport: {
        width: 1280,
        height: 720
      },
      camera: {
        position: vec2(0, 0),
        zoom: 1
      },
      themeMode: developerState.themeMode,
      themeScale: developerState.themeScale,
      plugins: rendererPlugins,
      debug: developerState.showDebugOverlay
        ? {
            enabled: true,
            showFpsOverlay: true,
            showRenderBounds: true,
            showHitRegions: true,
            showEdgeRouting: true
          }
        : {
            enabled: false
          },
      accessibility: {
        enabled: true,
        keyboardNavigationEnabled: true,
        screenReaderEnabled: true,
        scalableUiEnabled: true,
        ...(developerState.focusedTargetId !== undefined
          ? { focusTargetId: developerState.focusedTargetId }
          : {})
      }
    });
  };

  const focusByOffset = (offset: number): string | undefined => {
    const focusOrder = getRenderPlan().scene.accessibility.focusOrder;

    if (focusOrder.length === 0) {
      developerState = {
        ...developerState,
        focusedTargetId: undefined
      };
      return undefined;
    }

    const currentIndex =
      developerState.focusedTargetId === undefined
        ? -1
        : focusOrder.indexOf(developerState.focusedTargetId);
    const nextIndex =
      currentIndex < 0
        ? offset > 0
          ? 0
          : focusOrder.length - 1
        : (currentIndex + offset + focusOrder.length) % focusOrder.length;
    const nextTargetId = focusOrder[nextIndex];

    developerState = {
      ...developerState,
      focusedTargetId: nextTargetId
    };
    return nextTargetId;
  };

  const selectExample = (exampleId: ExampleFixtureId): ExampleDefinition => {
    currentExample = findExample(exampleId);
    importedDocument = undefined;
    engine?.dispose();
    engine = currentExample.mode === "engine" ? createEngineForExample(currentExample) : undefined;
    developerState = {
      ...developerState,
      selectedExampleId: exampleId,
      focusedTargetId: undefined
    };

    return currentExample;
  };

  return {
    getExamples: () => EXAMPLE_DEFINITIONS,
    getDeveloperState: () => ({ ...developerState }),
    getCurrentExample: () => currentExample,
    getSnapshot,
    getValidationResult,
    getRenderPlan,
    getAccessibilityPolicy: () => getRenderPlan().scene.accessibility.keyboardNavigationPolicy,
    selectExample,
    importGraph: (document) => {
      importedDocument = document;
      engine?.dispose();

      const draftEngine = createCoreEngine({
        plugins: currentExample.createCorePlugins()
      });
      const validation = draftEngine.validateGraph(document.graph);

      if (validation.isValid) {
        draftEngine.importGraph(document);
        engine = draftEngine;
      } else {
        draftEngine.dispose();
        engine = undefined;
      }

      developerState = {
        ...developerState,
        focusedTargetId: undefined
      };

      return getSnapshot();
    },
    exportGraph: () => engine?.exportGraph() ?? getActiveDocument(),
    setThemeMode: (mode) => {
      themeController.setMode(mode);
      developerState = {
        ...developerState,
        themeMode: mode
      };
      return developerState;
    },
    setThemeScale: (scale) => {
      themeController.setScale(scale);
      developerState = {
        ...developerState,
        themeScale: scale
      };
      return developerState;
    },
    toggleDebugOverlay: () => {
      developerState = {
        ...developerState,
        showDebugOverlay: !developerState.showDebugOverlay
      };
      return developerState;
    },
    toggleValidationOverlay: () => {
      developerState = {
        ...developerState,
        showValidationOverlay: !developerState.showValidationOverlay
      };
      return developerState;
    },
    focusNext: () => focusByOffset(1),
    focusPrevious: () => focusByOffset(-1),
    executeCurrentGraph: () => engine?.execute()
  };
};

export const createRendererFoundationExampleScreen = () => {
  const app = createExampleAppModel("plugin-example");
  const execution = app.executeCurrentGraph();

  return {
    id: "renderer-foundation-static",
    title: "Renderer Foundation Editing Harness",
    snapshot: FOUNDATION_EXAMPLE_DOCUMENT.graph,
    rendererProps: {
      snapshot: FOUNDATION_EXAMPLE_DOCUMENT.graph,
      interaction: {
        onEvent: () => undefined
      },
      viewport: {
        width: 1280,
        height: 720
      },
      themeMode: "light" as const,
      themeScale: "comfortable" as const
    },
    initialNodeCount: app.getRenderPlan().nodes.length,
    initialExecution: execution,
    editor: {
      getRenderPlan: app.getRenderPlan,
      selectNode: app.focusNext,
      clearSelection: app.focusPrevious,
      importGraph: app.importGraph,
      exportGraph: app.exportGraph
    },
    app
  };
};
