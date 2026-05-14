import type {
  CoreEngine,
  EdgeInput,
  GraphEdgeSnapshot,
  GraphNodeSnapshot,
  GraphSnapshot,
  NodeInput,
  UpdateNodeInput
} from "@kaiisuuwii/core";
import type { EdgeId, NodeId } from "@kaiisuuwii/shared";
import * as Y from "yjs";

import type {
  EngineBridge,
  EngineBridgeOptions,
  QueuedOperation,
  YjsGraphDocument
} from "./types.js";

const createNestedMap = (record: Record<string, unknown>): Y.Map<unknown> => {
  const map = new Y.Map<unknown>();
  Object.entries(record).forEach(([key, value]) => {
    map.set(key, value);
  });
  return map;
};

const cloneJsonValue = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

const toReadonlyRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return cloneJsonValue(value as Record<string, unknown>);
};

const toStringArray = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const cloneYMap = (map: Y.Map<unknown>): Record<string, unknown> => {
  const record: Record<string, unknown> = {};
  map.forEach((value, key) => {
    record[key] = cloneJsonValue(value);
  });
  return record;
};

export const nodeToYjsMap = (node: GraphNodeSnapshot): Record<string, unknown> => ({
  id: node.id,
  type: node.type,
  position: cloneJsonValue(node.position),
  dimensions: cloneJsonValue(node.dimensions),
  label: node.label,
  properties: cloneJsonValue(node.properties),
  ports: cloneJsonValue(node.ports),
  metadata: cloneJsonValue(node.metadata),
  ...(node.groupId !== undefined ? { groupId: node.groupId } : {})
});

export const yjsMapToNodeInput = (map: Y.Map<unknown>): NodeInput => ({
  id: map.get("id") as NodeId,
  type: String(map.get("type") ?? "node"),
  position: cloneJsonValue(map.get("position")) as NodeInput["position"],
  ...(map.get("dimensions") !== undefined
    ? { dimensions: cloneJsonValue(map.get("dimensions")) as NonNullable<NodeInput["dimensions"]> }
    : {}),
  ...(typeof map.get("label") === "string" ? { label: String(map.get("label")) } : {}),
  properties: toReadonlyRecord(map.get("properties")),
  ports: (cloneJsonValue(map.get("ports")) as NonNullable<NodeInput["ports"]> | undefined) ?? [],
  metadata: toReadonlyRecord(map.get("metadata")),
  ...(typeof map.get("groupId") === "string"
    ? { groupId: map.get("groupId") as NonNullable<NodeInput["groupId"]> }
    : {})
});

export const edgeToYjsMap = (edge: GraphEdgeSnapshot): Record<string, unknown> => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  ...(edge.sourcePortId !== undefined ? { sourcePortId: edge.sourcePortId } : {}),
  ...(edge.targetPortId !== undefined ? { targetPortId: edge.targetPortId } : {}),
  ...(edge.dataType !== undefined ? { dataType: edge.dataType } : {}),
  metadata: cloneJsonValue(edge.metadata)
});

export const yjsMapToEdgeInput = (map: Y.Map<unknown>): EdgeInput => ({
  id: map.get("id") as EdgeId,
  source: map.get("source") as EdgeInput["source"],
  target: map.get("target") as EdgeInput["target"],
  ...(typeof map.get("sourcePortId") === "string"
    ? { sourcePortId: map.get("sourcePortId") as NonNullable<EdgeInput["sourcePortId"]> }
    : {}),
  ...(typeof map.get("targetPortId") === "string"
    ? { targetPortId: map.get("targetPortId") as NonNullable<EdgeInput["targetPortId"]> }
    : {}),
  ...(typeof map.get("dataType") === "string" ? { dataType: String(map.get("dataType")) } : {}),
  ...(map.get("metadata") !== undefined ? { metadata: toReadonlyRecord(map.get("metadata")) } : {})
});

