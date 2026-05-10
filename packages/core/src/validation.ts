import type { EdgeId, NodeId } from "@kaiisuuwii/shared";

import {
  cloneEdge,
  cloneGroup,
  cloneMetadata,
  cloneNode,
  clonePort,
  cloneSelection,
  compareById
} from "./model.js";
import { getPortLookupKey, makeEmptyState, type InternalState } from "./state.js";
import {
  CoreGraphError,
  type CoreValidationPolicies,
  type CreateCoreEngineOptions,
  type Edge,
  type EdgeInput,
  type EdgeValidationContext,
  type GraphInput,
  type GraphSnapshot,
  type GroupId,
  type Node,
  type Port,
  type PortId,
  type ValidationError,
  type ValidationResult,
  type ValidationWarning
} from "./types.js";

const createValidationError = (
  code: string,
  message: string,
  path?: string,
  entityId?: string
): ValidationError => ({
  severity: "error",
  code,
  message,
  ...(path !== undefined ? { path } : {}),
  ...(entityId !== undefined ? { entityId } : {})
});

const createValidationWarning = (
  code: string,
  message: string,
  path?: string,
  entityId?: string
): ValidationWarning => ({
  severity: "warning",
  code,
  message,
  ...(path !== undefined ? { path } : {}),
  ...(entityId !== undefined ? { entityId } : {})
});

export const createValidationResult = (
  errors: readonly ValidationError[] = [],
  warnings: readonly ValidationWarning[] = []
): ValidationResult => ({
  isValid: errors.length === 0,
  errors,
  warnings
});

export const assertUniqueIds = <T extends { readonly id: string }>(
  values: readonly T[],
  entityName: string
): void => {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.id)) {
      throw new CoreGraphError(
        `${entityName.toUpperCase()}_ID_CONFLICT`,
        `${entityName} id "${value.id}" is already in use`
      );
    }

    seen.add(value.id);
  }
};

export const assertValidPorts = (nodeId: NodeId, ports: readonly Port[]): void => {
  assertUniqueIds(ports, "port");

  for (const port of ports) {
    if (port.name.trim().length === 0) {
      throw new CoreGraphError("PORT_NAME_REQUIRED", `Node "${nodeId}" has a port without a name`);
    }
  }
};

export const rebuildIndices = (state: InternalState): void => {
  state.portLookup.clear();
  state.incomingEdges.clear();
  state.outgoingEdges.clear();

  for (const nodeId of state.nodeMap.keys()) {
    state.incomingEdges.set(nodeId, new Set<EdgeId>());
    state.outgoingEdges.set(nodeId, new Set<EdgeId>());
  }

  for (const node of state.nodeMap.values()) {
    assertValidPorts(node.id, node.ports);

    for (const port of node.ports) {
      const lookupKey = getPortLookupKey(node.id, port.id);

      if (state.portLookup.has(lookupKey)) {
        throw new CoreGraphError(
          "PORT_ID_CONFLICT",
          `Port "${port.id}" is already in use on node "${node.id}"`
        );
      }

      state.portLookup.set(lookupKey, node.id);
    }
  }

  for (const edge of state.edgeMap.values()) {
    state.incomingEdges.get(edge.target)?.add(edge.id);
    state.outgoingEdges.get(edge.source)?.add(edge.id);
  }
};

export const assertGroupConsistency = (state: InternalState): void => {
  for (const group of state.groupMap.values()) {
    for (const nodeId of group.nodeIds) {
      const node = state.nodeMap.get(nodeId);

      if (node === undefined) {
        throw new CoreGraphError(
          "GROUP_NODE_MISSING",
          `Group "${group.id}" references unknown node "${nodeId}"`
        );
      }

      if (node.groupId !== group.id) {
        throw new CoreGraphError(
          "GROUP_MEMBERSHIP_MISMATCH",
          `Node "${nodeId}" and group "${group.id}" do not agree on membership`
        );
      }
    }
  }

  for (const node of state.nodeMap.values()) {
    if (node.groupId === undefined) {
      continue;
    }

    const group = state.groupMap.get(node.groupId);

    if (group === undefined) {
      throw new CoreGraphError(
        "GROUP_MISSING",
        `Node "${node.id}" references unknown group "${node.groupId}"`
      );
    }

    if (!group.nodeIds.includes(node.id)) {
      throw new CoreGraphError(
        "GROUP_MEMBERSHIP_MISMATCH",
        `Group "${group.id}" is missing node "${node.id}" from its membership`
      );
    }
  }
};

