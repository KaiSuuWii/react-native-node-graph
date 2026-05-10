import type {
  CoreEngine,
  Edge,
  GraphInteractionContract,
  GraphSnapshot,
  GroupId,
  PortId,
  SelectionChangeMode,
  SelectionSnapshot
} from "@react-native-node-graph/core";
import { addVec2, subtractVec2, vec2, type Bounds, type NodeId, type Vec2 } from "@react-native-node-graph/shared";

import { createCameraState, panCamera, screenToGraphSpace, zoomCameraAtScreenPoint } from "./camera.js";
import { buildSceneSpatialIndex, hitTestSceneBounds, hitTestScenePoint } from "./hit-testing.js";
import { buildSkiaRenderScene } from "./scene.js";
import { resolveInteractionOptions, resolveRendererTheme } from "./theme.js";
import type {
  CameraState,
  ConnectionPreviewState,
  CreateGraphEditorOptions,
  GraphEditor,
  HitTestTarget,
  MarqueeSelectionState,
  RendererInteractionState,
  SkiaRenderPlan,
  SpatialIndex
} from "./types.js";

type DragState =
  | {
      readonly kind: "canvas";
      readonly lastScreenPoint: Vec2;
    }
  | {
      readonly kind: "nodes";
      readonly origin: Vec2;
      readonly nodeIds: readonly NodeId[];
      readonly initialPositions: Readonly<Record<string, Vec2>>;
    };

const DEFAULT_INTERACTION: GraphInteractionContract = {
  onEvent: () => undefined
};

const targetIdFromHit = (target: HitTestTarget): string | undefined => {
  switch (target.kind) {
    case "node":
      return target.nodeId;
    case "edge":
      return target.edgeId;
    case "group":
      return target.groupId;
    case "port":
      return target.portId;
    case "canvas":
      return undefined;
  }
};

const createBoundsFromPoints = (left: Vec2, right: Vec2): Bounds => ({
  min: vec2(Math.min(left.x, right.x), Math.min(left.y, right.y)),
  max: vec2(Math.max(left.x, right.x), Math.max(left.y, right.y))
});

const applyBoxSelection = (
  engine: CoreEngine,
  nodeIds: readonly NodeId[],
  mode: SelectionChangeMode
): SelectionSnapshot => {
  const orderedNodeIds = [...nodeIds].sort();

  if (mode === "replace") {
    if (orderedNodeIds.length === 0) {
      return engine.clearSelection();
    }

    engine.selectNode(orderedNodeIds[0]!);
    orderedNodeIds.slice(1).forEach((nodeId) => {
      engine.selectNode(nodeId, "add");
    });
    return engine.getSnapshot().selection;
  }

  orderedNodeIds.forEach((nodeId) => {
    engine.selectNode(nodeId, mode);
  });

  return engine.getSnapshot().selection;
};

const getNodePositions = (snapshot: GraphSnapshot, nodeIds: readonly NodeId[]): Record<string, Vec2> =>
  Object.fromEntries(
    nodeIds.map((nodeId) => [
      nodeId,
      snapshot.nodes.find((node) => node.id === nodeId)?.position ?? vec2(0, 0)
    ])
  );

const getPortPosition = (
  plan: SkiaRenderPlan,
  nodeId: NodeId,
  portId: PortId
): Vec2 | undefined =>
  plan.nodes.find((node) => node.id === nodeId)?.ports.find((port) => port.id === portId)?.position;

const clearConnectionPreview = (
  state: RendererInteractionState
): RendererInteractionState => {
  const { connectionPreview: _connectionPreview, ...rest } = state;
  return rest;
};

const clearMarqueeSelection = (
  state: RendererInteractionState
): RendererInteractionState => {
  const { marqueeSelection: _marqueeSelection, ...rest } = state;
  return rest;
};

