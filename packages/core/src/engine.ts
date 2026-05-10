import { DEFAULT_NODE_SIZE, type EdgeId, type NodeId } from "@react-native-node-graph/shared";

import { buildExecutionPlan, validateExecutionPlan } from "./execution.js";
import { createEdgeFactory, createGroupFactory, createNodeFactory, makePortId } from "./ids.js";
import {
  DEFAULT_ID_SEED,
  GRAPH_DOCUMENT_VERSION,
  cloneEdge,
  cloneGroup,
  cloneMetadata,
  cloneNode,
  cloneNodeWithoutGroup,
  clonePort,
  cloneSelection,
  compareById,
  resolveActiveSelectionMode
} from "./model.js";
import { makeEmptyState, setSelectionFromSnapshot, type InternalState } from "./state.js";
import {
  assertEdgeEndpoints,
  assertGroupConsistency,
  createValidationResult,
  ensureEngineActive,
  rebuildIndices,
  updateGroupMembership,
  validateEdgeInputAgainstState,
  validateGraphData
} from "./validation.js";
import type {
  CoreEngine,
  CoreEventListener,
  CoreEventMap,
  CoreEventName,
  CoreValidationPolicies,
  CreateCoreEngineOptions,
  Edge,
  ExecutionCacheEntry,
  ExecutionContext,
  ExecutionInputValue,
  ExecutionPolicy,
  ExecutionResult,
  ExecutionRunHandle,
  ExecutionRuntimeError,
  ExecutionStatus,
  GraphPlugin,
  GraphPluginContext,
  GraphPluginState,
  GraphDocument,
  GraphDocumentEnvelope,
  GraphInput,
  GraphMigration,
  GraphMigrationRegistry,
  GraphSnapshot,
  Group,
  GroupId,
  HistoryCommand,
  Node,
  NodeInput,
  NodeTypeDefinition,
  SelectionChangeMode,
  SelectionSnapshot,
  UpdateNodeInput,
  ValidationResult
} from "./types.js";
import { CoreGraphError } from "./types.js";

const cloneSelectionFromState = (state: InternalState): SelectionSnapshot =>
  cloneSelection({
    nodeIds: [...state.selection.nodeIds],
    edgeIds: [...state.selection.edgeIds],
    groupIds: [...state.selection.groupIds]
  });

const cloneSnapshot = (state: InternalState): GraphSnapshot => ({
  id: state.id,
  metadata: cloneMetadata(state.metadata),
  nodes: [...state.nodeMap.values()].sort(compareById).map((node) => ({
    ...cloneNode(node),
    ports: [...node.ports].sort(compareById).map((port) => clonePort(port, port.id))
  })),
  edges: [...state.edgeMap.values()].sort(compareById).map((edge) => cloneEdge(edge)),
  groups: [...state.groupMap.values()].sort(compareById).map((group) => cloneGroup(group)),
  selection: cloneSelectionFromState(state)
});

const pruneSelectionAgainstState = (targetState: InternalState): void => {
  targetState.selection.nodeIds = new Set(
    [...targetState.selection.nodeIds].filter((nodeId) => targetState.nodeMap.has(nodeId))
  );
  targetState.selection.edgeIds = new Set(
    [...targetState.selection.edgeIds].filter((edgeId) => targetState.edgeMap.has(edgeId))
  );
  targetState.selection.groupIds = new Set(
    [...targetState.selection.groupIds].filter((groupId) => targetState.groupMap.has(groupId))
  );
};

const createCompositeCommand = (label: string, commands: readonly HistoryCommand[]): HistoryCommand => ({
  label,
  execute: () => {
    for (const command of commands) {
      command.execute();
    }
  },
  undo: () => {
    for (const command of [...commands].reverse()) {
      command.undo();
    }
  }
});

const isGraphDocumentEnvelope = (document: GraphDocument): document is GraphDocumentEnvelope =>
  "version" in document && "graph" in document;