export const findPort = (node: Node, portId: PortId | undefined): Port | undefined =>
  portId === undefined ? undefined : node.ports.find((port) => port.id === portId);

export const introducesCycle = (
  state: InternalState,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
  edgeId: EdgeId
): boolean => {
  if (sourceNodeId === targetNodeId) {
    return true;
  }

  const queue: NodeId[] = [targetNodeId];
  const visited = new Set<NodeId>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    if (current === sourceNodeId) {
      return true;
    }

    visited.add(current);

    for (const outgoingEdgeId of state.outgoingEdges.get(current) ?? []) {
      if (outgoingEdgeId === edgeId) {
        continue;
      }

      const outgoingEdge = state.edgeMap.get(outgoingEdgeId);

      if (outgoingEdge !== undefined) {
        queue.push(outgoingEdge.target);
      }
    }
  }

  return false;
};

export const buildEdgeValidationContext = (
  state: InternalState,
  edge: Edge
): EdgeValidationContext => {
  const sourceNode = state.nodeMap.get(edge.source);
  const targetNode = state.nodeMap.get(edge.target);

  if (sourceNode === undefined) {
    throw new CoreGraphError(
      "EDGE_SOURCE_NODE_MISSING",
      `Edge "${edge.id}" references unknown source node "${edge.source}"`
    );
  }

  if (targetNode === undefined) {
    throw new CoreGraphError(
      "EDGE_TARGET_NODE_MISSING",
      `Edge "${edge.id}" references unknown target node "${edge.target}"`
    );
  }

  if (edge.sourcePortId === undefined) {
    throw new CoreGraphError(
      "EDGE_SOURCE_PORT_REQUIRED",
      `Edge "${edge.id}" must define a source port`
    );
  }

  if (edge.targetPortId === undefined) {
    throw new CoreGraphError(
      "EDGE_TARGET_PORT_REQUIRED",
      `Edge "${edge.id}" must define a target port`
    );
  }

  const sourcePort = findPort(sourceNode, edge.sourcePortId);
  const targetPort = findPort(targetNode, edge.targetPortId);

  if (sourcePort === undefined) {
    throw new CoreGraphError(
      "EDGE_SOURCE_PORT_MISSING",
      `Edge "${edge.id}" references unknown source port "${edge.sourcePortId}"`
    );
  }

  if (targetPort === undefined) {
    throw new CoreGraphError(
      "EDGE_TARGET_PORT_MISSING",
      `Edge "${edge.id}" references unknown target port "${edge.targetPortId}"`
    );
  }

  return {
    edge,
    sourceNode,
    targetNode,
    sourcePort,
    targetPort
  };
};

export const assertEdgeEndpoints = (
  state: InternalState,
  edge: Edge,
  policies: Required<CoreValidationPolicies>,
  options?: Pick<CreateCoreEngineOptions, "executionSignatureValidator">
): void => {
  const context = buildEdgeValidationContext(state, edge);

  if (context.sourcePort.direction === "input") {
    throw new CoreGraphError(
      "EDGE_SOURCE_DIRECTION_INVALID",
      `Port "${context.sourcePort.id}" cannot be used as an edge source`
    );
  }

  if (context.targetPort.direction === "output") {
    throw new CoreGraphError(
      "EDGE_TARGET_DIRECTION_INVALID",
      `Port "${context.targetPort.id}" cannot be used as an edge target`
    );
  }

  if (edge.source === edge.target && !policies.allowSelfLoops) {
    throw new CoreGraphError(
      "EDGE_SELF_LOOP_FORBIDDEN",
      `Self-loop edges are disabled for node "${edge.source}"`
    );
  }

  const resolvedDataType = edge.dataType ?? context.sourcePort.dataType;

  if (
    resolvedDataType !== undefined &&
    context.sourcePort.dataType !== undefined &&
    context.sourcePort.dataType !== resolvedDataType
  ) {
    throw new CoreGraphError(
      "EDGE_SOURCE_DATA_TYPE_MISMATCH",
      `Edge "${edge.id}" data type does not match source port "${context.sourcePort.id}"`
    );
  }

  if (resolvedDataType !== undefined) {
    if (
      context.targetPort.accepts !== undefined &&
      !context.targetPort.accepts.includes(resolvedDataType)
    ) {
      throw new CoreGraphError(
        "EDGE_TARGET_DATA_TYPE_MISMATCH",
        `Target port "${context.targetPort.id}" does not accept "${resolvedDataType}"`
      );
    }

    if (
      context.targetPort.accepts === undefined &&
      context.targetPort.dataType !== undefined &&
      context.targetPort.dataType !== resolvedDataType
    ) {
      throw new CoreGraphError(
        "EDGE_TARGET_DATA_TYPE_MISMATCH",
        `Edge "${edge.id}" data type does not match target port "${context.targetPort.id}"`
      );
    }
  }

  const executionValidation = options?.executionSignatureValidator?.(context);

  if (executionValidation !== undefined && executionValidation.errors.length > 0) {
    throw new CoreGraphError(
      "EDGE_EXECUTION_SIGNATURE_INVALID",
      executionValidation.errors.map((error) => error.message).join(", ")
    );
  }

  if (!policies.allowCycles && introducesCycle(state, edge.source, edge.target, edge.id)) {
    throw new CoreGraphError(
      "EDGE_CYCLE_FORBIDDEN",
      `Edge "${edge.id}" would create a cycle between "${edge.source}" and "${edge.target}"`
    );
  }
};

