import { createCoreEngine } from "@kaiisuuwii/core";
import { createGraphEditor, createRendererImageCache } from "@kaiisuuwii/renderer-skia";
import { createGraphId, createNodeId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it, vi } from "vitest";

const sourceId = createNodeId("editor-source");
const secondSourceId = createNodeId("editor-second-source");
const sinkId = createNodeId("editor-sink");
const noteId = createNodeId("editor-note");

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
        },
        {
          id: noteId,
          type: "note",
          position: vec2(80, 260),
          dimensions: vec2(240, 96),
          label: "Note",
          properties: {
            body: {
              kind: "text",
              value: "Editable note body for inline text editing coverage."
            }
          },
          ports: []
        }
      ]
    },
    nodeTypes: [{ type: "source" }, { type: "sink" }, { type: "note", textProperties: ["body"] }]
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

  it("begins text edit state from a text content hit and commits through undoable core updates", () => {
    const { engine, editor } = createEditor();
    const noteLayout = editor.getRenderPlan().nodes.find((node) => node.id === noteId);
    const textBounds = noteLayout?.textContentItems[0]?.bounds;

    expect(textBounds).toBeDefined();

    const hit = editor.doubleTapAt(vec2((textBounds!.min.x + textBounds!.max.x) / 2, textBounds!.min.y + 4));

    expect(hit.target.kind).toBe("text-content");
    expect(editor.isEditing()).toBe(true);
    expect(editor.getInteractionState().editingNodeId).toBe(noteId);

    editor.updateEditingValue("Updated note body", 17);
    editor.setEditingSelection(0, 7);
    const commit = editor.commitTextEdit();

    expect(commit).toMatchObject({
      nodeId: noteId,
      propertyKey: "body",
      previousValue: "Editable note body for inline text editing coverage.",
      newValue: "Updated note body"
    });
    expect(
      (engine.getSnapshot().nodes.find((node) => node.id === noteId)?.properties.body as { value: string }).value
    ).toBe("Updated note body");
    expect(engine.undo()).toBe(true);
    expect(
      (engine.getSnapshot().nodes.find((node) => node.id === noteId)?.properties.body as { value: string }).value
    ).toBe("Editable note body for inline text editing coverage.");
  });

  it("cancels text edit state without mutating the engine snapshot", () => {
    const { engine, editor } = createEditor();

    editor.beginTextEdit(noteId, "body");
    editor.updateEditingValue("Draft value", 11);
    editor.cancelTextEdit();

    expect(editor.isEditing()).toBe(false);
    expect(editor.commitTextEdit()).toBeUndefined();
    expect(
      (engine.getSnapshot().nodes.find((node) => node.id === noteId)?.properties.body as { value: string }).value
    ).toBe("Editable note body for inline text editing coverage.");
  });

  it("disposes image loader resources when the editor is disposed", () => {
    const engine = createCoreEngine({
      graph: {
        id: createGraphId("image-editor"),
        metadata: {
          name: "Image Editor",
          version: "0.1.0",
          tags: [],
          createdAtIso: "2026-05-12T00:00:00.000Z"
        },
        nodes: [
          {
            id: createNodeId("image-node"),
            type: "thumbnail",
            position: vec2(0, 0),
            dimensions: vec2(220, 140),
            label: "Image",
            ports: [],
            properties: {
              image: {
                kind: "image",
                uri: "data:image/png;base64,AAAA"
              }
            }
          }
        ]
      },
      nodeTypes: [{ type: "thumbnail", imageProperties: ["image"] }]
    });
    const imageCache = createRendererImageCache();
    const imageLoader = {
      load: vi.fn(() => () => undefined),
      preload: vi.fn(),
      dispose: vi.fn()
    };
    const editor = createGraphEditor({
      engine,
      interaction: { onEvent: vi.fn() },
      viewport: { width: 800, height: 600 },
      imageCache,
      imageLoader,
      camera: { position: vec2(0, 0), zoom: 1 }
    });

    editor.getRenderPlan();
    editor.dispose();

    expect(imageLoader.load).toHaveBeenCalled();
    expect(imageLoader.dispose).toHaveBeenCalledTimes(1);
    expect(imageCache.size()).toBe(0);
  });
});
