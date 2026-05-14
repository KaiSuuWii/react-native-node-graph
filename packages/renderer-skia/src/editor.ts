import type {
  CoreEngine,
  GraphInteractionContract,
  GraphSnapshot,
  PortId,
  SelectionChangeMode,
  SelectionSnapshot
} from "@kaiisuuwii/core";
import {
  addVec2,
  isTextContent,
  subtractVec2,
  vec2,
  type Bounds,
  type NodeId,
  type Vec2
} from "@kaiisuuwii/shared";

import { createCameraState, panCamera, screenToGraphSpace, zoomCameraAtScreenPoint } from "./camera.js";
import { buildSceneSpatialIndex, hitTestSceneBounds, hitTestScenePoint } from "./hit-testing.js";
import { createRendererImageCache } from "./image-cache.js";
import { createImageLoader } from "./image-loader.js";
import { buildSkiaRenderScene } from "./scene.js";
import {
  resolveRendererAccessibilityOptions,
  resolveDebugOptions,
  resolveInteractionOptions,
  resolveRendererTheme,
  resolveVirtualizationOptions
} from "./theme.js";
import type {
  CameraState,
  ConnectionPreviewState,
  CreateGraphEditorOptions,
  GraphEditor,
  HitTestTarget,
  MarqueeSelectionState,
  RendererInteractionState,
  SkiaRenderPlan,
  SpatialIndex,
  TextEditCommitEvent
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
    case "text-content":
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
  const rest = { ...state };
  delete (
    rest as {
      connectionPreview?: RendererInteractionState["connectionPreview"];
    }
  ).connectionPreview;
  return rest;
};

const clearMarqueeSelection = (
  state: RendererInteractionState
): RendererInteractionState => {
  const rest = { ...state };
  delete (
    rest as {
      marqueeSelection?: RendererInteractionState["marqueeSelection"];
    }
  ).marqueeSelection;
  return rest;
};

const clearEditingState = (
  state: RendererInteractionState
): RendererInteractionState => {
  const {
    editingNodeId: _editingNodeId,
    editingPropertyKey: _editingPropertyKey,
    editingValue: _editingValue,
    editingCursorPosition: _editingCursorPosition,
    editingSelectionRange: _editingSelectionRange,
    ...rest
  } = state;

  return rest;
};

