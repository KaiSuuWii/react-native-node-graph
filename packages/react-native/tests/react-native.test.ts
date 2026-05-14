import { createCoreEngine } from "@kaiisuuwii/core";
import { graphToScreenSpace, screenToGraphSpace } from "@kaiisuuwii/renderer-skia";
import { createGraphId, createNodeId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it, vi } from "vitest";

import {
  NodeGraphCanvas,
  createNodeGraphGestures,
  createSharedValue,
  useCamera,
  useConnectionWire,
  useDragNode
} from "@kaiisuuwii/react-native";

const sourceId = createNodeId("rn-source");
const sinkId = createNodeId("rn-sink");

const createEngine = () =>
  createCoreEngine({
    graph: {
      id: createGraphId("rn"),
      metadata: {
        name: "RN Graph",
        version: "0.2.0",
        tags: [],
        createdAtIso: "2026-05-12T00:00:00.000Z"
      },
      nodes: [
        {
          id: sourceId,
          type: "source",
          position: vec2(100, 120),
          dimensions: vec2(180, 88),
          label: "Source",
          properties: {},
          ports: [{ id: "port_source_out", name: "out", direction: "output", dataType: "number" }],
          metadata: {}
        },
        {
          id: sinkId,
          type: "sink",
          position: vec2(420, 120),
          dimensions: vec2(180, 88),
          label: "Sink",
          properties: {},
          ports: [{ id: "port_sink_in", name: "in", direction: "input", dataType: "number" }],
          metadata: {}
        }
      ],
      edges: [],
      groups: [],
      selection: {
        nodeIds: [],
        edgeIds: [],
        groupIds: [],
        activeSelectionMode: "none"
      }
    },
    nodeTypes: [{ type: "source" }, { type: "sink" }]
  });