const EXECUTION_POLICY: ExecutionPolicy = {
  graph: "dag",
  ordering: "pull",
  asyncNodes: "await",
  batching: "topological-levels",
  caching: "node-output"
};

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort((left, right) =>
    left[0].localeCompare(right[0])
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(",")}}`;
};

const createExecutionId = (sequence: number): string =>
  `execution_${sequence.toString(36).padStart(4, "0")}`;

const createExecutionTimestamp = (): string => new Date().toISOString();

const createExecutionError = (
  code: string,
  message: string,
  nodeId?: NodeId,
  edgeId?: EdgeId
): ExecutionRuntimeError => ({
  code,
  message,
  ...(nodeId !== undefined ? { nodeId } : {}),
  ...(edgeId !== undefined ? { edgeId } : {})
});

const toGraphPluginState = (
  plugin: GraphPlugin,
  initialized: boolean,
  lastError?: string
): GraphPluginState => ({
  name: plugin.name,
  initialized,
  hookCount: Object.values(plugin.hooks ?? {}).filter((hook) => hook !== undefined).length,
  hasDispose: plugin.dispose !== undefined,
  ...(lastError !== undefined ? { lastError } : {})
});

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export const createMigrationRegistry = (
  migrations: readonly GraphMigration[] = [],
  latestVersion = GRAPH_DOCUMENT_VERSION
): GraphMigrationRegistry => {
  const byVersion = new Map<number, GraphMigration>();

  for (const migration of migrations) {
    byVersion.set(migration.fromVersion, migration);
  }

  return {
    getLatestVersion: () => latestVersion,
    registerMigration: (migration) => {
      byVersion.set(migration.fromVersion, migration);
    },
    migrate: (document) => {
      let current = document;

      while (current.version < latestVersion) {
        const migration = byVersion.get(current.version);

        if (migration === undefined) {
          throw new CoreGraphError(
            "GRAPH_MIGRATION_MISSING",
            `No graph migration registered for version ${current.version}`
          );
        }

        current = migration.migrate(current);
      }

      return current;
    }
  };
};

export const createCoreEngine = (options: CreateCoreEngineOptions = {}): CoreEngine => {
  interface PluginRuntimeRecord {
    plugin: GraphPlugin;
    cleanup?: () => void;
    state: GraphPluginState;
  }

  const idSeed = options.idSeed ?? DEFAULT_ID_SEED;
  const nextNodeId = createNodeFactory(idSeed);
  const nextEdgeId = createEdgeFactory(idSeed);
  const nextGroupId = createGroupFactory(idSeed);
  const policies: Required<CoreValidationPolicies> = {
    allowSelfLoops: options.allowSelfLoops ?? false,
    allowCycles: options.allowCycles ?? true
  };
  const nodeTypes = new Map<string, NodeTypeDefinition>();
  const listeners: {
    [K in CoreEventName]: Set<CoreEventListener<K>>;
  } = {
    nodeAdded: new Set(),
    nodeRemoved: new Set(),
    edgeCreated: new Set(),
    edgeDeleted: new Set(),
    graphLoaded: new Set(),
    selectionChanged: new Set(),
    executionStarted: new Set(),
    executionCompleted: new Set()
  };
  let api!: CoreEngine;
  let disposed = false;
  let state = makeEmptyState(options.graph);
  let executionSequence = 0;
  const executionCache = new Map<NodeId, ExecutionCacheEntry>();
  const activeExecutions = new Map<string, AbortController>();
  const pluginRuntimes = new Map<string, PluginRuntimeRecord>();

  const emit = <K extends CoreEventName>(eventName: K, payload: CoreEventMap[K]): void => {
    for (const listener of listeners[eventName]) {
      listener(payload);
    }
  };

  const snapshot = (): GraphSnapshot => cloneSnapshot(state);

  const toExecutionSnapshot = (graph?: GraphInput | GraphSnapshot): GraphSnapshot =>
    graph === undefined
      ? snapshot()
      : {
          id: graph.id ?? state.id,
          metadata: cloneMetadata(graph.metadata ?? state.metadata),
          nodes: (graph.nodes ?? []).map((node) => cloneNode(node)).sort(compareById),
          edges: (graph.edges ?? []).map((edge) => cloneEdge(edge)).sort(compareById),
          groups: (graph.groups ?? []).map((group) => cloneGroup(group)).sort(compareById),
          selection: cloneSelection(graph.selection)
        };

  const snapshotSelection = (): SelectionSnapshot => cloneSelectionFromState(state);

  const resetHistory = (): void => {
    state.history.undoStack = [];
    state.history.redoStack = [];
    state.history.transactionStack = [];
  };

  const createPluginContext = (): GraphPluginContext => ({
    engine: api,
    executionPolicy: EXECUTION_POLICY
  });

  const updatePluginState = (pluginName: string, lastError?: string): void => {
    const runtime = pluginRuntimes.get(pluginName);

    if (runtime === undefined) {
      return;
    }

    runtime.state = toGraphPluginState(runtime.plugin, runtime.state.initialized, lastError);
  };

  const collectDownstreamNodeIds = (nodeIds: readonly NodeId[]): readonly NodeId[] => {
    const queue = [...nodeIds];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined || visited.has(current)) {
        continue;
      }

      visited.add(current);

      for (const edgeId of state.outgoingEdges.get(current) ?? []) {
        const targetNodeId = state.edgeMap.get(edgeId)?.target;

        if (targetNodeId !== undefined && !visited.has(targetNodeId)) {
          queue.push(targetNodeId);
        }
      }
    }

    return [...visited].sort();
  };

  const invalidateExecutionCache = (nodeIds?: readonly NodeId[]): readonly NodeId[] => {
    if (nodeIds === undefined || nodeIds.length === 0) {
      const invalidated = [...executionCache.keys()].sort();
      executionCache.clear();
      return invalidated;
    }

    const invalidated = collectDownstreamNodeIds(nodeIds);

    invalidated.forEach((nodeId) => {
      executionCache.delete(nodeId);
    });

    return invalidated;
  };

  const requireNode = (nodeId: NodeId): Node => {
    const node = state.nodeMap.get(nodeId);

    if (node === undefined) {
      throw new CoreGraphError("NODE_NOT_FOUND", `Node "${nodeId}" does not exist`);
    }

    return node;
  };

  const requireEdge = (edgeId: EdgeId): Edge => {
    const edge = state.edgeMap.get(edgeId);

    if (edge === undefined) {
      throw new CoreGraphError("EDGE_NOT_FOUND", `Edge "${edgeId}" does not exist`);
    }

    return edge;
  };

  const requireGroup = (groupId: GroupId): Group => {
    const group = state.groupMap.get(groupId);

    if (group === undefined) {
      throw new CoreGraphError("GROUP_NOT_FOUND", `Group "${groupId}" does not exist`);
    }

    return group;
  };

  const requireNodeType = (type: string): NodeTypeDefinition => {
    const definition = nodeTypes.get(type);

    if (definition === undefined) {
      throw new CoreGraphError(
        "NODE_TYPE_NOT_REGISTERED",
        `Node type "${type}" has not been registered`
      );
    }

    return definition;
  };

  const runBeforeNodeCreateHooks = (input: NodeInput): void => {
    for (const runtime of pluginRuntimes.values()) {
      try {
        runtime.plugin.hooks?.beforeNodeCreate?.(input, api);
      } catch (error) {
        updatePluginState(
          runtime.plugin.name,
          error instanceof Error ? error.message : String(error)
        );
        throw new CoreGraphError(
          "PLUGIN_HOOK_FAILED",
          `Plugin "${runtime.plugin.name}" blocked node creation: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  };

  const runAfterNodeCreateHooks = (node: Node): void => {
    for (const runtime of pluginRuntimes.values()) {
      try {
        runtime.plugin.hooks?.afterNodeCreate?.(node, api);
        updatePluginState(runtime.plugin.name);
      } catch (error) {
        updatePluginState(
          runtime.plugin.name,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  };

  const emitSelectionIfChanged = (previous: SelectionSnapshot): SelectionSnapshot => {
    const next = snapshotSelection();

    if (
      previous.activeSelectionMode !== next.activeSelectionMode ||
      previous.nodeIds.join("|") !== next.nodeIds.join("|") ||
      previous.edgeIds.join("|") !== next.edgeIds.join("|") ||
      previous.groupIds.join("|") !== next.groupIds.join("|")
    ) {
      emit("selectionChanged", {
        selection: next,
        graph: snapshot()
      });
    }

    return next;
  };

  const applySelection = (
    selection: Pick<SelectionSnapshot, "nodeIds" | "edgeIds" | "groupIds">
  ): SelectionSnapshot => {
    const previous = snapshotSelection();
    setSelectionFromSnapshot(state, selection);
    return emitSelectionIfChanged(previous);
  };

  const mutateSelectionSet = <T extends string>(
    currentValues: readonly T[],
    targetValue: T,
    mode: SelectionChangeMode
  ): T[] => {
    if (mode === "replace") {
      return [targetValue];
    }

    const next = new Set(currentValues);

    if (mode === "add") {
      next.add(targetValue);
    } else if (next.has(targetValue)) {
      next.delete(targetValue);
    } else {
      next.add(targetValue);
    }

    return [...next].sort();
  };

  const removeDeletedIdsFromSelection = (): void => {
    state.selection.nodeIds = new Set(
      [...state.selection.nodeIds].filter((nodeId) => state.nodeMap.has(nodeId))
    );
    state.selection.edgeIds = new Set(
      [...state.selection.edgeIds].filter((edgeId) => state.edgeMap.has(edgeId))
    );
    state.selection.groupIds = new Set(
      [...state.selection.groupIds].filter((groupId) => state.groupMap.has(groupId))
    );
  };

  const validatePropertySchema = (
    input: NodeInput,
    definition: NodeTypeDefinition
  ): ValidationResult => options.propertySchemaValidator?.(input, definition) ?? createValidationResult();

  const validateNodeInput = (input: NodeInput, definition: NodeTypeDefinition): void => {
    const validationErrors = [
      ...(definition.validateProperties?.(input.properties ?? {}) ?? []),
      ...(options.schemaValidator?.(input, definition) ?? [])
    ];
    const propertyValidation = validatePropertySchema(input, definition);

    if (validationErrors.length > 0 || propertyValidation.errors.length > 0) {
      throw new CoreGraphError(
        "NODE_VALIDATION_FAILED",
        `Node "${input.id ?? input.type}" failed validation: ${[
          ...validationErrors,
          ...propertyValidation.errors.map((error) => error.message)
        ].join(", ")}`
      );
    }
  };

  const insertNode = (node: Node, shouldEmit = true): Node => {
    if (state.nodeMap.has(node.id)) {
      throw new CoreGraphError("NODE_ID_CONFLICT", `Node "${node.id}" already exists in the current graph`);
    }

    const previousSelection = snapshotSelection();
    state.nodeMap.set(node.id, cloneNode(node, node.ports));

    try {
      updateGroupMembership(state, undefined, node.groupId, node.id);
      rebuildIndices(state);
      assertGroupConsistency(state);
      invalidateExecutionCache([node.id]);
    } catch (error) {
      state.nodeMap.delete(node.id);
      rebuildIndices(state);
      throw error;
    }

    if (shouldEmit) {
      emit("nodeAdded", {
        node: cloneNode(node),
        graph: snapshot()
      });
      emitSelectionIfChanged(previousSelection);
    }

    return cloneNode(node);
  };

  const applyNodeState = (nodeId: NodeId, nextNode: Node): Node => {
    const existing = requireNode(nodeId);
    const previousSourceGroup = existing.groupId;
    const nextGroupIdValue = nextNode.groupId;
    const previousTargetGroup =
      nextGroupIdValue !== undefined ? state.groupMap.get(nextGroupIdValue) : undefined;

    state.nodeMap.set(nodeId, nextGroupIdValue === undefined ? cloneNodeWithoutGroup(nextNode) : cloneNode(nextNode));

    try {
      if (previousSourceGroup !== nextGroupIdValue) {
        updateGroupMembership(state, previousSourceGroup, nextGroupIdValue, nodeId);
      }

      rebuildIndices(state);
      invalidateExecutionCache([nodeId]);

      for (const edge of state.edgeMap.values()) {
        assertEdgeEndpoints(state, edge, policies, options);
      }

      assertGroupConsistency(state);
    } catch (error) {
      state.nodeMap.set(nodeId, existing);

      if (previousSourceGroup !== undefined) {
        const sourceGroup = state.groupMap.get(previousSourceGroup);

        if (sourceGroup !== undefined && !sourceGroup.nodeIds.includes(nodeId)) {
          state.groupMap.set(previousSourceGroup, {
            ...sourceGroup,
            nodeIds: [...sourceGroup.nodeIds, nodeId].sort()
          });
        }
      }

      if (nextGroupIdValue !== undefined && previousTargetGroup !== undefined) {
        state.groupMap.set(nextGroupIdValue, previousTargetGroup);
      }

      rebuildIndices(state);
      throw error;
    }

    return cloneNode(requireNode(nodeId));
  };

  const removeNode = (nodeId: NodeId, shouldEmit = true): { node: Node; removedEdges: Edge[] } => {
    const node = requireNode(nodeId);
    const previousSelection = snapshotSelection();
    const connectedEdgeIds = new Set<EdgeId>([
      ...(state.incomingEdges.get(nodeId) ?? []),
      ...(state.outgoingEdges.get(nodeId) ?? [])
    ]);
    const removedEdges = [...connectedEdgeIds]
      .map((edgeId) => state.edgeMap.get(edgeId))
      .filter((edge): edge is Edge => edge !== undefined)
      .sort(compareById)
      .map((edge) => cloneEdge(edge));
    const affectedNodeIds = [
      nodeId,
      ...removedEdges.map((edge) => edge.target).filter((targetNodeId) => targetNodeId !== nodeId)
    ];

    for (const edgeId of connectedEdgeIds) {
      state.edgeMap.delete(edgeId);
    }

    state.nodeMap.delete(nodeId);
    updateGroupMembership(state, node.groupId, undefined, nodeId);
    rebuildIndices(state);
    invalidateExecutionCache(affectedNodeIds);
    removeDeletedIdsFromSelection();
    assertGroupConsistency(state);

    if (shouldEmit) {
      emit("nodeRemoved", {
        node: cloneNode(node),
        removedEdges,
        graph: snapshot()
      });
      emitSelectionIfChanged(previousSelection);
    }

    return {
      node: cloneNode(node),
      removedEdges
    };
  };

  const insertEdge = (edge: Edge, shouldEmit = true): Edge => {
    if (state.edgeMap.has(edge.id)) {
      throw new CoreGraphError("EDGE_ID_CONFLICT", `Edge "${edge.id}" already exists in the current graph`);
    }

    state.edgeMap.set(edge.id, cloneEdge(edge));
    rebuildIndices(state);
    invalidateExecutionCache([edge.target]);

    try {
      assertEdgeEndpoints(state, edge, policies, options);
    } catch (error) {
      state.edgeMap.delete(edge.id);
      rebuildIndices(state);
      throw error;
    }

    if (shouldEmit) {
      emit("edgeCreated", {
        edge: cloneEdge(edge),
        graph: snapshot()
      });
    }

    return cloneEdge(edge);
  };

  const removeEdge = (edgeId: EdgeId, shouldEmit = true): Edge => {
    const edge = requireEdge(edgeId);
    const previousSelection = snapshotSelection();

    state.edgeMap.delete(edgeId);
    rebuildIndices(state);
    invalidateExecutionCache([edge.target]);
    removeDeletedIdsFromSelection();

    if (shouldEmit) {
      emit("edgeDeleted", {
        edge: cloneEdge(edge),
        graph: snapshot()
      });
      emitSelectionIfChanged(previousSelection);
    }

    return cloneEdge(edge);
  };

  const pushHistoryCommand = (command: HistoryCommand): void => {
    const openTransaction = state.history.transactionStack[state.history.transactionStack.length - 1];

    if (openTransaction !== undefined) {
      openTransaction.commands.push(command);
      state.history.redoStack = [];
      return;
    }

    const previous = state.history.undoStack[state.history.undoStack.length - 1];
    const merged = previous?.merge?.(command);

    if (merged !== undefined) {
      state.history.undoStack[state.history.undoStack.length - 1] = merged;
    } else {
      state.history.undoStack.push(command);
    }

    state.history.redoStack = [];
  };

  const runCommand = (command: HistoryCommand): void => {
    command.execute();
    pushHistoryCommand(command);
  };

  const createNodeCommand = (node: Node): HistoryCommand => ({
    label: `createNode:${node.id}`,
    execute: () => {
      insertNode(node);
    },
    undo: () => {
      removeNode(node.id);
    }
  });

  const isDragLikeUpdate = (input: UpdateNodeInput): boolean => {
    const allowedKeys = ["position", "dimensions"];
    const keys = Object.keys(input);

    return keys.length > 0 && keys.every((key) => allowedKeys.includes(key));
  };

  const createUpdateNodeCommand = (
    nodeId: NodeId,
    before: Node,
    after: Node,
    compressible: boolean
  ): HistoryCommand => {
    const command: HistoryCommand = {
      label: `updateNode:${nodeId}`,
      execute: () => {
        applyNodeState(nodeId, after);
      },
      undo: () => {
        applyNodeState(nodeId, before);
      }
    };

    if (compressible) {
      return {
        ...command,
        merge: (next) => {
          if (!next.label.startsWith(`updateNode:${nodeId}`)) {
            return undefined;
          }

          return createUpdateNodeCommand(nodeId, before, requireNode(nodeId), true);
        }
      };
    }

    return command;
  };

  const createDeleteNodeCommand = (node: Node, removedEdges: readonly Edge[]): HistoryCommand => ({
    label: `deleteNode:${node.id}`,
    execute: () => {
      removeNode(node.id);
    },
    undo: () => {
      insertNode(node);

      for (const edge of [...removedEdges].sort(compareById)) {
        insertEdge(edge);
      }
    }
  });

  const createEdgeCommand = (edge: Edge): HistoryCommand => ({
    label: `createEdge:${edge.id}`,
    execute: () => {
      insertEdge(edge);
    },
    undo: () => {
      removeEdge(edge.id);
    }
  });

  const createDeleteEdgeCommand = (edge: Edge): HistoryCommand => ({
    label: `deleteEdge:${edge.id}`,
    execute: () => {
      removeEdge(edge.id);
    },
    undo: () => {
      insertEdge(edge);
    }
  });

  const registerPlugin = (plugin: GraphPlugin): (() => void) => {
    ensureEngineActive(disposed);

    if (pluginRuntimes.has(plugin.name)) {
      throw new CoreGraphError(
        "PLUGIN_DUPLICATE",
        `Plugin "${plugin.name}" has already been registered`
      );
    }

    const runtime: PluginRuntimeRecord = {
      plugin,
      state: toGraphPluginState(plugin, false)
    };

    pluginRuntimes.set(plugin.name, runtime);

    try {
      const cleanup = plugin.initialize?.(createPluginContext());

      if (typeof cleanup === "function") {
        runtime.cleanup = cleanup;
      }
      runtime.state = toGraphPluginState(plugin, true);
      return () => {
        api.unregisterPlugin(plugin.name);
      };
    } catch (error) {
      pluginRuntimes.delete(plugin.name);
      throw new CoreGraphError(
        "PLUGIN_INITIALIZE_FAILED",
        `Plugin "${plugin.name}" failed to initialize: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const unregisterPlugin = (name: string): boolean => {
    ensureEngineActive(disposed);
    const runtime = pluginRuntimes.get(name);

    if (runtime === undefined) {
      return false;
    }

    pluginRuntimes.delete(name);

    try {
      runtime.cleanup?.();
      runtime.plugin.dispose?.(createPluginContext());
    } catch (error) {
      runtime.state = toGraphPluginState(
        runtime.plugin,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }

    return true;
  };

  const load = (graph: GraphInput, shouldEmit = true): GraphSnapshot => {
    ensureEngineActive(disposed);

    const validation = validateGraphData(graph, options, policies);

    if (!validation.isValid) {
      throw new CoreGraphError(
        "GRAPH_VALIDATION_FAILED",
        validation.errors.map((error) => error.message).join(", ")
      );
    }

    const nextState = makeEmptyState({
      id: graph.id ?? state.id,
      metadata: graph.metadata ?? state.metadata,
      ...(graph.selection !== undefined ? { selection: graph.selection } : {})
    });

    for (const groupInput of graph.groups ?? []) {
      const group = cloneGroup({
        ...groupInput,
        id: groupInput.id ?? nextGroupId("group")
      });
      nextState.groupMap.set(group.id, group);
    }

    for (const nodeInput of graph.nodes ?? []) {
      const nodeId = nodeInput.id ?? nextNodeId(nodeInput.type);
      const resolvedPorts = (nodeInput.ports ?? []).map((port, index) =>
        clonePort(port, makePortId(nodeId, index, port))
      );
      const node = cloneNode(
        {
          ...nodeInput,
          id: nodeId,
          label: nodeInput.label ?? nodeInput.type,
          dimensions: nodeInput.dimensions ?? DEFAULT_NODE_SIZE
        },
        resolvedPorts
      );
      nextState.nodeMap.set(node.id, node);
    }

    for (const edgeInput of graph.edges ?? []) {
      const edge = cloneEdge({
        ...edgeInput,
        id: edgeInput.id ?? nextEdgeId("edge")
      });
      nextState.edgeMap.set(edge.id, edge);
    }

    rebuildIndices(nextState);
    assertGroupConsistency(nextState);

    for (const edge of nextState.edgeMap.values()) {
      assertEdgeEndpoints(nextState, edge, policies, options);
    }

    pruneSelectionAgainstState(nextState);
    state = nextState;
    resetHistory();
    executionCache.clear();

    if (shouldEmit) {
      emit("graphLoaded", { graph: snapshot() });
    }

    return snapshot();
  };

  const getExecutionCacheSnapshot = (): readonly ExecutionCacheEntry[] =>
    [...executionCache.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId));

  const throwIfAborted = (signal: AbortSignal): void => {
    if (signal.aborted) {
      const abortError = new Error("Execution aborted");
      abortError.name = "AbortError";
      throw abortError;
    }
  };

  const executeGraph = (executionOptions: Parameters<CoreEngine["execute"]>[0] = {}): ExecutionRunHandle => {
    ensureEngineActive(disposed);
    const executionSnapshot = snapshot();
    const executionValidation = validateExecutionPlan(
      executionSnapshot,
      nodeTypes,
      executionOptions.targetNodeIds
    );
    const startedAtIso = createExecutionTimestamp();
    const executionId = createExecutionId((executionSequence += 1));
    const controller = new AbortController();
    const invalidatedNodeIds =
      executionOptions.invalidateNodeIds === undefined
        ? []
        : invalidateExecutionCache(executionOptions.invalidateNodeIds);

    if (executionOptions.signal !== undefined) {
      executionOptions.signal.addEventListener("abort", () => {
        controller.abort();
      });
    }

    if (!executionValidation.isValid) {
      const result: ExecutionResult = {
        executionId,
        status: "failed",
        policy: EXECUTION_POLICY,
        nodeOrder: [],
        batches: [],
        nodeResults: {},
        errors: executionValidation.errors.map((error) =>
          createExecutionError(error.code, error.message, error.entityId as NodeId | undefined)
        ),
        cacheStats: {
          hits: 0,
          misses: 0,
          invalidatedNodeIds
        },
        startedAtIso,
        completedAtIso: createExecutionTimestamp()
      };

      emit("executionCompleted", {
        result,
        graph: executionSnapshot
      });

      return {
        executionId,
        cancel: () => false,
        result: Promise.resolve(result)
      };
    }

    const { plan } = buildExecutionPlan(executionSnapshot, executionOptions.targetNodeIds);

    if (plan === undefined) {
      const result: ExecutionResult = {
        executionId,
        status: "failed",
        policy: EXECUTION_POLICY,
        nodeOrder: [],
        batches: [],
        nodeResults: {},
        errors: [createExecutionError("EXECUTION_PLAN_MISSING", "Execution plan could not be created")],
        cacheStats: {
          hits: 0,
          misses: 0,
          invalidatedNodeIds
        },
        startedAtIso,
        completedAtIso: createExecutionTimestamp()
      };

      emit("executionCompleted", {
        result,
        graph: executionSnapshot
      });

      return {
        executionId,
        cancel: () => false,
        result: Promise.resolve(result)
      };
    }

    activeExecutions.set(executionId, controller);
    emit("executionStarted", {
      executionId,
      nodeIds: plan.nodeOrder,
      batches: plan.batches,
      policy: EXECUTION_POLICY,
      graph: executionSnapshot
    });

    const result = (async (): Promise<ExecutionResult> => {
      const nodeById = new Map(executionSnapshot.nodes.map((node) => [node.id, node]));
      const edgeById = new Map(executionSnapshot.edges.map((edge) => [edge.id, edge]));
      const nodeResults: Record<string, ExecutionResult["nodeResults"][string]> = {};
      const runtimeErrors: ExecutionRuntimeError[] = [];
      let hits = 0;
      let misses = 0;

      const executeNode = async (
        nodeId: NodeId,
        batchIndex: number,
        orderIndex: number
      ): Promise<void> => {
        throwIfAborted(controller.signal);
        const node = nodeById.get(nodeId);

        if (node === undefined) {
          runtimeErrors.push(
            createExecutionError("EXECUTION_NODE_MISSING", `Execution node "${nodeId}" is missing`, nodeId)
          );
          return;
        }

        const definition = nodeTypes.get(node.type)?.execution;

        if (definition === undefined) {
          runtimeErrors.push(
            createExecutionError(
              "EXECUTION_HANDLER_MISSING",
              `Node "${node.id}" does not define an execution handler`,
              node.id
            )
          );
          return;
        }

        const inputs: Record<string, ExecutionContext["inputs"][string]> = {};
        const upstreamNodeIds: NodeId[] = [];

        for (const edgeId of plan.incomingByNodeId[nodeId] ?? []) {
          const edge = edgeById.get(edgeId);

          if (edge === undefined || edge.targetPortId === undefined || edge.sourcePortId === undefined) {
            runtimeErrors.push(
              createExecutionError(
                "EXECUTION_INPUT_EDGE_INVALID",
                `Execution edge "${edgeId}" is missing a required port binding`,
                node.id,
                edgeId
              )
            );
            return;
          }

          const upstream = nodeResults[edge.source];

          if (upstream === undefined) {
            runtimeErrors.push(
              createExecutionError(
                "EXECUTION_DEPENDENCY_MISSING",
                `Execution dependency "${edge.source}" was not resolved before "${node.id}"`,
                node.id,
                edge.id
              )
            );
            return;
          }

          if (!(edge.sourcePortId in upstream.outputs)) {
            runtimeErrors.push(
              createExecutionError(
                "EXECUTION_OUTPUT_MISSING",
                `Node "${edge.source}" did not produce output "${edge.sourcePortId}" required by "${node.id}"`,
                node.id,
                edge.id
              )
            );
            return;
          }

          const existing = inputs[edge.targetPortId];
          const nextValue = upstream.outputs[edge.sourcePortId] as ExecutionInputValue;
          upstreamNodeIds.push(edge.source);

          if (existing === undefined) {
            inputs[edge.targetPortId] = nextValue;
          } else if (Array.isArray(existing)) {
            const existingValues: readonly unknown[] = existing;
            inputs[edge.targetPortId] = [...existingValues, nextValue] as ExecutionInputValue;
          } else {
            inputs[edge.targetPortId] = [existing, nextValue] as ExecutionInputValue;
          }
        }

        const signature = stableSerialize({
          type: node.type,
          properties: node.properties,
          inputs
        });
        const cached = executionCache.get(nodeId);

        if (cached !== undefined && cached.signature === signature) {
          hits += 1;
          nodeResults[nodeId] = {
            nodeId,
            batchIndex,
            orderIndex,
            status: "cached",
            inputs,
            outputs: cached.outputs
          };
          return;
        }

        misses += 1;

        const context: ExecutionContext = {
          executionId,
          node,
          graph: executionSnapshot,
          batchIndex,
          orderIndex,
          inputs,
          properties: node.properties,
          signal: controller.signal,
          engine: api,
          policy: EXECUTION_POLICY,
          getCachedOutput: (requestedNodeId) => executionCache.get(requestedNodeId)
        };

        const outputs = await definition.execute(context);
        throwIfAborted(controller.signal);
        const normalizedOutputs = { ...(outputs ?? {}) };

        executionCache.set(nodeId, {
          nodeId,
          signature,
          outputs: normalizedOutputs,
          upstreamNodeIds: [...new Set(upstreamNodeIds)].sort(),
          updatedAtExecutionId: executionId
        });
        nodeResults[nodeId] = {
          nodeId,
          batchIndex,
          orderIndex,
          status: "executed",
          inputs,
          outputs: normalizedOutputs
        };
      };

      let status: ExecutionStatus = "completed";

      try {
        for (const batch of plan.batches) {
          throwIfAborted(controller.signal);
          await Promise.all(
            batch.nodeIds.map((nodeId, orderIndex) => executeNode(nodeId, batch.index, orderIndex))
          );

          if (runtimeErrors.length > 0) {
            status = "failed";
            break;
          }
        }
      } catch (error) {
        status = isAbortError(error) ? "cancelled" : "failed";

        if (!isAbortError(error)) {
          runtimeErrors.push(
            createExecutionError(
              "EXECUTION_RUNTIME_ERROR",
              error instanceof Error ? error.message : String(error)
            )
          );
        }
      } finally {
        activeExecutions.delete(executionId);
      }

      const finalResult: ExecutionResult = {
        executionId,
        status,
        policy: EXECUTION_POLICY,
        nodeOrder: plan.nodeOrder,
        batches: plan.batches,
        nodeResults,
        errors: runtimeErrors,
        cacheStats: {
          hits,
          misses,
          invalidatedNodeIds
        },
        startedAtIso,
        completedAtIso: createExecutionTimestamp()
      };

      emit("executionCompleted", {
        result: finalResult,
        graph: executionSnapshot
      });

      return finalResult;
    })();

    return {
      executionId,
      cancel: () => {
        const activeExecution = activeExecutions.get(executionId);

        if (activeExecution === undefined || activeExecution.signal.aborted) {
          return false;
        }

        activeExecution.abort();
        return true;
      },
      result
    };
  };

  for (const definition of options.nodeTypes ?? []) {
    nodeTypes.set(definition.type, definition);
  }

  if (options.graph !== undefined) {
    load(options.graph, false);
  }

  api = {
    getSnapshot: () => {
      ensureEngineActive(disposed);
      return snapshot();
    },
    getExecutionPolicy: () => EXECUTION_POLICY,
    getExecutionCacheSnapshot: () => {
      ensureEngineActive(disposed);
      return getExecutionCacheSnapshot();
    },
    getStateSnapshot: () => {
      ensureEngineActive(disposed);

      const adjacency: Record<
        string,
        {
          readonly incoming: readonly EdgeId[];
          readonly outgoing: readonly EdgeId[];
        }
      > = {};

      for (const nodeId of [...state.nodeMap.keys()].sort()) {
        adjacency[nodeId] = {
          incoming: [...(state.incomingEdges.get(nodeId) ?? [])].sort(),
          outgoing: [...(state.outgoingEdges.get(nodeId) ?? [])].sort()
        };
      }

      const portLookup: Record<string, NodeId> = {};

      for (const [key, nodeId] of [...state.portLookup.entries()].sort((left, right) =>
        left[0].localeCompare(right[0])
      )) {
        portLookup[key] = nodeId;
      }

      return {
        selection: snapshotSelection(),
        history: {
          undoDepth: state.history.undoStack.length,
          redoDepth: state.history.redoStack.length,
          transactionDepth: state.history.transactionStack.length
        },
        execution: {
          policy: EXECUTION_POLICY,
          cacheNodeIds: [...executionCache.keys()].sort(),
          activeExecutionIds: [...activeExecutions.keys()].sort()
        },
        plugins: [...pluginRuntimes.values()]
          .map((runtime) => runtime.state)
          .sort((left, right) => left.name.localeCompare(right.name)),
        nodeIds: [...state.nodeMap.keys()].sort(),
        edgeIds: [...state.edgeMap.keys()].sort(),
        groupIds: [...state.groupMap.keys()].sort(),
        portLookup,
        adjacency
      };
    },
    registerNodeType: (definition) => {
      ensureEngineActive(disposed);
      nodeTypes.set(definition.type, definition);
    },
    unregisterNodeType: (type) => {
      ensureEngineActive(disposed);
      return nodeTypes.delete(type);
    },
    getNodeType: (type) => {
      ensureEngineActive(disposed);
      return nodeTypes.get(type);
    },
    registerPlugin: (plugin) => registerPlugin(plugin),
    unregisterPlugin: (name) => unregisterPlugin(name),
    getPlugins: () => {
      ensureEngineActive(disposed);
      return [...pluginRuntimes.values()]
        .map((runtime) => runtime.state)
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    on: (eventName, listener) => {
      ensureEngineActive(disposed);
      listeners[eventName].add(listener);

      return () => {
        listeners[eventName].delete(listener);
      };
    },
    validateGraph: (graph) => {
      ensureEngineActive(disposed);
      return validateGraphData(graph ?? snapshot(), { ...options, nodeTypes: [...nodeTypes.values()] }, policies);
    },
    validateExecution: (graph) => {
      ensureEngineActive(disposed);
      return validateExecutionPlan(toExecutionSnapshot(graph), nodeTypes);
    },
    loadGraph: (graph) => load(graph),
    importGraph: (document, migrationRegistry = createMigrationRegistry()) => {
      ensureEngineActive(disposed);

      const envelope = isGraphDocumentEnvelope(document)
        ? migrationRegistry.migrate(document)
        : {
            version: migrationRegistry.getLatestVersion(),
            graph: {
              id: document.id ?? state.id,
              metadata: cloneMetadata(document.metadata ?? state.metadata),
              nodes: (document.nodes ?? []).map((node) => cloneNode(node)),
              edges: (document.edges ?? []).map((edge) => cloneEdge(edge)),
              groups: (document.groups ?? []).map((group) => cloneGroup(group)),
              selection: cloneSelection(document.selection)
            }
          };

      return load(envelope.graph);
    },
    exportGraph: () => {
      ensureEngineActive(disposed);
      return {
        version: GRAPH_DOCUMENT_VERSION,
        graph: snapshot()
      };
    },
    exportPartialGraph: (exportOptions = {}) => {
      ensureEngineActive(disposed);

      const currentSelection = snapshotSelection();
      const requestedGroupIds = new Set(exportOptions.groupIds ?? currentSelection.groupIds);
      const requestedNodeIds = new Set(exportOptions.nodeIds ?? currentSelection.nodeIds);
      const requestedEdgeIds = new Set(exportOptions.edgeIds ?? currentSelection.edgeIds);

      for (const groupId of requestedGroupIds) {
        const group = state.groupMap.get(groupId);

        for (const nodeId of group?.nodeIds ?? []) {
          requestedNodeIds.add(nodeId);
        }
      }

      for (const edgeId of requestedEdgeIds) {
        const edge = state.edgeMap.get(edgeId);

        if (edge !== undefined) {
          requestedNodeIds.add(edge.source);
          requestedNodeIds.add(edge.target);
        }
      }

      const includeConnectedEdges = exportOptions.includeConnectedEdges ?? true;

      if (includeConnectedEdges) {
        for (const edge of state.edgeMap.values()) {
          if (requestedNodeIds.has(edge.source) && requestedNodeIds.has(edge.target)) {
            requestedEdgeIds.add(edge.id);
          }
        }
      }

      const nodes = [...requestedNodeIds]
        .map((nodeId) => state.nodeMap.get(nodeId))
        .filter((node): node is Node => node !== undefined)
        .sort(compareById)
        .map((node) => cloneNode(node));
      const edges = [...requestedEdgeIds]
        .map((edgeId) => state.edgeMap.get(edgeId))
        .filter((edge): edge is Edge => edge !== undefined)
        .sort(compareById)
        .map((edge) => cloneEdge(edge));
      const groups = [...new Set([
        ...requestedGroupIds,
        ...nodes.map((node) => node.groupId).filter((groupId): groupId is GroupId => groupId !== undefined)
      ])]
        .map((groupId) => state.groupMap.get(groupId))
        .filter((group): group is Group => group !== undefined)
        .sort(compareById)
        .map((group) =>
          cloneGroup({
            ...group,
            nodeIds: group.nodeIds.filter((nodeId) => requestedNodeIds.has(nodeId))
          })
        );

      return {
        version: GRAPH_DOCUMENT_VERSION,
        graph: {
          id: state.id,
          metadata: cloneMetadata(state.metadata),
          nodes,
          edges,
          groups,
          selection: cloneSelection({
            nodeIds: nodes.map((node) => node.id).filter((nodeId) => currentSelection.nodeIds.includes(nodeId)),
            edgeIds: edges.map((edge) => edge.id).filter((edgeId) => currentSelection.edgeIds.includes(edgeId)),
            groupIds: groups.map((group) => group.id).filter((groupId) => currentSelection.groupIds.includes(groupId)),
            activeSelectionMode: resolveActiveSelectionMode(currentSelection)
          })
        }
      };
    },
    createNode: (input) => {
      ensureEngineActive(disposed);

      const definition = requireNodeType(input.type);
      const nodeId = input.id ?? nextNodeId(input.type);
      const draftInput: NodeInput = {
        ...input,
        id: nodeId
      };

      runBeforeNodeCreateHooks(draftInput);

      validateNodeInput(draftInput, definition);

      const resolvedPorts = (input.ports ?? definition.ports ?? []).map((port, index) =>
        clonePort(port, makePortId(nodeId, index, port))
      );
      const node = cloneNode(
        {
          ...input,
          id: nodeId,
          label: input.label ?? definition.defaultLabel ?? input.type,
          dimensions: input.dimensions ?? definition.defaultDimensions ?? DEFAULT_NODE_SIZE
        },
        resolvedPorts
      );

      runCommand(createNodeCommand(node));

      runAfterNodeCreateHooks(cloneNode(node));

      return cloneNode(node);
    },
    updateNode: (nodeId, input) => {
      ensureEngineActive(disposed);

      const existing = requireNode(nodeId);
      const nextPorts = input.ports?.map((port, index) =>
        clonePort(port, makePortId(nodeId, index, port))
      );
      const baseNodeInput: NodeInput = {
        ...existing,
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.dimensions !== undefined ? { dimensions: input.dimensions } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        properties:
          input.properties === undefined
            ? existing.properties
            : { ...existing.properties, ...input.properties },
        ports: nextPorts ?? existing.ports,
        metadata:
          input.metadata === undefined ? existing.metadata : { ...existing.metadata, ...input.metadata },
        ...(input.groupId !== undefined && input.groupId !== null ? { groupId: input.groupId } : {})
      };
      const definition = requireNodeType(existing.type);
      validateNodeInput(baseNodeInput, definition);

      const nextNode = cloneNode(baseNodeInput, nextPorts ?? existing.ports);
      const storedNode = input.groupId === null ? cloneNodeWithoutGroup(nextNode) : nextNode;

      applyNodeState(nodeId, storedNode);
      pushHistoryCommand(
        createUpdateNodeCommand(nodeId, cloneNode(existing), cloneNode(requireNode(nodeId)), isDragLikeUpdate(input))
      );

      return cloneNode(requireNode(nodeId));
    },
    deleteNode: (nodeId) => {
      ensureEngineActive(disposed);

      if (!state.nodeMap.has(nodeId)) {
        return false;
      }

      const existingNode = cloneNode(requireNode(nodeId));
      const removedEdges = removeNode(nodeId).removedEdges;
      pushHistoryCommand(createDeleteNodeCommand(existingNode, removedEdges));
      return true;
    },
    validateEdge: (input) => {
      ensureEngineActive(disposed);
      return validateEdgeInputAgainstState(state, input, policies, options);
    },
    createEdge: (input) => {
      ensureEngineActive(disposed);

      const edge = cloneEdge({
        ...input,
        id: input.id ?? nextEdgeId("edge")
      });

      runCommand(createEdgeCommand(edge));
      return cloneEdge(edge);
    },
    deleteEdge: (edgeId) => {
      ensureEngineActive(disposed);

      if (!state.edgeMap.has(edgeId)) {
        return false;
      }

      const edge = cloneEdge(requireEdge(edgeId));
      removeEdge(edgeId);
      pushHistoryCommand(createDeleteEdgeCommand(edge));
      return true;
    },
    selectNode: (nodeId, mode = "replace") => {
      ensureEngineActive(disposed);
      requireNode(nodeId);

      return applySelection({
        nodeIds: mutateSelectionSet(snapshotSelection().nodeIds, nodeId, mode),
        edgeIds: mode === "replace" ? [] : snapshotSelection().edgeIds,
        groupIds: mode === "replace" ? [] : snapshotSelection().groupIds
      });
    },
    selectEdge: (edgeId, mode = "replace") => {
      ensureEngineActive(disposed);
      requireEdge(edgeId);

      return applySelection({
        nodeIds: mode === "replace" ? [] : snapshotSelection().nodeIds,
        edgeIds: mutateSelectionSet(snapshotSelection().edgeIds, edgeId, mode),
        groupIds: mode === "replace" ? [] : snapshotSelection().groupIds
      });
    },
    selectGroup: (groupId, mode = "replace") => {
      ensureEngineActive(disposed);
      requireGroup(groupId);

      return applySelection({
        nodeIds: mode === "replace" ? [] : snapshotSelection().nodeIds,
        edgeIds: mode === "replace" ? [] : snapshotSelection().edgeIds,
        groupIds: mutateSelectionSet(snapshotSelection().groupIds, groupId, mode)
      });
    },
    clearSelection: () => {
      ensureEngineActive(disposed);
      return applySelection({
        nodeIds: [],
        edgeIds: [],
        groupIds: []
      });
    },
    execute: (executionOptions) => executeGraph(executionOptions),
    invalidateExecutionCache: (nodeIds) => {
      ensureEngineActive(disposed);
      return invalidateExecutionCache(nodeIds);
    },
    beginTransaction: (label = "transaction") => {
      ensureEngineActive(disposed);
      state.history.transactionStack.push({
        label,
        commands: []
      });
    },
    endTransaction: () => {
      ensureEngineActive(disposed);
      const transaction = state.history.transactionStack.pop();

      if (transaction === undefined) {
        return false;
      }

      if (transaction.commands.length === 0) {
        return true;
      }

      const composite = createCompositeCommand(transaction.label, transaction.commands);
      const parentTransaction = state.history.transactionStack[state.history.transactionStack.length - 1];

      if (parentTransaction !== undefined) {
        parentTransaction.commands.push(composite);
      } else {
        pushHistoryCommand(composite);
      }

      return true;
    },
    undo: () => {
      ensureEngineActive(disposed);

      const command = state.history.undoStack.pop();

      if (command === undefined) {
        return false;
      }

      command.undo();
      state.history.redoStack.push(command);
      return true;
    },
    redo: () => {
      ensureEngineActive(disposed);

      const command = state.history.redoStack.pop();

      if (command === undefined) {
        return false;
      }

      command.execute();
      state.history.undoStack.push(command);
      return true;
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;

      for (const controller of activeExecutions.values()) {
        controller.abort();
      }

      activeExecutions.clear();

      for (const listenerSet of Object.values(listeners)) {
        listenerSet.clear();
      }

      for (const runtime of [...pluginRuntimes.values()]) {
        try {
          runtime.cleanup?.();
          runtime.plugin.dispose?.({
            engine: api,
            executionPolicy: EXECUTION_POLICY
          });
        } catch {
          // Disposal errors are isolated from engine shutdown.
        }
      }

      pluginRuntimes.clear();
      executionCache.clear();

      state.nodeMap.clear();
      state.edgeMap.clear();
      state.groupMap.clear();
      state.portLookup.clear();
      state.incomingEdges.clear();
      state.outgoingEdges.clear();
      state.selection.nodeIds.clear();
      state.selection.edgeIds.clear();
      state.selection.groupIds.clear();
      resetHistory();
    },
    isDisposed: () => disposed
  };

  for (const plugin of options.plugins ?? []) {
    registerPlugin(plugin);
  }

  return api;
};
