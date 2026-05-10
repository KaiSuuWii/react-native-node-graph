import { createCoreEngine } from "@react-native-node-graph/core";
import { createGraphEditor } from "@react-native-node-graph/renderer-skia";
import { createGraphId, createNodeId, vec2 } from "@react-native-node-graph/shared";
import { describe, expect, it, vi } from "vitest";

const sourceId = createNodeId("editor-source");
const secondSourceId = createNodeId("editor-second-source");
const sinkId = createNodeId("editor-sink");

const createEditor = () => {
  const engine = createCoreEngine({
    graph: {
      id: createGraphId("editor"),
      metadata: {
        name: "Editor",
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
          ports: [{ id: "port_source_out", name: "out", direction: "output", dataType: "number" }]
        },
        {
          id: secondSourceId,
          type: "source",
          position: vec2(360, 90),
          dimensions: vec2(180, 88),
          label: "Second Source",
          ports: [{ id: "port_second_out", name: "out", direction: "output", dataType: "number" }]
        },
        {
          id: sinkId,
          type: "sink",
          position: vec2(380, 260),
          dimensions: vec2(180, 88),
          label: "Sink",
          ports: [{ id: "port_sink_in", name: "in", direction: "input", dataType: "number" }]
        }
      ]
    },
    nodeTypes: [{ type: "source" }, { type: "sink" }]
  });

  return {
    engine,
    editor: createGraphEditor({
      engine,
      interaction: { onEvent: vi.fn() },
      viewport: { width: 1200, height: 800 },
      camera: { position: vec2(0, 0), zoom: 1 },
      virtualization: {
        enabled: true,
        cullingPadding: 24,
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
      }
    })
  };
};

const getPortPosition = (
  editor: ReturnType<typeof createEditor>["editor"],
  nodeId: string,
  portId: string
) =>
  editor.getRenderPlan().nodes.find((node) => node.id === nodeId)?.ports.find((port) => port.id === portId)
    ?.position;

describe("renderer-skia editor controller", () => {
  it("selects and drags nodes through core state", () => {
    const { engine, editor } = createEditor();

    editor.tapAt(vec2(120, 120));
    expect(engine.getSnapshot().selection.nodeIds).toEqual([sourceId]);

    editor.beginDragAt(vec2(120, 120));
    editor.dragTo(vec2(180, 160));
    editor.endDrag();

    expect(engine.getSnapshot().nodes.find((node) => node.id === sourceId)?.position).toEqual(
      vec2(160, 140)
    );

    expect(engine.undo()).toBe(true);
    expect(engine.getSnapshot().nodes.find((node) => node.id === sourceId)?.position).toEqual(
      vec2(100, 100)
    );
  });

  it("selects multiple nodes deterministically with marquee", () => {
    const { engine, editor } = createEditor();

    editor.beginMarquee(vec2(80, 80));
    editor.updateMarquee(vec2(560, 190));
    editor.endMarquee();

    expect(engine.getSnapshot().selection.nodeIds).toEqual([secondSourceId, sourceId]);
  });

  it("shows invalid connection feedback and creates valid edges", () => {
    const { engine, editor } = createEditor();
    const sourcePort = getPortPosition(editor, sourceId, "port_source_out");
    const invalidTargetPort = getPortPosition(editor, secondSourceId, "port_second_out");
    const validTargetPort = getPortPosition(editor, sinkId, "port_sink_in");

    expect(sourcePort).toBeDefined();
    expect(invalidTargetPort).toBeDefined();
    expect(validTargetPort).toBeDefined();

    editor.startConnectionPreview(sourcePort!);
    const invalidPreview = editor.updateConnectionPreview(invalidTargetPort!);

    expect(invalidPreview?.valid).toBe(false);
    expect(editor.commitConnectionPreview()).toBeUndefined();
    expect(engine.getSnapshot().edges).toHaveLength(0);

    editor.startConnectionPreview(sourcePort!);
    const validPreview = editor.updateConnectionPreview(validTargetPort!);

    expect(validPreview?.valid).toBe(true);
    expect(editor.commitConnectionPreview()?.target).toBe(sinkId);
    expect(engine.getSnapshot().edges).toHaveLength(1);
  });

  it("tracks dirty redraw bounds across rapid mutation replay", () => {
    const { editor } = createEditor();
    const firstPlan = editor.getRenderPlan();

    for (let index = 0; index < 25; index += 1) {
      editor.beginDragAt(vec2(120, 120));
      editor.dragTo(vec2(120 + index + 1, 120 + index + 1));
      editor.endDrag();
    }

    const nextPlan = editor.getRenderPlan();

    expect(firstPlan.scene.diagnostics.redrawBounds).toBeDefined();
    expect(nextPlan.scene.diagnostics.redrawBounds).toBeDefined();
    expect(nextPlan.scene.diagnostics.redrawBounds?.max.x).toBeGreaterThan(
      nextPlan.scene.diagnostics.redrawBounds?.min.x ?? 0
    );
  });
});
