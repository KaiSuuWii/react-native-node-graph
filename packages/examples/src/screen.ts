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
  createImageLoader,
  createRendererImageCache,
  createRendererThemeController,
  createSkiaRenderPlan,
  createSkiaTextMeasurer,
  type RendererPlugin,
  type RendererThemeMode,
  type RendererThemeScale,
  type SkiaRenderPlan
} from "@kaiisuuwii/renderer-skia";
import {
  createSvgRenderPlan,
  serializeSvgRenderPlan
} from "@kaiisuuwii/renderer-svg";
import { vec2 } from "@kaiisuuwii/shared";
import {
  applyLayout,
  graphInputFromSnapshot,
  type LayoutAlgorithm
} from "@kaiisuuwii/layout";
import {
  createAnnotationNodePlugin,
  createAnnotationRendererPlugin,
  createExecutableNodePlugin,
  createExecutableRendererPlugin,
  createImageNodePlugin,
  createImageRendererPlugin,
  createTextNodePlugin,
  createTextRendererPlugin
} from "@kaiisuuwii/plugins";
import {
  createGraphPersistence,
  createMemoryAdapter
} from "@kaiisuuwii/persistence";
import { createGraphSync, type SyncAdapter, type SyncConnectionState } from "@kaiisuuwii/sync";
import { NodeGraphCanvas } from "@kaiisuuwii/react-native";
import * as Y from "yjs";

import type { NodeTypeDefinition } from "@kaiisuuwii/core";

import {
  CUSTOM_NODE_EXAMPLE_DOCUMENT,
  CYCLIC_GRAPH_EXAMPLE_DOCUMENT,
  EXAMPLE_FIXTURES,
  FOUNDATION_EXAMPLE_DOCUMENT,
  IMAGE_NODES_GRAPH_EXAMPLE_DOCUMENT,
  LAYOUT_DEMO_DOCUMENT,
  SVG_STATIC_EXPORT_DOCUMENT,
  TEXT_NODES_GRAPH_EXAMPLE_DOCUMENT,
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
  },
  {
    id: "cyclic-graph",
    title: "Cyclic Graph Fixture",
    description: "Fixed-point cyclic execution demo with convergence reporting enabled.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["cyclic-graph"],
    createCorePlugins: () => [],
    createRendererPlugins: () => []
  },
  {
    id: "svg-static-export",
    title: "SVG Static Export",
    description: "Demonstrates the SVG renderer producing a static SVG string for server-side export.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["svg-static-export"],
    createCorePlugins: () => [createExecutableNodePlugin()],
    createRendererPlugins: () => [createExecutableRendererPlugin()]
  },
  {
    id: "image-nodes-graph",
    title: "Image Nodes Graph",
    description: "Demonstrates inline, loading, and failed image content states in thumbnail nodes.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["image-nodes-graph"],
    createCorePlugins: () => [createImageNodePlugin()],
    createRendererPlugins: () => [createImageRendererPlugin()]
  },
  {
    id: "text-nodes-graph",
    title: "Text Nodes Graph",
    description: "Demonstrates wrapped node body text, truncation, and inline editing state.",
    mode: "engine",
    document: EXAMPLE_FIXTURES["text-nodes-graph"],
    createCorePlugins: () => [createTextNodePlugin()],
    createRendererPlugins: () => [createTextRendererPlugin()]
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

const cyclicSourceNodeType: NodeTypeDefinition = {
  type: "cyclic-source",
  execution: {
    execute: ({ node, inputs }) => {
      const external =
        typeof node.properties.externalValue === "number" ? node.properties.externalValue : 1.0;
      const feedback = typeof inputs.port_a_feedback === "number" ? inputs.port_a_feedback : 0;
      return { port_a_out: external + 0.5 * feedback };
    }
  }
};

const cyclicPassthroughNodeType: NodeTypeDefinition = {
  type: "cyclic-passthrough",
  execution: {
    execute: ({ inputs }) => ({
      port_b_out: typeof inputs.port_b_in === "number" ? inputs.port_b_in : 0
    })
  }
};

const cyclicDampenNodeType: NodeTypeDefinition = {
  type: "cyclic-dampen",
  execution: {
    execute: ({ node, inputs }) => {
      const factor = typeof node.properties.factor === "number" ? node.properties.factor : 0.5;
      const value = typeof inputs.port_c_in === "number" ? inputs.port_c_in : 0;
      return { port_c_out: value * factor };
    }
  }
};

const syncNodeType: NodeTypeDefinition = {
  type: "sync-node"
};

type InMemoryRoomPeer = {
  readonly provider: {
    readonly ydoc: Y.Doc;
  };
  connected: boolean;
  updateHandler: ((update: Uint8Array, origin: unknown) => void) | undefined;
};

const IN_MEMORY_SYNC_ROOMS = new Map<string, Set<InMemoryRoomPeer>>();

const getInMemoryRoom = (roomId: string): Set<InMemoryRoomPeer> => {
  const room = IN_MEMORY_SYNC_ROOMS.get(roomId);

  if (room !== undefined) {
    return room;
  }

  const nextRoom = new Set<InMemoryRoomPeer>();
  IN_MEMORY_SYNC_ROOMS.set(roomId, nextRoom);
  return nextRoom;
};

const createInMemorySyncAdapter = (roomId: string, ydoc: Y.Doc): SyncAdapter => {
  const provider = { ydoc };
  const peer: InMemoryRoomPeer = {
    provider,
    connected: false,
    updateHandler: undefined
  };
  let state: SyncConnectionState = "disconnected";
  const listeners = new Set<(nextState: SyncConnectionState) => void>();

  const emit = (nextState: SyncConnectionState): void => {
    state = nextState;
    listeners.forEach((listener) => {
      listener(nextState);
    });
  };

  return {
    id: "in-memory",
    provider,
    connect: async () => {
      const room = getInMemoryRoom(roomId);
      room.add(peer);

      const forwardUpdate = (update: Uint8Array, origin: unknown): void => {
        if (origin === peer) {
          return;
        }

        room.forEach((candidate) => {
          if (candidate !== peer && candidate.connected) {
            Y.applyUpdate(candidate.provider.ydoc, update, peer);
          }
        });
      };

      peer.updateHandler = forwardUpdate;
      ydoc.on("update", forwardUpdate);
      peer.connected = true;

      room.forEach((candidate) => {
        if (candidate !== peer && candidate.connected) {
          Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(candidate.provider.ydoc), candidate);
          Y.applyUpdate(candidate.provider.ydoc, Y.encodeStateAsUpdate(ydoc), peer);
        }
      });

      emit("connected");
    },
    disconnect: async () => {
      if (peer.updateHandler !== undefined) {
        ydoc.off("update", peer.updateHandler);
        peer.updateHandler = undefined;
      }

      peer.connected = false;
      getInMemoryRoom(roomId).delete(peer);
      emit("disconnected");
    },
    getConnectionState: () => state,
    on: (_event, handler) => {
      listeners.add(handler);
    },
    off: (_event, handler) => {
      listeners.delete(handler as (nextState: SyncConnectionState) => void);
    }
  };
};

