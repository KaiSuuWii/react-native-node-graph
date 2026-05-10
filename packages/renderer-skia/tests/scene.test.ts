import { createGraphSnapshot } from "@react-native-node-graph/core";
import {
  buildSkiaRenderScene,
  createSkiaRenderPlan,
  DEFAULT_RENDERER_THEME
} from "@react-native-node-graph/renderer-skia";
import { createEdgeId, createGraphId, createNodeId, vec2 } from "@react-native-node-graph/shared";
import { describe, expect, it, vi } from "vitest";

const nodeAId = createNodeId("a");
const nodeBId = createNodeId("b");
const edgeId = createEdgeId("scene");

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
      plugins: [],
      interaction,
      interactionOptions: {
        panEnabled: true,
        zoomEnabled: true,
        minZoom: 0.25,
        maxZoom: 4
      }
    });

    expect(scene.layers.map((layer) => layer.kind)).toEqual([
      "background",
      "grid",
      "group",
      "edge",
      "node",
      "selection",
      "interaction",
      "debug"
    ]);
    expect(scene.layers[3]?.kind === "edge" ? scene.layers[3].items.length : 0).toBe(1);
    expect(scene.layers[4]?.kind === "node" ? scene.layers[4].items.length : 0).toBe(2);
    expect(scene.layers[5]?.kind === "selection" ? scene.layers[5].items[0]?.targetId : "").toBe(nodeBId);
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
});
