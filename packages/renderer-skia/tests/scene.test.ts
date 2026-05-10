import { createGraphSnapshot } from "@kaiisuuwii/core";
import {
  buildSkiaRenderScene,
  createSkiaRenderPlan,
  DEFAULT_RENDERER_THEME,
  type RendererPlugin
} from "@kaiisuuwii/renderer-skia";
import { createEdgeId, createGraphId, createNodeId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it, vi } from "vitest";

const nodeAId = createNodeId("a");
const nodeBId = createNodeId("b");
const edgeId = createEdgeId("scene");
const farNodeId = createNodeId("far");
const rendererPlugin: RendererPlugin = {
  name: "scene-test-plugin",
  interactionHandlers: [
    {
      id: "inspect",
      description: "Inspect"
    }
  ],
  decorateNodeLayout: (layout, node) => ({
    ...layout,
    pluginVisuals: [
      ...layout.pluginVisuals,
      {
        kind: "badge",
        label: node.type,
        color: "#111827"
      }
    ]
  }),
  decorateEdgeLayout: (layout) => ({
    ...layout,
    pluginVisuals: [
      ...layout.pluginVisuals,
      {
        kind: "label",
        label: "flow",
        color: layout.color,
        position: vec2(200, 200)
      }
    ]
  }),
  createOverlays: ({ nodes }) =>
    nodes.map((node) => ({
      id: `overlay:${node.id}`,
      kind: "text",
      label: `overlay:${node.id}`,
      color: "#111827",
      position: node.position,
      text: node.label
    }))
};

const snapshot = createGraphSnapshot({
  id: createGraphId("scene"),
  metadata: {
    name: "Scene",
    version: "0.1.0",
    tags: [],
    createdAtIso: "2026-05-10T00:00:00.000Z"
  },
  nodes: [
    {
      id: nodeAId,
      type: "source",
      position: vec2(80, 120),
      dimensions: vec2(180, 88),
      label: "A",
      ports: [
        {
          id: "port_a_out",
          name: "out",
          direction: "output"
        }
      ]
    },
    {
      id: nodeBId,
      type: "sink",
      position: vec2(360, 180),
      dimensions: vec2(180, 88),
      label: "B",
      ports: [
        {
          id: "port_b_in",
          name: "in",
          direction: "input"
        }
      ]
    }
  ],
  edges: [
    {
      id: edgeId,
      source: nodeAId,
      target: nodeBId,
      sourcePortId: "port_a_out",
      targetPortId: "port_b_in"
    }
  ],
  groups: [
    {
      id: "group_scene",
      name: "Scene Group",
      nodeIds: [nodeAId, nodeBId]
    }
  ],
  selection: {
    nodeIds: [nodeBId],
    edgeIds: [],
    groupIds: [],
    activeSelectionMode: "node"
  }
});