describe("@kaiisuuwii/react-native", () => {
  it("reads shared values back into a plain camera state", () => {
    const camera = useCamera({
      initial: {
        position: vec2(24, 48),
        zoom: 1.5
      }
    });

    expect(camera.toPlain()).toEqual({
      position: vec2(24, 48),
      zoom: 1.5
    });
  });

  it("keeps the focal point stationary during zoom animation", () => {
    const camera = useCamera({
      initial: {
        position: vec2(10, 20),
        zoom: 1
      }
    });
    const focal = vec2(320, 240);
    const graphPointBefore = screenToGraphSpace(focal, camera.toPlain());

    camera.animateZoomTo(2, focal);

    const graphPointAfter = screenToGraphSpace(focal, camera.toPlain());

    expect(graphPointAfter).toEqual(graphPointBefore);
  });

  it("commits dragged node positions back into the engine", () => {
    const engine = createEngine();
    const camera = useCamera({
      initial: {
        position: vec2(0, 0),
        zoom: 1
      }
    });
    const drag = useDragNode(engine, camera);

    drag.onDragStart(sourceId, vec2(100, 120));
    drag.onDragMove(vec2(170, 190));
    drag.onDragEnd();

    expect(engine.getSnapshot().nodes.find((node) => node.id === sourceId)?.position).toEqual(
      vec2(170, 190)
    );
  });

  it("snaps dragged node positions to a grid when configured", () => {
    const engine = createEngine();
    const camera = useCamera({
      initial: {
        position: vec2(0, 0),
        zoom: 1
      }
    });
    const drag = useDragNode(engine, camera, {
      snapToGrid: 10
    });

    drag.onDragStart(sourceId, vec2(100, 120));
    drag.onDragMove(vec2(167, 194));
    drag.onDragEnd();

    expect(engine.getSnapshot().nodes.find((node) => node.id === sourceId)?.position).toEqual(
      vec2(170, 190)
    );
  });

  it("clears the connection wire after ending the gesture", () => {
    const camera = useCamera();
    const wire = useConnectionWire(camera);

    wire.onConnectionStart(vec2(10, 20));
    wire.onConnectionMove(vec2(30, 40));

    expect(wire.getCurve()).toBeDefined();

    wire.onConnectionEnd();

    expect(wire.connectionWireEnd.value).toBeUndefined();
    expect(wire.getCurve()).toBeUndefined();
  });

  it("routes single tap to the editor", () => {
    const editor = {
      tapAt: vi.fn(() => ({ target: { kind: "canvas" as const }, point: vec2(0, 0), distance: 0 }))
    } as never;
    const gestures = createNodeGraphGestures({
      editor,
      camera: useCamera(),
      dragController: {
        draggingNodeId: createSharedValue(undefined),
        dragOffset: createSharedValue(vec2(0, 0)),
        onDragStart: vi.fn(),
        onDragMove: vi.fn(),
        onDragEnd: vi.fn()
      },
      options: {
        engine: createCoreEngine(),
        style: { value: undefined }
      }
    });

    gestures.singleTap.onEnd({ x: 12, y: 24 });

    expect(editor.tapAt).toHaveBeenCalledWith(vec2(12, 24));
  });

  it("routes double tap without also firing single tap", () => {
    const editor = {
      tapAt: vi.fn(),
      doubleTapAt: vi.fn(() => ({ target: { kind: "canvas" as const }, point: vec2(0, 0), distance: 0 }))
    } as never;
    const gestures = createNodeGraphGestures({
      editor,
      camera: useCamera(),
      dragController: {
        draggingNodeId: createSharedValue(undefined),
        dragOffset: createSharedValue(vec2(0, 0)),
        onDragStart: vi.fn(),
        onDragMove: vi.fn(),
        onDragEnd: vi.fn()
      },
      options: {
        engine: createCoreEngine(),
        style: { value: undefined }
      }
    });

    gestures.doubleTap.onEnd({ x: 20, y: 30 });

    expect(editor.doubleTapAt).toHaveBeenCalledOnce();
    expect(editor.tapAt).not.toHaveBeenCalled();
  });

  it("starts node drags when pan begins on a node and pans the camera on canvas", () => {
    const engine = createEngine();
    const camera = useCamera({
      initial: {
        position: vec2(0, 0),
        zoom: 1
      }
    });
    const dragController = useDragNode(engine, camera);
    const canvas = NodeGraphCanvas({
      engine
    });
    const sourceScreen = graphToScreenSpace(vec2(110, 130), camera.toPlain());

    const dragStartSpy = vi.spyOn(dragController, "onDragStart");
    const gestures = createNodeGraphGestures({
      editor: canvas.editor,
      camera,
      dragController,
      options: {
        engine
      }
    });

    gestures.pan.onStart({ x: sourceScreen.x, y: sourceScreen.y });
    expect(dragStartSpy).toHaveBeenCalled();

    gestures.pan.onEnd({ x: sourceScreen.x, y: sourceScreen.y });

    gestures.pan.onStart({ x: 900, y: 600 });
    gestures.pan.onUpdate({ x: 920, y: 630 });

    expect(camera.offsetX.value).not.toBe(0);
    expect(camera.offsetY.value).not.toBe(0);

    canvas.dispose();
  });

  it("updates camera zoom from pinch gestures", () => {
    const engine = createEngine();
    const camera = useCamera({
      initial: {
        position: vec2(0, 0),
        zoom: 1
      }
    });
    const canvas = NodeGraphCanvas({
      engine
    });
    const gestures = createNodeGraphGestures({
      editor: canvas.editor,
      camera,
      dragController: useDragNode(engine, camera),
      options: {
        engine
      }
    });

    gestures.pinch.onStart({ x: 300, y: 200, scale: 1 });
    gestures.pinch.onUpdate({ x: 300, y: 200, scale: 1.5 });

    expect(camera.zoom.value).toBe(1.5);

    canvas.dispose();
  });

  it("creates a canvas handle without errors for an empty graph", () => {
    const engine = createCoreEngine();
    const canvas = NodeGraphCanvas({
      engine
    });

    expect(canvas.getRenderPlan().nodes).toEqual([]);
    expect(canvas.getRenderPlan().edges).toEqual([]);

    canvas.dispose();
  });

  it("re-renders when the engine mutates", () => {
    const engine = createCoreEngine({
      nodeTypes: [{ type: "source" }]
    });
    const canvas = NodeGraphCanvas({
      engine
    });
    const before = canvas.getRenderCount();

    engine.createNode({
      id: createNodeId("added"),
      type: "source",
      position: vec2(0, 0),
      label: "Added"
    });

    expect(canvas.getRenderCount()).toBeGreaterThan(before);
    expect(canvas.getRenderPlan().nodes).toHaveLength(1);

    canvas.dispose();
  });
});
