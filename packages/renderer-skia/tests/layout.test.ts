import { createGraphSnapshot } from "@kaiisuuwii/core";
import {
  DEFAULT_RENDERER_THEME,
  createEdgeLayout,
  createNodeLayout,
  getPortAnchor
} from "@kaiisuuwii/renderer-skia";
import { createEdgeId, createGraphId, createNodeId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";

const leftNodeId = createNodeId("left");
const rightNodeId = createNodeId("right");
const edgeId = createEdgeId("layout");

const snapshot = createGraphSnapshot({
  id: createGraphId("layout"),
  metadata: {
    name: "Layout",
    version: "0.1.0",
    tags: [],
    createdAtIso: "2026-05-10T00:00:00.000Z"
  },
  nodes: [
    {
      id: leftNodeId,
      type: "source",
      position: vec2(100, 100),
      dimensions: vec2(200, 120),
      label: "Left",
      ports: [
        {
          id: "port_left_out",
          name: "out",
          direction: "output"
        }
      ]
    },
    {
      id: rightNodeId,
      type: "sink",
      position: vec2(500, 160),
      dimensions: vec2(220, 100),
      label: "Right",
      ports: [
        {
          id: "port_right_in",
          name: "in",
          direction: "input"
        }
      ]
    }
  ],
  edges: [
    {
      id: edgeId,
      source: leftNodeId,
      target: rightNodeId,
      sourcePortId: "port_left_out",
      targetPortId: "port_right_in"
    }
  ]
});

describe("renderer-skia layout helpers", () => {
  it("creates node layout with ports on the expected sides", () => {
    const node = snapshot.nodes[0];

    expect(node).toBeDefined();

    const layout = createNodeLayout(node!, DEFAULT_RENDERER_THEME);

    expect(layout.position).toEqual(vec2(100, 100));
    expect(layout.size).toEqual(vec2(200, 120));
    expect(layout.ports[0]?.position.x).toBe(300);
  });

  it("resolves port anchors from node and port identity", () => {
    const leftNode = snapshot.nodes[0];
    const rightNode = snapshot.nodes[1];

    expect(leftNode).toBeDefined();
    expect(rightNode).toBeDefined();

    expect(getPortAnchor(leftNode!, "port_left_out", "output", DEFAULT_RENDERER_THEME)).toEqual(
      vec2(300, 160)
    );
    expect(getPortAnchor(rightNode!, "port_right_in", "input", DEFAULT_RENDERER_THEME)).toEqual(
      vec2(500, 210)
    );
  });

  it("creates bezier edge layout between source and target anchors", () => {
    const edge = createEdgeLayout(
      snapshot.edges[0]!,
      snapshot,
      DEFAULT_RENDERER_THEME,
      {
        selected: true
      }
    );

    expect(edge).toBeDefined();
    expect(edge?.curve.start).toEqual(vec2(300, 160));
    expect(edge?.curve.end).toEqual(vec2(500, 210));
    expect(edge?.color).toBe(DEFAULT_RENDERER_THEME.edge.selectedColor);
  });
});
