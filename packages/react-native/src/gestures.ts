import {
  hitTestScenePoint,
  screenToGraphSpace
} from "@kaiisuuwii/renderer-skia";
import { subtractVec2, vec2 } from "@kaiisuuwii/shared";

import type {
  ComposedGesture,
  GestureParams,
  PanGestureEvent,
  PinchGestureEvent
} from "./types.js";

export const createNodeGraphGestures = ({
  editor,
  camera,
  dragController,
  options
}: GestureParams): ComposedGesture => {
  type ActivePanMode = "canvas" | "drag-node" | "marquee" | "connection" | undefined;

  let activePanMode: ActivePanMode;
  let panOrigin = vec2(0, 0);
  let panCameraOrigin = camera.toPlain().position;
  let pinchBaseZoom = camera.zoom.value;

  return {
    kind: "composed",
    singleTap: {
      kind: "tap",
      taps: 1,
      onEnd: (event) => {
        const hit = editor.tapAt(vec2(event.x, event.y));

        if (hit.target.kind === "node" || hit.target.kind === "text-content") {
          options.onNodeSelected?.(hit.target.nodeId);
        } else {
          options.onNodeSelected?.(undefined);
        }

        if (hit.target.kind === "edge") {
          options.onEdgeSelected?.(hit.target.edgeId);
        } else {
          options.onEdgeSelected?.(undefined);
        }
      }
    },
    doubleTap: {
      kind: "tap",
      taps: 2,
      onEnd: (event) => {
        const hit = editor.doubleTapAt(vec2(event.x, event.y));

        if (hit.target.kind === "node" || hit.target.kind === "text-content") {
          options.onNodeDoubleTap?.(hit.target.nodeId);
        }

        if (hit.target.kind === "text-content") {
          options.onTextEditBegin?.(hit.target.nodeId, hit.target.propertyKey);
        }
      }
    },
    longPress: {
      kind: "long-press",
      minDurationMs: 500,
      onStart: (event) => {
        if (options.marqueeEnabled === false) {
          return;
        }

        const point = vec2(event.x, event.y);
        editor.longPressAt(point);
        activePanMode = "marquee";
        options.engine.clearSelection();
      }
    },
    pan: {
      kind: "pan",
      minDistance: 8,
      onStart: (event: PanGestureEvent) => {
        const point = vec2(event.x, event.y);
        const graphPoint = screenToGraphSpace(point, camera.toPlain());
        const hit = hitTestScenePoint(editor.getRenderPlan().scene, editor.getSpatialIndex(), graphPoint);
        panOrigin = point;
        panCameraOrigin = camera.toPlain().position;

        if (hit.target.kind === "port" && options.connectionEnabled !== false) {
          activePanMode = "connection";
          editor.startConnectionPreview(point);
          return;
        }

        if ((hit.target.kind === "node" || hit.target.kind === "text-content") && options.dragEnabled !== false) {
          options.engine.selectNode(hit.target.nodeId);
          dragController.onDragStart(hit.target.nodeId, point);
          activePanMode = "drag-node";
          return;
        }

        if (activePanMode === "marquee") {
          return;
        }

        if (options.panEnabled !== false) {
          activePanMode = "canvas";
        }
      },
      onUpdate: (event: PanGestureEvent) => {
        const point = vec2(event.x, event.y);

        if (activePanMode === "drag-node") {
          dragController.onDragMove(point);
          return;
        }

        if (activePanMode === "connection") {
          editor.updateConnectionPreview(point);
          return;
        }

        if (activePanMode === "marquee") {
          editor.updateMarquee(point);
          return;
        }

        if (activePanMode === "canvas") {
          const delta = subtractVec2(point, panOrigin);
          camera.offsetX.value = panCameraOrigin.x - delta.x / Math.max(camera.zoom.value, 0.0001);
          camera.offsetY.value = panCameraOrigin.y - delta.y / Math.max(camera.zoom.value, 0.0001);
        }
      },
      onEnd: (event: PanGestureEvent) => {
        if (activePanMode === "drag-node") {
          dragController.onDragEnd();
        } else if (activePanMode === "connection") {
          const edge = editor.commitConnectionPreview();

          if (edge !== undefined) {
            options.onConnectionCreated?.(edge.id);
          }
        } else if (activePanMode === "marquee") {
          editor.endMarquee();
        } else if (activePanMode === "canvas") {
          camera.applyMomentum(vec2(event.velocityX ?? 0, event.velocityY ?? 0));
        }

        activePanMode = undefined;
      }
    },
    pinch: {
      kind: "pinch",
      onStart: (_event: PinchGestureEvent) => {
        pinchBaseZoom = camera.zoom.value;
      },
      onUpdate: (event: PinchGestureEvent) => {
        if (options.zoomEnabled === false) {
          return;
        }

        camera.animateZoomTo(pinchBaseZoom * event.scale, vec2(event.x, event.y));
      },
      onEnd: (event: PinchGestureEvent) => {
        if (options.zoomEnabled === false) {
          return;
        }

        camera.animateZoomTo(camera.zoom.value + (event.velocity ?? 0) * 0.01, vec2(event.x, event.y));
      }
    }
  };
};