const createCyclicExampleEngine = (): CoreEngine =>
  createCoreEngine({
    allowCycles: true,
    cyclicExecution: {
      allowCycles: true,
      maxIterations: 200,
      convergenceThreshold: 0.0001
    },
    nodeTypes: [cyclicSourceNodeType, cyclicPassthroughNodeType, cyclicDampenNodeType]
  });

const createEngineForExample = (example: ExampleDefinition): CoreEngine => {
  const engine =
    example.id === "cyclic-graph"
      ? createCyclicExampleEngine()
      : createCoreEngine({
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
      ...(currentExample.id === "text-nodes-graph"
        ? {
            resolveNodeType: engine.getNodeType,
            measurer: createSkiaTextMeasurer()
          }
        : {}),
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

export const createSvgExportScreen = () => {
  const snapshot = SVG_STATIC_EXPORT_DOCUMENT.graph;
  const plan = createSvgRenderPlan({
    snapshot,
    viewport: { width: 1280, height: 720 },
    themeMode: "light"
  });
  const svgString = serializeSvgRenderPlan(plan);

  return {
    id: "svg-static-export",
    title: "SVG Static Export",
    snapshot,
    svgString,
    nodeCount: plan.diagnostics.visibleNodeCount,
    layerKinds: plan.layers.map((l) => l.kind),
    viewBox: plan.viewBox
  };
};

export const createTextNodesScreen = () => {
  const plugins = [createTextNodePlugin()];
  const rendererPlugins = [createTextRendererPlugin()];
  const measurer = createSkiaTextMeasurer();
  const engine = createCoreEngine({
    plugins
  });

  engine.importGraph(TEXT_NODES_GRAPH_EXAMPLE_DOCUMENT);

  const snapshot = engine.getSnapshot();
  const renderPlan = createSkiaRenderPlan({
    snapshot,
    interaction: { onEvent: () => undefined },
    viewport: { width: 1280, height: 720 },
    plugins: rendererPlugins,
    resolveNodeType: engine.getNodeType,
    measurer
  });
  const svgPlan = createSvgRenderPlan({
    snapshot,
    viewport: { width: 1280, height: 720 },
    resolveNodeType: engine.getNodeType,
    measurer
  });

  return {
    id: "text-nodes-graph",
    title: "Text Nodes Graph",
    snapshot,
    renderPlan,
    svgString: serializeSvgRenderPlan(svgPlan)
  };
};

export const createImageNodesScreen = () => {
  const plugins = [createImageNodePlugin()];
  const rendererPlugins = [createImageRendererPlugin()];
  const imageCache = createRendererImageCache();
  const imageLoader = createImageLoader(imageCache);
  const engine = createCoreEngine({
    plugins
  });

  engine.importGraph(IMAGE_NODES_GRAPH_EXAMPLE_DOCUMENT);

  imageCache.set("https://example.com/node-thumbnail.png", {
    uri: "https://example.com/node-thumbnail.png",
    state: "loading",
    retryCount: 0
  });
  imageCache.set("https://invalid.localhost/404.png", {
    uri: "https://invalid.localhost/404.png",
    state: "error",
    retryCount: 3,
    error: "Failed to load image."
  });

  const inlineImageUri =
    ((engine.getSnapshot().nodes.find((node) => node.id === "node_image_inline")?.properties.image as { uri?: string } | undefined)
      ?.uri) ?? "";

  if (inlineImageUri.length > 0) {
    imageLoader.preload([inlineImageUri]);
    imageCache.set(inlineImageUri, {
      uri: inlineImageUri,
      state: "loaded",
      retryCount: 0,
      skiaImage: inlineImageUri,
      width: 16,
      height: 16,
      loadedAt: Date.now()
    });
  }

  const snapshot = engine.getSnapshot();
  const renderPlan = createSkiaRenderPlan({
    snapshot,
    interaction: { onEvent: () => undefined },
    viewport: { width: 1280, height: 720 },
    plugins: rendererPlugins,
    resolveNodeType: engine.getNodeType,
    imageCache
  });
  const svgPlan = createSvgRenderPlan({
    snapshot,
    viewport: { width: 1280, height: 720 },
    resolveNodeType: engine.getNodeType,
    resolveImageState: (uri) => imageCache.get(uri)?.state ?? "idle"
  });

  return {
    id: "image-nodes-graph",
    title: "Image Nodes Graph",
    snapshot,
    renderPlan,
    svgString: serializeSvgRenderPlan(svgPlan)
  };
};

export const createLayoutDemoScreen = (algorithm: LayoutAlgorithm = "layered") => {
  const engine = createCoreEngine({});
  engine.importGraph(LAYOUT_DEMO_DOCUMENT);

  const snapshot = engine.getSnapshot();
  const layoutInput = graphInputFromSnapshot(snapshot);

  const defaultOptions: Record<LayoutAlgorithm, Parameters<typeof applyLayout>[1]> = {
    layered: {
      algorithm: "layered" as const,
      direction: "top-bottom" as const,
      nodePaddingX: 40,
      nodePaddingY: 60,
      rankSeparation: 20,
      edgeRouting: "curved" as const,
      centerGraph: true
    },
    "force-directed": {
      algorithm: "force-directed" as const,
      iterations: 300,
      convergenceThreshold: 0.5,
      repulsionStrength: 8000,
      attractionStrength: 0.1,
      idealEdgeLength: 150,
      gravity: 0.05,
      cooling: 0.98,
      initialTemperature: 200,
      edgeRouting: "curved" as const
    },
    tree: {
      algorithm: "tree" as const,
      direction: "top-bottom" as const,
      nodePaddingX: 40,
      nodePaddingY: 80,
      edgeRouting: "curved" as const,
      centerSubtrees: true
    },
    radial: {
      algorithm: "radial" as const,
      radiusStep: 120,
      startAngle: 0,
      edgeRouting: "curved" as const
    }
  };

  const opts = defaultOptions[algorithm];
  const result = applyLayout(layoutInput, opts);

  engine.beginTransaction();
  for (const { id, position } of result.positions) {
    engine.updateNode(id as `node_${string}`, { position });
  }
  engine.endTransaction();

  const updatedSnapshot = engine.getSnapshot();
  engine.dispose();

  const renderPlan = createSkiaRenderPlan({
    snapshot: updatedSnapshot,
    interaction: { onEvent: () => undefined },
    viewport: { width: 1280, height: 720 }
  });

  return {
    id: "layout-demo",
    algorithm,
    layoutResult: result,
    snapshot: updatedSnapshot,
    renderPlan
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

export const createAnimatedEditorScreen = () => {
  const engine = createCoreEngine({
    plugins: [createExecutableNodePlugin()]
  });
  const rendererPlugins = [createExecutableRendererPlugin()];

  engine.importGraph(EXAMPLE_FIXTURES["small-graph"]);

  const canvas = NodeGraphCanvas({
    engine,
    rendererPlugins,
    zoomMin: 0.1,
    zoomMax: 4
  });

  return {
    id: "animated-editor-screen",
    title: "Animated Editor Screen",
    snapshot: engine.getSnapshot(),
    canvas,
    renderPlan: canvas.getRenderPlan()
  };
};

export const createPersistenceExampleScreen = async () => {
  const adapter = createMemoryAdapter();
  const sourceEngine = createCoreEngine({
    plugins: [createExecutableNodePlugin()]
  });

  sourceEngine.importGraph(EXAMPLE_FIXTURES["small-graph"]);

  const persistence = createGraphPersistence(sourceEngine, {
    graphId: EXAMPLE_FIXTURES["small-graph"].graph.id,
    adapter,
    autoSave: true,
    autoSaveDebounceMs: 10
  });

  const firstNodeId = sourceEngine.getSnapshot().nodes[0]?.id;

  if (firstNodeId !== undefined) {
    sourceEngine.selectNode(firstNodeId);
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 25);
  });

  const targetEngine = createCoreEngine({
    plugins: [createExecutableNodePlugin()]
  });
  const loader = createGraphPersistence(targetEngine, {
    graphId: EXAMPLE_FIXTURES["small-graph"].graph.id,
    adapter,
    autoSave: false
  });
  const loaded = await loader.load();

  const result = {
    id: "persistence-example",
    title: "Persistence Example",
    originalNodeCount: sourceEngine.getSnapshot().nodes.length,
    loadedNodeCount: targetEngine.getSnapshot().nodes.length,
    savedAt: loaded?.graph.metadata.savedAt
  };

  loader.dispose();
  persistence.dispose();
  sourceEngine.dispose();
  targetEngine.dispose();

  return result;
};

export const createSyncExampleScreen = async () => {
  const roomId = "example-sync-room";
  const engine1 = createCoreEngine({
    nodeTypes: [syncNodeType]
  });
  const engine2 = createCoreEngine({
    nodeTypes: [syncNodeType]
  });
  const sync1 = createGraphSync(engine1, {
    roomId,
    localUserId: "user-1",
    localDisplayName: "User One",
    adapter: createInMemorySyncAdapter(roomId, new Y.Doc())
  });
  const sync2 = createGraphSync(engine2, {
    roomId,
    localUserId: "user-2",
    localDisplayName: "User Two",
    adapter: createInMemorySyncAdapter(roomId, new Y.Doc())
  });

  await sync1.connect();
  await sync2.connect();

  engine1.createNode({
    id: "node_sync_example",
    type: "sync-node",
    position: vec2(120, 120),
    label: "Shared Node"
  });
  sync1.updateCursorPosition(vec2(160, 140));
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  const result = {
    id: "sync-example",
    title: "Sync Example",
    user1NodeCount: engine1.getSnapshot().nodes.length,
    user2NodeCount: engine2.getSnapshot().nodes.length,
    presenceCount: sync2.getAwareness().getRemotePresences().length
  };

  sync1.dispose();
  sync2.dispose();
  engine1.dispose();
  engine2.dispose();

  return result;
};

export const createCyclicExecutionScreen = async () => {
  const engine = createCyclicExampleEngine();
  engine.importGraph(CYCLIC_GRAPH_EXAMPLE_DOCUMENT);

  const handle = engine.execute();
  const result = await handle.result;

  engine.dispose();

  return {
    id: "cyclic-execution",
    title: "Cyclic Execution Demo",
    snapshot: CYCLIC_GRAPH_EXAMPLE_DOCUMENT.graph,
    iterationsRun: result.iterationsRun,
    converged: result.converged,
    cycleGroups: result.cycleGroups,
    status: result.status,
    outputs: result.nodeResults
  };
};