export const ensureEngineActive = (disposed: boolean): void => {
  if (disposed) {
    throw new CoreGraphError("ENGINE_DISPOSED", "The core engine has already been disposed");
  }
};

export const updateGroupMembership = (
  state: InternalState,
  existingGroupId: GroupId | undefined,
  nextGroupIdValue: GroupId | undefined,
  nodeId: NodeId
): void => {
  if (existingGroupId !== undefined) {
    const existingGroup = state.groupMap.get(existingGroupId);

    if (existingGroup !== undefined) {
      state.groupMap.set(existingGroupId, {
        ...existingGroup,
        nodeIds: existingGroup.nodeIds.filter((memberId) => memberId !== nodeId)
      });
    }
  }

  if (nextGroupIdValue !== undefined) {
    const nextGroup = state.groupMap.get(nextGroupIdValue);

    if (nextGroup === undefined) {
      throw new CoreGraphError(
        "GROUP_MISSING",
        `Node "${nodeId}" references unknown group "${nextGroupIdValue}"`
      );
    }

    state.groupMap.set(nextGroupIdValue, {
      ...nextGroup,
      nodeIds: [...new Set([...nextGroup.nodeIds, nodeId])].sort()
    });
  }
};

const normalizeGraphInput = (graph: GraphInput | GraphSnapshot): GraphSnapshot => {
  const nodes = (graph.nodes ?? []).map((node) =>
    cloneNode(node, (node.ports ?? []).map((port) => clonePort(port, port.id ?? "port_missing")))
  );
  const edges = (graph.edges ?? []).map((edge) => cloneEdge(edge));
  const groups = (graph.groups ?? []).map((group) => cloneGroup(group));

  return {
    id: graph.id ?? "graph_validation_missing",
    metadata: cloneMetadata(graph.metadata),
    nodes: nodes.sort(compareById),
    edges: edges.sort(compareById),
    groups: groups.sort(compareById),
    selection: cloneSelection(graph.selection)
  };
};

const collectDuplicateIdErrors = <T extends { readonly id?: string }>(
  values: readonly T[],
  entityName: "node" | "edge" | "group" | "port",
  parentPath: string
): ValidationError[] => {
  const seen = new Set<string>();
  const errors: ValidationError[] = [];

  values.forEach((value, index) => {
    const id = value.id;

    if (id === undefined) {
      return;
    }

    if (seen.has(id)) {
      errors.push(
        createValidationError(
          `${entityName.toUpperCase()}_ID_CONFLICT`,
          `${entityName} id "${id}" is already in use`,
          `${parentPath}[${index}]`,
          id
        )
      );
      return;
    }

    seen.add(id);
  });

  return errors;
};