describe("renderer-skia scene composition", () => {
  it("builds ordered scene layers for a static graph", () => {
    const interaction = { onEvent: vi.fn() };
    const scene = buildSkiaRenderScene({
      snapshot,
      viewport: {
        width: 800,
        height: 600
      },
      camera: {
        position: vec2(0, 0),
        zoom: 1
      },
      theme: DEFAULT_RENDERER_THEME,
      plugins: [rendererPlugin],
      interaction,
      interactionOptions: {
        panEnabled: true,
        zoomEnabled: true,
        minZoom: 0.25,
        maxZoom: 4,
        hitSlop: 8,
        edgeHitWidth: 12,
        longPressMarqueeEnabled: true
      },
      virtualization: {
        enabled: true,
        cullingPadding: 40,
        suppressOffscreenNodes: true,
        suppressOffscreenEdges: true,
        preserveSelectedElements: true,
        incrementalRedrawEnabled: true,
        levelOfDetail: {
          labels: 0.45,
          ports: 0.7,
          decorations: 1,
          edgeSimplification: 0.55
        }
      },
      debug: {
        enabled: true,
        showFpsOverlay: true,
        showRenderBounds: true,
        showHitRegions: true,
        showEdgeRouting: true
      },
      accessibility: {
        enabled: true,
        keyboardNavigationEnabled: true,
        screenReaderEnabled: true,
        scalableUiEnabled: true
      },
      frameTimestampMs: 1000
    });
    const nextScene = buildSkiaRenderScene({
      snapshot,
      viewport: {
        width: 800,
        height: 600
      },
      camera: {
        position: vec2(10, 0),
        zoom: 0.5
      },
      theme: DEFAULT_RENDERER_THEME,
      plugins: [rendererPlugin],
      interaction,
      interactionOptions: {
        panEnabled: true,
        zoomEnabled: true,
        minZoom: 0.25,
        maxZoom: 4,
        hitSlop: 8,
        edgeHitWidth: 12,
        longPressMarqueeEnabled: true
      },
      virtualization: {
        enabled: true,
        cullingPadding: 40,
        suppressOffscreenNodes: true,
        suppressOffscreenEdges: true,
        preserveSelectedElements: true,
        incrementalRedrawEnabled: true,
        levelOfDetail: {
          labels: 0.45,
          ports: 0.7,
          decorations: 1,
          edgeSimplification: 0.55
        }
      },
      debug: {
        enabled: true,
        showFpsOverlay: true,
        showRenderBounds: true,
        showHitRegions: true,
        showEdgeRouting: true
      },
      accessibility: {
        enabled: true,
        keyboardNavigationEnabled: true,
        screenReaderEnabled: true,
        scalableUiEnabled: true,
        focusTargetId: nodeBId
      },
      previousScene: scene,
      frameTimestampMs: 1040
    });

    expect(nextScene.layers.map((layer) => layer.kind)).toEqual([
      "background",
      "grid",
      "group",
      "edge",
      "node",
      "selection",
      "interaction",
      "plugin",
      "debug"
    ]);
    expect(nextScene.layers[3]?.kind === "edge" ? nextScene.layers[3].items.length : 0).toBe(1);
    expect(nextScene.layers[4]?.kind === "node" ? nextScene.layers[4].items.length : 2).toBe(2);
    expect(
      nextScene.layers[5]?.kind === "selection" ? nextScene.layers[5].items[0]?.targetId : ""
    ).toBe(nodeBId);
    expect(nextScene.diagnostics.visibleNodeCount).toBe(2);
    expect(nextScene.diagnostics.fps).toBeCloseTo(25);
    expect(nextScene.diagnostics.redrawBounds).toBeDefined();
    expect(nextScene.layers[7]?.kind === "plugin" ? nextScene.layers[7].overlays.length : 0).toBe(2);
    expect(nextScene.layers[8]?.kind === "debug" ? nextScene.layers[8].overlays.length : 0).toBeGreaterThan(0);
    expect(nextScene.layers[4]?.kind === "node" ? nextScene.layers[4].items[0]?.lod.showPorts : true).toBe(false);
    expect(nextScene.layers[3]?.kind === "edge" ? nextScene.layers[3].items[0]?.simplified : false).toBe(true);
    expect(nextScene.layers[4]?.kind === "node" ? nextScene.layers[4].items[0]?.pluginVisuals.length : 0).toBe(1);
    expect(nextScene.layers[3]?.kind === "edge" ? nextScene.layers[3].items[0]?.pluginVisuals.length : 0).toBe(1);
    expect(nextScene.accessibility.focusTargetId).toBe(nodeBId);
    expect(nextScene.accessibility.focusOrder).toEqual(
      expect.arrayContaining([nodeAId, nodeBId, edgeId])
    );
    expect(nextScene.accessibility.descriptors[nodeBId]?.focused).toBe(true);
  });

  it("creates a render plan from renderer props", () => {
    const interaction = { onEvent: vi.fn() };
    const plan = createSkiaRenderPlan({
      snapshot,
      interaction,
      viewport: {
        width: 1024,
        height: 768
      }
    });

    expect(plan.nodes).toHaveLength(2);
    expect(plan.edges).toHaveLength(1);
    expect(plan.scene.viewport.width).toBe(1024);
  });

  it("culls offscreen nodes while preserving selected elements", () => {
    const culledScene = buildSkiaRenderScene({
      snapshot: createGraphSnapshot({
        ...snapshot,
        nodes: [
          ...snapshot.nodes,
          {
            id: farNodeId,
            type: "far",
            position: vec2(2400, 2400),
            dimensions: vec2(180, 88),
            label: "Far",
            ports: []
          }
        ],
        selection: {
          nodeIds: [farNodeId],
          edgeIds: [],
          groupIds: [],
          activeSelectionMode: "node"
        }
      }),
      viewport: {
        width: 800,
        height: 600
      },
      camera: {
        position: vec2(0, 0),
        zoom: 1
      },
      theme: DEFAULT_RENDERER_THEME,
      plugins: [rendererPlugin],
      interaction: { onEvent: vi.fn() },
      interactionOptions: {
        panEnabled: true,
        zoomEnabled: true,
        minZoom: 0.25,
        maxZoom: 4,
        hitSlop: 8,
        edgeHitWidth: 12,
        longPressMarqueeEnabled: true
      },
      virtualization: {
        enabled: true,
        cullingPadding: 20,
        suppressOffscreenNodes: true,
        suppressOffscreenEdges: true,
        preserveSelectedElements: true,
        incrementalRedrawEnabled: true,
        levelOfDetail: {
          labels: 0.45,
          ports: 0.7,
          decorations: 1,
          edgeSimplification: 0.55
        }
      },
      debug: {
        enabled: false,
        showFpsOverlay: false,
        showRenderBounds: false,
        showHitRegions: false,
        showEdgeRouting: false
      },
      accessibility: {
        enabled: true,
        keyboardNavigationEnabled: true,
        screenReaderEnabled: true,
        scalableUiEnabled: true
      }
    });

    expect(culledScene.diagnostics.culledNodeCount).toBe(0);
    expect(
      culledScene.layers[4]?.kind === "node"
        ? culledScene.layers[4].items.some((node) => node.id === farNodeId)
        : false
    ).toBe(true);
  });
});