const toUpdateNodeInput = (nextNode: NodeInput, currentSnapshot: GraphSnapshot): UpdateNodeInput => {
  const currentNode = currentSnapshot.nodes.find((node) => node.id === nextNode.id);

  return {
    position: nextNode.position,
    ...(nextNode.dimensions !== undefined ? { dimensions: nextNode.dimensions } : {}),
    ...(nextNode.label !== undefined ? { label: nextNode.label } : {}),
    ...(nextNode.properties !== undefined ? { properties: nextNode.properties } : {}),
    ...(nextNode.ports !== undefined ? { ports: nextNode.ports } : {}),
    ...(nextNode.metadata !== undefined ? { metadata: nextNode.metadata } : {}),
    ...(nextNode.groupId !== undefined
      ? { groupId: nextNode.groupId }
      : currentNode?.groupId !== undefined
        ? { groupId: null }
        : {})
  };
};

const clearGraphMaps = (document: YjsGraphDocument): void => {
  document.nodes.clear();
  document.edges.clear();
  document.groups.clear();
  document.metadata.clear();
};

const readSnapshotFromYjs = (
  document: YjsGraphDocument,
  fallback: GraphSnapshot
): GraphSnapshot => ({
  id:
    (typeof document.schema.get("graphId") === "string"
      ? document.schema.get("graphId")
      : fallback.id) as GraphSnapshot["id"],
  metadata:
    document.metadata.size > 0
      ? cloneJsonValue(Object.fromEntries(document.metadata.entries())) as unknown as GraphSnapshot["metadata"]
      : fallback.metadata,
  nodes: [...document.nodes.values()].map((entry) => {
    const input = yjsMapToNodeInput(entry);
    return {
      id: input.id as NodeId,
      type: input.type,
      position: input.position,
      dimensions: input.dimensions ?? fallback.nodes.find((node) => node.id === input.id)?.dimensions ?? { x: 0, y: 0 },
      label: input.label ?? input.type,
      properties: input.properties ?? {},
      ports: (input.ports ?? []) as GraphSnapshot["nodes"][number]["ports"],
      metadata: input.metadata ?? {},
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {})
    };
  }),
  edges: [...document.edges.values()].map((entry) => {
    const input = yjsMapToEdgeInput(entry);
    return {
      id: input.id as EdgeId,
      source: input.source,
      target: input.target,
      ...(input.sourcePortId !== undefined ? { sourcePortId: input.sourcePortId } : {}),
      ...(input.targetPortId !== undefined ? { targetPortId: input.targetPortId } : {}),
      ...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
      metadata: input.metadata ?? {}
    };
  }),
  groups: [...document.groups.values()].map((group) => {
    const record = cloneYMap(group);
    return {
      id: record.id as GraphSnapshot["groups"][number]["id"],
      name: typeof record.name === "string" ? record.name : "Group",
      nodeIds: toStringArray(record.nodeIds) as GraphSnapshot["groups"][number]["nodeIds"],
      metadata: toReadonlyRecord(record.metadata) as GraphSnapshot["groups"][number]["metadata"]
    };
  }),
  selection: fallback.selection
});