export const validateGraphData = (
  graph: GraphInput | GraphSnapshot,
  options: Pick<CreateCoreEngineOptions, "nodeTypes" | "schemaValidator" | "propertySchemaValidator" | "executionSignatureValidator"> = {},
  policies: Required<CoreValidationPolicies> = {
    allowSelfLoops: false,
    allowCycles: true
  }
): ValidationResult => {
  const normalizedGraph = normalizeGraphInput(graph);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const state = makeEmptyState(normalizedGraph);
  const nodeTypes = new Map((options.nodeTypes ?? []).map((definition) => [definition.type, definition]));

  errors.push(...collectDuplicateIdErrors(graph.nodes ?? [], "node", "nodes"));
  errors.push(...collectDuplicateIdErrors(graph.edges ?? [], "edge", "edges"));
  errors.push(...collectDuplicateIdErrors(graph.groups ?? [], "group", "groups"));

  (graph.nodes ?? []).forEach((node, nodeIndex) => {
    errors.push(...collectDuplicateIdErrors(node.ports ?? [], "port", `nodes[${nodeIndex}].ports`));
  });

  for (const node of normalizedGraph.nodes) {
    state.nodeMap.set(node.id, node);
  }

  for (const edge of normalizedGraph.edges) {
    state.edgeMap.set(edge.id, edge);
  }

  for (const group of normalizedGraph.groups) {
    state.groupMap.set(group.id, group);
  }

  try {
    rebuildIndices(state);
  } catch (error) {
    if (error instanceof CoreGraphError) {
      errors.push(createValidationError(error.code, error.message));
    } else {
      throw error;
    }
  }

  try {
    assertGroupConsistency(state);
  } catch (error) {
    if (error instanceof CoreGraphError) {
      errors.push(createValidationError(error.code, error.message));
    } else {
      throw error;
    }
  }

  normalizedGraph.nodes.forEach((node, index) => {
    const definition = nodeTypes.get(node.type);

    if (definition === undefined) {
      warnings.push(
        createValidationWarning(
          "NODE_TYPE_UNREGISTERED",
          `Node "${node.id}" uses unregistered type "${node.type}"`,
          `nodes[${index}]`,
          node.id
        )
      );
      return;
    }

    const schemaErrors = [
      ...(definition.validateProperties?.(node.properties) ?? []),
      ...(options.schemaValidator?.(node, definition) ?? [])
    ];

    schemaErrors.forEach((message) => {
      errors.push(
        createValidationError("NODE_SCHEMA_INVALID", message, `nodes[${index}]`, node.id)
      );
    });

    const propertyValidation = options.propertySchemaValidator?.(node, definition);

    if (propertyValidation !== undefined) {
      errors.push(...propertyValidation.errors);
      warnings.push(...propertyValidation.warnings);
    }
  });

  normalizedGraph.edges.forEach((edge, index) => {
    try {
      assertEdgeEndpoints(state, edge, policies, options);
    } catch (error) {
      if (error instanceof CoreGraphError) {
        errors.push(createValidationError(error.code, error.message, `edges[${index}]`, edge.id));
        return;
      }

      throw error;
    }
  });

  for (const nodeId of normalizedGraph.selection.nodeIds) {
    if (!state.nodeMap.has(nodeId)) {
      errors.push(
        createValidationError(
          "SELECTION_NODE_MISSING",
          `Selection references unknown node "${nodeId}"`,
          "selection.nodeIds",
          nodeId
        )
      );
    }
  }

  for (const edgeId of normalizedGraph.selection.edgeIds) {
    if (!state.edgeMap.has(edgeId)) {
      errors.push(
        createValidationError(
          "SELECTION_EDGE_MISSING",
          `Selection references unknown edge "${edgeId}"`,
          "selection.edgeIds",
          edgeId
        )
      );
    }
  }

  for (const groupId of normalizedGraph.selection.groupIds) {
    if (!state.groupMap.has(groupId)) {
      errors.push(
        createValidationError(
          "SELECTION_GROUP_MISSING",
          `Selection references unknown group "${groupId}"`,
          "selection.groupIds",
          groupId
        )
      );
    }
  }

  return createValidationResult(errors, warnings);
};

export const validateEdgeInputAgainstState = (
  state: InternalState,
  edgeInput: EdgeInput,
  policies: Required<CoreValidationPolicies>,
  options: Pick<CreateCoreEngineOptions, "executionSignatureValidator"> = {}
): ValidationResult => {
  const edge = cloneEdge(edgeInput);

  try {
    assertEdgeEndpoints(state, edge, policies, options);
    return createValidationResult();
  } catch (error) {
    if (error instanceof CoreGraphError) {
      return createValidationResult([
        createValidationError(error.code, error.message, undefined, edge.id)
      ]);
    }

    throw error;
  }
};
