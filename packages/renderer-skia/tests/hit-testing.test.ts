import { createGraphSnapshot } from "@react-native-node-graph/core";
import {
  DEFAULT_RENDERER_THEME,
  buildSceneSpatialIndex,
  buildSkiaRenderScene,
  hitTestSceneBounds,
  hitTestScenePoint
} from "@react-native-node-graph/renderer-skia";
import { createEdgeId, createGraphId, createNodeId, vec2 } from "@react-native-node-graph/shared";
import { describe, expect, it, vi } from "vitest";

const sourceId = createNodeId("hit-source");
const sinkId = createNodeId("hit-sink");
const edgeId = createEdgeId("hit-edge");

const snapshot = createGraphSnapshot({
  id: createGraphId("hit"),
  metadata: {
    name: "Hit",
    version: "0.1.0",
    tags: [],
    createdAtIso: "2026-05-10T00:00:00.000Z"
  },
  nodes: [
    {
      id: sourceId,
      type: "source",
      position: vec2(100, 100),
      dimensions: vec2(180, 88),
      label: "Source",
      groupId: "group_hit",
      ports: [{ id: "port_source_out", name: "out", direction: "output" }]
    },
    {
      id: sinkId,
      type: "sink",
      position: vec2(420, 140),
      dimensions: vec2(180, 88),
      label: "Sink",
      groupId: "group_hit",
      ports: [{ id: "port_sink_in", name: "in", direction: "input" }]
    }
  ],
  edges: [
    {
      id: edgeId,
      source: sourceId,
      target: sinkId,
      sourcePortId: "port_source_out",
      targetPortId: "port_sink_in"
    }
  ],
  groups: [{ id: "group_hit", name: "Hit Group", nodeIds: [sourceId, sinkId] }]
});

describe("renderer-skia hit testing", () => {
  const scene = buildSkiaRenderScene({
    snapshot,
    viewport: { width: 900, height: 700 },
    camera: { position: vec2(0, 0), zoom: 1 },
    theme: DEFAULT_RENDERER_THEME,
    plugins: [],
    interaction: { onEvent: vi.fn() },
    interactionOptions: {
      panEnabled: true,
      zoomEnabled: true,
      minZoom: 0.25,
      maxZoom: 4,
      hitSlop: 8,
      edgeHitWidth: 12,
      longPressMarqueeEnabled: true
    }
  });
  const index = buildSceneSpatialIndex(scene);

  it("prefers ports over node bodies", () => {
    const hit = hitTestScenePoint(scene, index, vec2(280, 144));

    expect(hit.target.kind).toBe("port");
    expect(hit.target.kind === "port" ? hit.target.portId : "").toBe("port_source_out");
  });

  it("hits edges by sampled curve distance", () => {
    const hit = hitTestScenePoint(scene, index, vec2(350, 160));

    expect(hit.target.kind).toBe("edge");
    expect(hit.target.kind === "edge" ? hit.target.edgeId : "").toBe(edgeId);
  });

  it("returns deterministic bounds results for marquee queries", () => {
    const hits = hitTestSceneBounds(scene, index, {
      min: vec2(90, 90),
      max: vec2(610, 240)
    });

    expect(hits.map((hit) => hit.target.kind)).toEqual(["node", "node", "edge", "group"]);
  });
});