export const createEngineBridge = (
  engine: CoreEngine,
  yjsDocument: YjsGraphDocument,
  options: EngineBridgeOptions = {}
): EngineBridge => {
  let isApplyingRemote = false;
  const shouldWriteLocal = options.shouldWriteLocal ?? (() => true);

  const writeNode = (node: GraphNodeSnapshot): void => {
    yjsDocument.ydoc.transact(() => {
      yjsDocument.nodes.set(node.id, createNestedMap(nodeToYjsMap(node)));
      yjsDocument.schema.set("graphId", engine.getSnapshot().id);
    }, "engine-local");
  };

  const writeEdge = (edge: GraphEdgeSnapshot): void => {
    yjsDocument.ydoc.transact(() => {
      yjsDocument.edges.set(edge.id, createNestedMap(edgeToYjsMap(edge)));
      yjsDocument.schema.set("graphId", engine.getSnapshot().id);
    }, "engine-local");
  };

  const removeNode = (nodeId: NodeId): void => {
    yjsDocument.ydoc.transact(() => {
      yjsDocument.nodes.delete(nodeId);
      [...yjsDocument.edges.entries()].forEach(([edgeId, edgeMap]) => {
        if (edgeMap.get("source") === nodeId || edgeMap.get("target") === nodeId) {
          yjsDocument.edges.delete(edgeId as EdgeId);
        }
      });
    }, "engine-local");
  };

  const removeEdge = (edgeId: EdgeId): void => {
    yjsDocument.ydoc.transact(() => {
      yjsDocument.edges.delete(edgeId);
    }, "engine-local");
  };

  const applySnapshotToYjs = (snapshot: GraphSnapshot): void => {
    yjsDocument.ydoc.transact(() => {
      clearGraphMaps(yjsDocument);
      Object.entries(snapshot.metadata as unknown as Record<string, unknown>).forEach(([key, value]) => {
        yjsDocument.metadata.set(key, cloneJsonValue(value));
      });
      yjsDocument.schema.set("graphId", snapshot.id);
      snapshot.nodes.forEach((node) => {
        yjsDocument.nodes.set(node.id, createNestedMap(nodeToYjsMap(node)));
      });
      snapshot.edges.forEach((edge) => {
        yjsDocument.edges.set(edge.id, createNestedMap(edgeToYjsMap(edge)));
      });
      snapshot.groups.forEach((group) => {
        yjsDocument.groups.set(group.id, createNestedMap({
          id: group.id,
          name: group.name,
          nodeIds: cloneJsonValue(group.nodeIds),
          metadata: cloneJsonValue(group.metadata)
        }));
      });
    }, "engine-local");
  };

  const applyQueuedOperation = (operation: QueuedOperation): void => {
    switch (operation.kind) {
      case "nodeAdded":
      case "nodeUpdated":
        writeNode(operation.node);
        break;
      case "nodeRemoved":
        removeNode(operation.nodeId);
        break;
      case "edgeCreated":
        writeEdge(operation.edge);
        break;
      case "edgeDeleted":
        removeEdge(operation.edgeId);
        break;
    }
  };

  const getSnapshotFromYjs = (): GraphSnapshot => readSnapshotFromYjs(yjsDocument, engine.getSnapshot());

  const applyYjsToEngine = (): void => {
    isApplyingRemote = true;

    try {
      engine.importGraph({
        version: 1,
        graph: getSnapshotFromYjs()
      });
    } finally {
      isApplyingRemote = false;
    }
  };

  const applyRemoteNodeChange = (nodeId: string): void => {
    const nodeMap = yjsDocument.nodes.get(nodeId);
    const snapshot = engine.getSnapshot();
    const existingNode = snapshot.nodes.find((node) => node.id === nodeId);

    if (nodeMap === undefined) {
      if (existingNode !== undefined) {
        engine.deleteNode(nodeId as NodeId);
      }
      return;
    }

    const nextInput = yjsMapToNodeInput(nodeMap);

    if (existingNode === undefined) {
      engine.createNode(nextInput);
      return;
    }

    engine.updateNode(nodeId as NodeId, toUpdateNodeInput(nextInput, snapshot));
  };

  const applyRemoteEdgeChange = (edgeId: string): void => {
    const edgeMap = yjsDocument.edges.get(edgeId);
    const snapshot = engine.getSnapshot();
    const existingEdge = snapshot.edges.find((edge) => edge.id === edgeId);

    if (edgeMap === undefined) {
      if (existingEdge !== undefined) {
        engine.deleteEdge(edgeId as EdgeId);
      }
      return;
    }

    const nextInput = yjsMapToEdgeInput(edgeMap);

    if (
      existingEdge !== undefined &&
      existingEdge.source === nextInput.source &&
      existingEdge.target === nextInput.target &&
      existingEdge.sourcePortId === nextInput.sourcePortId &&
      existingEdge.targetPortId === nextInput.targetPortId
    ) {
      return;
    }

    if (existingEdge !== undefined) {
      engine.deleteEdge(edgeId as EdgeId);
    }

    engine.createEdge(nextInput);
  };

  const nodesObserver = (event: Y.YMapEvent<Y.Map<unknown>>): void => {
    isApplyingRemote = true;

    try {
      event.changes.keys.forEach((_change, nodeId) => {
        applyRemoteNodeChange(nodeId);
      });
    } finally {
      isApplyingRemote = false;
    }
  };

  const edgesObserver = (event: Y.YMapEvent<Y.Map<unknown>>): void => {
    isApplyingRemote = true;

    try {
      event.changes.keys.forEach((_change, edgeId) => {
        applyRemoteEdgeChange(edgeId);
      });
    } finally {
      isApplyingRemote = false;
    }
  };

  yjsDocument.nodes.observe(nodesObserver);
  yjsDocument.edges.observe(edgesObserver);

  const originalCreateNode = engine.createNode.bind(engine);
  const originalUpdateNode = engine.updateNode.bind(engine);
  const originalDeleteNode = engine.deleteNode.bind(engine);
  const originalCreateEdge = engine.createEdge.bind(engine);
  const originalDeleteEdge = engine.deleteEdge.bind(engine);
  const originalImportGraph = engine.importGraph.bind(engine);
  const originalLoadGraph = engine.loadGraph.bind(engine);

  (engine as any).createNode = ((input: NodeInput) => {
    const node = originalCreateNode(input);

    if (!isApplyingRemote) {
      if (shouldWriteLocal()) {
        writeNode(node);
      } else {
        options.onLocalOperation?.({ kind: "nodeAdded", node });
      }
    }

    return node;
  }) as CoreEngine["createNode"];

  (engine as any).updateNode = ((nodeId: NodeId, input: UpdateNodeInput) => {
    const node = originalUpdateNode(nodeId, input);

    if (!isApplyingRemote) {
      if (shouldWriteLocal()) {
        writeNode(node);
      } else {
        options.onLocalOperation?.({ kind: "nodeUpdated", node });
      }
    }

    return node;
  }) as CoreEngine["updateNode"];

  (engine as any).deleteNode = ((nodeId: NodeId) => {
    const before = engine.getSnapshot();
    const removedEdges = before.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
    const deleted = originalDeleteNode(nodeId);

    if (deleted && !isApplyingRemote) {
      if (shouldWriteLocal()) {
        removeNode(nodeId);
      } else {
        options.onLocalOperation?.({ kind: "nodeRemoved", nodeId });
        removedEdges.forEach((edge) => {
          options.onLocalOperation?.({ kind: "edgeDeleted", edgeId: edge.id });
        });
      }
    }

    return deleted;
  }) as CoreEngine["deleteNode"];

  (engine as any).createEdge = ((input: EdgeInput) => {
    const edge = originalCreateEdge(input);

    if (!isApplyingRemote) {
      if (shouldWriteLocal()) {
        writeEdge(edge);
      } else {
        options.onLocalOperation?.({ kind: "edgeCreated", edge });
      }
    }

    return edge;
  }) as CoreEngine["createEdge"];

  (engine as any).deleteEdge = ((edgeId: EdgeId) => {
    const deleted = originalDeleteEdge(edgeId);

    if (deleted && !isApplyingRemote) {
      if (shouldWriteLocal()) {
        removeEdge(edgeId);
      } else {
        options.onLocalOperation?.({ kind: "edgeDeleted", edgeId });
      }
    }

    return deleted;
  }) as CoreEngine["deleteEdge"];

  (engine as any).importGraph = ((document: Parameters<CoreEngine["importGraph"]>[0], migrationRegistry?: Parameters<CoreEngine["importGraph"]>[1]) => {
    const snapshot = originalImportGraph(document, migrationRegistry);

    if (!isApplyingRemote && shouldWriteLocal()) {
      applySnapshotToYjs(snapshot);
    }

    return snapshot;
  }) as CoreEngine["importGraph"];

  (engine as any).loadGraph = ((graph: Parameters<CoreEngine["loadGraph"]>[0]) => {
    const snapshot = originalLoadGraph(graph);

    if (!isApplyingRemote && shouldWriteLocal()) {
      applySnapshotToYjs(snapshot);
    }

    return snapshot;
  }) as CoreEngine["loadGraph"];

  return {
    yjsDocument,
    applyQueuedOperation,
    applySnapshotToYjs,
    applyYjsToEngine,
    getSnapshotFromYjs,
    isEmpty: () => yjsDocument.nodes.size === 0 && yjsDocument.edges.size === 0 && yjsDocument.groups.size === 0,
    dispose: () => {
      yjsDocument.nodes.unobserve(nodesObserver);
      yjsDocument.edges.unobserve(edgesObserver);
      (engine as any).createNode = originalCreateNode;
      (engine as any).updateNode = originalUpdateNode;
      (engine as any).deleteNode = originalDeleteNode;
      (engine as any).createEdge = originalCreateEdge;
      (engine as any).deleteEdge = originalDeleteEdge;
      (engine as any).importGraph = originalImportGraph;
      (engine as any).loadGraph = originalLoadGraph;
    }
  };
};