export const createGraphEditor = (options: CreateGraphEditorOptions): GraphEditor => {
  const interaction = options.interaction ?? DEFAULT_INTERACTION;
  const theme = resolveRendererTheme(
    options.theme,
    options.themeMode,
    options.themeScale
  );
  const interactionOptions = resolveInteractionOptions(options.interactionOptions);
  const virtualization = resolveVirtualizationOptions(options.virtualization);
  const debug = resolveDebugOptions(options.debug);
  const accessibility = resolveRendererAccessibilityOptions(options.accessibility);
  let camera: CameraState = createCameraState(options.camera);
  let interactionState: RendererInteractionState = {};
  let dragState: DragState | undefined;
  let previousScene: SkiaRenderPlan["scene"] | undefined;
  const imageCache = options.imageCache ?? createRendererImageCache();
  const imageLoader = options.imageLoader ?? createImageLoader(imageCache);
  const invalidate = options.invalidate ?? (() => undefined);
  const imageSubscriptions = new Map<string, () => void>();

  const syncVisibleImageSubscriptions = (plan: SkiaRenderPlan): void => {
    const nextVisibleUris = new Set(
      plan.nodes.flatMap((node) =>
        node.imageContentItems.map((item) => item.content.uri)
      )
    );

    nextVisibleUris.forEach((uri) => {
      if (imageSubscriptions.has(uri)) {
        return;
      }

      const unsubscribe = imageLoader.load(uri, () => {
        invalidate();
      });

      imageSubscriptions.set(uri, unsubscribe);
    });

    Array.from(imageSubscriptions.entries()).forEach(([uri, unsubscribe]) => {
      if (nextVisibleUris.has(uri)) {
        return;
      }

      unsubscribe();
      imageSubscriptions.delete(uri);
    });
  };

  const emitEvent = (phase: "start" | "move" | "end" | "cancel", position: Vec2, target?: string): void => {
    const payload = {
      pointerId: "editor",
      phase,
      position,
      timestampMs: Date.now(),
      ...(target !== undefined ? { targetId: target as never } : {})
    };

    interaction.onEvent(payload);

    const pluginContext = {
      snapshot: options.engine.getSnapshot(),
      viewport: options.viewport,
      camera,
      theme,
      ...(Object.keys(interactionState).length > 0 ? { interactionState } : {})
    };

    (options.plugins ?? []).forEach((plugin) => {
      try {
        plugin.onInteractionEvent?.(payload, pluginContext);
      } catch {
        // Plugin interaction failures are isolated from editor behavior.
      }
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
      virtualization,
      debug,
      accessibility,
      resolveNodeType: options.engine.getNodeType,
      ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
      imageCache,
      frameTimestampMs: Date.now(),
      ...(previousScene !== undefined ? { previousScene } : {}),
      ...(Object.keys(interactionState).length > 0 ? { interactionState } : {})
    });
    const nodeLayer = scene.layers.find((layer) => layer.kind === "node");
    const edgeLayer = scene.layers.find((layer) => layer.kind === "edge");
    previousScene = scene;
    const plan = {
      scene,
      nodes: nodeLayer?.kind === "node" ? nodeLayer.items : [],
      edges: edgeLayer?.kind === "edge" ? edgeLayer.items : [],
      interaction
    };

    syncVisibleImageSubscriptions(plan);

    return plan;
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

      if (hit.target.kind === "text-content") {
        options.engine.selectNode(hit.target.nodeId, mode);
      } else if (hit.target.kind === "node") {
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
      const hit = hitTestScenePoint(
        getRenderPlan().scene,
        getSpatialIndex(),
        screenToGraphSpace(screenPoint, camera)
      );

      if (hit.target.kind === "canvas") {
        camera = createCameraState({
          position: vec2(0, 0),
          zoom: 1
        });
        return hit;
      }

      if (hit.target.kind === "text-content") {
        options.engine.selectNode(hit.target.nodeId);
        beginTextEdit(hit.target.nodeId, hit.target.propertyKey);
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

      if (hit.target.kind === "text-content") {
        options.engine.selectNode(hit.target.nodeId, mode);
        return hit;
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

  const beginTextEdit: GraphEditor["beginTextEdit"] = (nodeId, propertyKey) => {
      interactionState = clearEditingState(interactionState);
      const node = options.engine.getSnapshot().nodes.find((entry) => entry.id === nodeId);
      const content = node === undefined ? undefined : node.properties[propertyKey];

      if (!isTextContent(content)) {
        return;
      }

      const textContent = content;

      interactionState = {
        ...interactionState,
        editingNodeId: nodeId,
        editingPropertyKey: propertyKey,
        editingValue: textContent.value,
        editingCursorPosition: textContent.value.length
      };
    };

  const updateEditingValue: GraphEditor["updateEditingValue"] = (value, cursorPosition) => {
      if (interactionState.editingNodeId === undefined || interactionState.editingPropertyKey === undefined) {
        return;
      }

      interactionState = {
        ...interactionState,
        editingValue: value,
        editingCursorPosition: cursorPosition
      };
    };

  const setEditingSelection: GraphEditor["setEditingSelection"] = (start, end) => {
      if (interactionState.editingNodeId === undefined || interactionState.editingPropertyKey === undefined) {
        return;
      }

      interactionState = {
        ...interactionState,
        editingSelectionRange: {
          start,
          end
        }
      };
    };

  const commitTextEdit: GraphEditor["commitTextEdit"] = () => {
      const nodeId = interactionState.editingNodeId;
      const propertyKey = interactionState.editingPropertyKey;

      if (nodeId === undefined || propertyKey === undefined) {
        return undefined;
      }

      const node = options.engine.getSnapshot().nodes.find((entry) => entry.id === nodeId);
      const currentValue = node?.properties[propertyKey];

      if (node === undefined || !isTextContent(currentValue)) {
        interactionState = clearEditingState(interactionState);
        return undefined;
      }

      const textContent = currentValue;

      const nextValue = interactionState.editingValue ?? textContent.value;
      const nextContent = {
        ...textContent,
        value: nextValue
      };

      options.engine.updateNode(nodeId, {
        properties: {
          ...node.properties,
          [propertyKey]: nextContent
        }
      });
      interactionState = clearEditingState(interactionState);

      const event: TextEditCommitEvent = {
        nodeId,
        propertyKey,
        previousValue: textContent.value,
        newValue: nextValue
      };

      return event;
    };

  const cancelTextEdit: GraphEditor["cancelTextEdit"] = () => {
      interactionState = clearEditingState(interactionState);
    };

  const isEditing: GraphEditor["isEditing"] = () =>
    interactionState.editingNodeId !== undefined && interactionState.editingPropertyKey !== undefined;

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
    cancelConnectionPreview,
    beginTextEdit,
    updateEditingValue,
    setEditingSelection,
    commitTextEdit,
    cancelTextEdit,
    isEditing,
    dispose: () => {
      Array.from(imageSubscriptions.values()).forEach((unsubscribe) => unsubscribe());
      imageSubscriptions.clear();
      imageLoader.dispose();
      imageCache.clear();
    }
  };
};
