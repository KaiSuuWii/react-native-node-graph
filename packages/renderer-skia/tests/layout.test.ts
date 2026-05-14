import { createGraphSnapshot } from "@kaiisuuwii/core";
import {
  DEFAULT_RENDERER_THEME,
  createRendererImageCache,
  createSkiaTextMeasurer,
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

  it("builds text content item bounds from text node properties", () => {
    const textNode = createGraphSnapshot({
      id: createGraphId("text-layout"),
      metadata: snapshot.metadata,
      nodes: [
        {
          id: createNodeId("text-layout"),
          type: "note",
          position: vec2(40, 60),
          dimensions: vec2(220, 100),
          label: "Note",
          ports: [],
          properties: {
            body: {
              kind: "text",
              value: "This text wraps across multiple body lines.",
              maxLines: 0
            }
          }
        }
      ],
      edges: []
    }).nodes[0]!;

    const layout = createNodeLayout(textNode, DEFAULT_RENDERER_THEME, {
      measurer: createSkiaTextMeasurer(),
      resolveNodeType: () => ({
        type: "note",
        textProperties: ["body"]
      })
    });

    expect(layout.textContentItems).toHaveLength(1);
    expect(layout.textContentItems[0]?.bounds.min.y).toBeGreaterThan(
      textNode.position.y + layout.headerHeight
    );
  });

  it("expands node height when text content exceeds the default body height", () => {
    const textNode = createGraphSnapshot({
      id: createGraphId("text-autosize"),
      metadata: snapshot.metadata,
      nodes: [
        {
          id: createNodeId("text-autosize"),
          type: "note",
          position: vec2(40, 60),
          dimensions: vec2(220, 90),
          label: "Auto Height",
          ports: [],
          properties: {
            body: {
              kind: "text",
              value:
                "A longer note body that should force the node to expand because the measured content would overflow the original body height.",
              maxLines: 0
            }
          }
        }
      ],
      edges: []
    }).nodes[0]!;

    const layout = createNodeLayout(textNode, DEFAULT_RENDERER_THEME, {
      resolveNodeType: () => ({
        type: "note",
        textProperties: ["body"]
      })
    });

    expect(layout.autoHeight).toBe(true);
    expect(layout.size.y).toBeGreaterThan(textNode.dimensions.y);
  });

  it("builds image content item bounds from image node properties", () => {
    const imageNode = createGraphSnapshot({
      id: createGraphId("image-layout"),
      metadata: snapshot.metadata,
      nodes: [
        {
          id: createNodeId("image-layout"),
          type: "thumbnail",
          position: vec2(50, 70),
          dimensions: vec2(240, 120),
          label: "Thumbnail",
          ports: [],
          properties: {
            image: {
              kind: "image",
              uri: "data:image/png;base64,AAAA",
              height: 96,
              opacity: 0.5
            }
          }
        }
      ],
      edges: []
    }).nodes[0]!;
    const cache = createRendererImageCache();
    cache.set("data:image/png;base64,AAAA", {
      uri: "data:image/png;base64,AAAA",
      state: "loaded",
      retryCount: 0,
      width: 16,
      height: 16,
      skiaImage: "image"
    });

    const layout = createNodeLayout(imageNode, DEFAULT_RENDERER_THEME, {
      imageCache: cache,
      resolveNodeType: () => ({
        type: "thumbnail",
        imageProperties: ["image"]
      })
    });

    expect(layout.imageContentItems).toHaveLength(1);
    expect(layout.imageContentItems[0]?.bounds.min.y).toBeGreaterThan(
      imageNode.position.y + layout.headerHeight
    );
    expect(layout.imageContentItems[0]?.opacity).toBe(0.5);
  });

  it("expands node height when image content exceeds the default body height", () => {
    const imageNode = createGraphSnapshot({
      id: createGraphId("image-autosize"),
      metadata: snapshot.metadata,
      nodes: [
        {
          id: createNodeId("image-autosize"),
          type: "thumbnail",
          position: vec2(40, 60),
          dimensions: vec2(220, 90),
          label: "Auto Image Height",
          ports: [],
          properties: {
            image: {
              kind: "image",
              uri: "data:image/png;base64,BBBB",
              height: 140
            }
          }
        }
      ],
      edges: []
    }).nodes[0]!;

    const layout = createNodeLayout(imageNode, DEFAULT_RENDERER_THEME, {
      resolveNodeType: () => ({
        type: "thumbnail",
        imageProperties: ["image"]
      })
    });

    expect(layout.autoHeight).toBe(true);
    expect(layout.size.y).toBeGreaterThan(imageNode.dimensions.y);
  });
});