export const createGraphEditor = (options: CreateGraphEditorOptions): GraphEditor => {
  const interaction = options.interaction ?? DEFAULT_INTERACTION;
  const theme = resolveRendererTheme(options.theme);
  const interactionOptions = resolveInteractionOptions(options.interactionOptions);
  let camera: CameraState = createCameraState(options.camera);
  let interactionState: RendererInteractionState = {};
  let dragState: DragState | undefined;

  const emitEvent = (phase: "start" | "move" | "end" | "cancel", position: Vec2, target?: string): void => {
    interaction.onEvent({
      pointerId: "editor",
      phase,
      position,
      timestampMs: Date.now(),
      ...(target !== undefined ? { targetId: target as never } : {})
    });
  };

  const getRenderPlan = (): SkiaRenderPlan => {
    const scene = buildSkiaRenderScene({
      snapshot: options.engine.getSnapshot(),
      viewport: options.viewport,
      camera,
      theme,
      plugins: options.plugins ?? [],
      interaction,
      interactionOptions,
      ...(Object.keys(interactionState).length > 0 ? { interactionState } : {})
    });
    const nodeLayer = scene.layers.find((layer) => layer.kind === "node");
    const edgeLayer = scene.layers.find((layer) => layer.kind === "edge");

    return {
      scene,
      nodes: nodeLayer?.kind === "node" ? nodeLayer.items : [],
      edges: edgeLayer?.kind === "edge" ? edgeLayer.items : [],
      interaction
    };
  };

  const getSpatialIndex = (): SpatialIndex => buildSceneSpatialIndex(getRenderPlan().scene);

  const beginNodeDrag = (nodeIds: readonly NodeId[], graphPoint: Vec2): void => {
    options.engine.beginTransaction("drag nodes");
    dragState = {
      kind: "nodes",
      origin: graphPoint,
      nodeIds,
      initialPositions: getNodePositions(options.engine.getSnapshot(), nodeIds)
    };
  };

  const tapAt: GraphEditor["tapAt"] = (screenPoint, mode = "replace") => {
      const graphPoint = screenToGraphSpace(screenPoint, camera);
      const hit = hitTestScenePoint(getRenderPlan().scene, getSpatialIndex(), graphPoint);

      if (hit.target.kind === "node") {
        options.engine.selectNode(hit.target.nodeId, mode);
      } else if (hit.target.kind === "edge") {
        options.engine.selectEdge(hit.target.edgeId, mode);
      } else if (hit.target.kind === "group") {
        options.engine.selectGroup(hit.target.groupId, mode);
      } else if (mode === "replace") {
        options.engine.clearSelection();
      }

      emitEvent("end", graphPoint, targetIdFromHit(hit.target));
      return hit;
    };

  const doubleTapAt: GraphEditor["doubleTapAt"] = (screenPoint) => {
      const hit = hitTestScenePoint(getRenderPlan().scene, getSpatialIndex(), screenToGraphSpace(screenPoint, camera));

      if (hit.target.kind === "canvas") {
        camera = createCameraState({
          position: vec2(0, 0),
          zoom: 1
        });
        return hit;
      }

      return tapAt(screenPoint, "toggle");
    };

  const longPressAt: GraphEditor["longPressAt"] = (screenPoint, mode = "replace") => {
      if (interactionOptions.longPressMarqueeEnabled) {
        const graphPoint = screenToGraphSpace(screenPoint, camera);
        interactionState = {
          ...interactionState,
          marqueeSelection: {
            start: graphPoint,
            current: graphPoint,
            mode
          }
        };
      }

      return {
        target: { kind: "canvas" },
        point: screenToGraphSpace(screenPoint, camera),
        distance: 0
      };
    };

  const startConnectionPreview: GraphEditor["startConnectionPreview"] = (screenPoint) => {
      const graphPoint = screenToGraphSpace(screenPoint, camera);
      const hit = hitTestScenePoint(getRenderPlan().scene, getSpatialIndex(), graphPoint);

      if (hit.target.kind !== "port") {
        return hit;
      }

      const sourcePosition = getPortPosition(getRenderPlan(), hit.target.nodeId, hit.target.portId);

      if (sourcePosition !== undefined) {
        interactionState = {
          ...interactionState,
          connectionPreview: {
            sourceNodeId: hit.target.nodeId,
            sourcePortId: hit.target.portId,
            sourcePosition,
            currentPosition: graphPoint,
            valid: false
          }
        };
      }

      emitEvent("start", graphPoint, hit.target.portId);
      return hit;
    };

  const beginDragAt: GraphEditor["beginDragAt"] = (screenPoint, mode = "replace") => {
      const graphPoint = screenToGraphSpace(screenPoint, camera);
      const hit = hitTestScenePoint(getRenderPlan().scene, getSpatialIndex(), graphPoint);
      const snapshot = options.engine.getSnapshot();

      if (hit.target.kind === "port") {
        return startConnectionPreview(screenPoint);
      }

      if (hit.target.kind === "node") {
        if (!snapshot.selection.nodeIds.includes(hit.target.nodeId)) {
          options.engine.selectNode(hit.target.nodeId, mode);
        }

        const activeSelection = options.engine.getSnapshot().selection;
        const dragIds = activeSelection.nodeIds.includes(hit.target.nodeId)
          ? activeSelection.nodeIds
          : [hit.target.nodeId];

        beginNodeDrag(dragIds, graphPoint);
      } else if (hit.target.kind === "group") {
        const groupId = hit.target.groupId;

        options.engine.selectGroup(groupId, mode);
        beginNodeDrag(
          options.engine.getSnapshot().groups.find((group) => group.id === groupId)?.nodeIds ?? [],
          graphPoint
        );
      } else {
        dragState = {
          kind: "canvas",
          lastScreenPoint: screenPoint
        };
      }

      emitEvent("start", graphPoint, targetIdFromHit(hit.target));
      return hit;
    };

  const updateConnectionPreview: GraphEditor["updateConnectionPreview"] = (screenPoint) => {
      const preview = interactionState.connectionPreview;

      if (preview === undefined) {
        return undefined;
      }

      const graphPoint = screenToGraphSpace(screenPoint, camera);
      const hit = hitTestScenePoint(getRenderPlan().scene, getSpatialIndex(), graphPoint);
      const snapshot = options.engine.getSnapshot();
      const nextPreview: ConnectionPreviewState =
        hit.target.kind === "port"
          ? {
              ...preview,
              currentPosition: graphPoint,
              targetNodeId: hit.target.nodeId,
              targetPortId: hit.target.portId,
              valid: options.engine.validateGraph({
                ...snapshot,
                edges: [
                  ...snapshot.edges,
                  {
                    id: `edge_preview_${preview.sourceNodeId}_${hit.target.nodeId}` as const,
                    source: preview.sourceNodeId,
                    target: hit.target.nodeId,
                    sourcePortId: preview.sourcePortId,
                    targetPortId: hit.target.portId,
                    metadata: {}
                  }
                ]
              }).isValid
            }
          : {
              ...preview,
              currentPosition: graphPoint,
              valid: false
            };

      interactionState = {
        ...interactionState,
        connectionPreview: nextPreview
      };
      return nextPreview;
    };

  const updateMarquee: GraphEditor["updateMarquee"] = (screenPoint) => {
      const marquee = interactionState.marqueeSelection;

      if (marquee === undefined) {
        return options.engine.getSnapshot().selection;
      }

      const current = screenToGraphSpace(screenPoint, camera);
      const nextMarquee: MarqueeSelectionState = {
        ...marquee,
        current
      };
      interactionState = {
        ...interactionState,
        marqueeSelection: nextMarquee
      };

      const bounds = createBoundsFromPoints(nextMarquee.start, current);
      const nodeIds = hitTestSceneBounds(getRenderPlan().scene, getSpatialIndex(), bounds)
        .flatMap((result) => (result.target.kind === "node" ? [result.target.nodeId] : []));

      return applyBoxSelection(options.engine, nodeIds, nextMarquee.mode);
    };

  const dragTo: GraphEditor["dragTo"] = (screenPoint) => {
      if (interactionState.connectionPreview !== undefined) {
        updateConnectionPreview(screenPoint);
        return options.engine.getSnapshot();
      }

      if (interactionState.marqueeSelection !== undefined) {
        updateMarquee(screenPoint);
        return options.engine.getSnapshot();
      }

      if (dragState === undefined) {
        return options.engine.getSnapshot();
      }

      const graphPoint = screenToGraphSpace(screenPoint, camera);

      if (dragState.kind === "canvas") {
        if (interactionOptions.panEnabled) {
          camera = panCamera(camera, subtractVec2(screenPoint, dragState.lastScreenPoint));
          dragState = {
            ...dragState,
            lastScreenPoint: screenPoint
          };
        }

        emitEvent("move", graphPoint);
        return options.engine.getSnapshot();
      }

      const activeDragState = dragState;
      const delta = subtractVec2(graphPoint, activeDragState.origin);

      activeDragState.nodeIds.forEach((nodeId) => {
        const initial = activeDragState.initialPositions[nodeId];

        if (initial !== undefined) {
          options.engine.updateNode(nodeId, {
            position: addVec2(initial, delta)
          });
        }
      });

      emitEvent("move", graphPoint);
      return options.engine.getSnapshot();
    };

  const commitConnectionPreview: GraphEditor["commitConnectionPreview"] = () => {
      const preview = interactionState.connectionPreview;

      if (
        preview === undefined ||
        !preview.valid ||
        preview.targetNodeId === undefined ||
        preview.targetPortId === undefined
      ) {
        interactionState = clearConnectionPreview(interactionState);
        return undefined;
      }

      const edge = options.engine.createEdge({
        source: preview.sourceNodeId,
        target: preview.targetNodeId,
        sourcePortId: preview.sourcePortId,
        targetPortId: preview.targetPortId
      });
      interactionState = clearConnectionPreview(interactionState);
      return edge;
    };

  const endDrag: GraphEditor["endDrag"] = () => {
      if (dragState?.kind === "nodes") {
        options.engine.endTransaction();
      }

      if (interactionState.connectionPreview !== undefined) {
        commitConnectionPreview();
      }

      dragState = undefined;
      return options.engine.getSnapshot();
    };

  const pinchAt: GraphEditor["pinchAt"] = (screenPoint, zoomFactor) => {
      if (interactionOptions.zoomEnabled) {
        camera = zoomCameraAtScreenPoint(camera, zoomFactor, screenPoint, interactionOptions);
      }

      return camera;
    };

  const beginMarquee: GraphEditor["beginMarquee"] = (screenPoint, mode = "replace") => {
      const graphPoint = screenToGraphSpace(screenPoint, camera);
      interactionState = {
        ...interactionState,
        marqueeSelection: {
          start: graphPoint,
          current: graphPoint,
          mode
        }
      };
    };

  const endMarquee: GraphEditor["endMarquee"] = () => {
      interactionState = clearMarqueeSelection(interactionState);
      return options.engine.getSnapshot().selection;
    };

  const cancelConnectionPreview: GraphEditor["cancelConnectionPreview"] = () => {
      interactionState = clearConnectionPreview(interactionState);
    };

  return {
    getSnapshot: () => options.engine.getSnapshot(),
    getCamera: () => camera,
    getRenderPlan,
    getSpatialIndex,
    getInteractionState: () => interactionState,
    tapAt,
    doubleTapAt,
    longPressAt,
    beginDragAt,
    dragTo,
    endDrag,
    pinchAt,
    beginMarquee,
    updateMarquee,
    endMarquee,
    startConnectionPreview,
    updateConnectionPreview,
    commitConnectionPreview,
    cancelConnectionPreview
  };
};
