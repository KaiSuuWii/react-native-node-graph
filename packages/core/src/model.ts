import {
  DEFAULT_NODE_SIZE,
  createEdgeId,
  createGraphId,
  createNodeId,
  type GraphMetadata
} from "@kaiisuuwii/shared";

import { createGroupId } from "./ids.js";
import type {
  ActiveSelectionMode,
  Edge,
  EdgeInput,
  GraphInput,
  GraphSnapshot,
  Group,
  GroupInput,
  Node,
  NodeInput,
  Port,
  PortId,
  PortInput,
  SelectionSnapshot
} from "./types.js";

export const DEFAULT_GRAPH_NAME = "Untitled Graph";
export const DEFAULT_GRAPH_VERSION = "0.1.0";
export const DEFAULT_ID_SEED = "engine";
export const GRAPH_DOCUMENT_VERSION = 1;

export const cloneRecord = (
  input?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({ ...(input ?? {}) });

export const cloneMetadata = (input?: Partial<GraphMetadata>): GraphMetadata => ({
  name: input?.name ?? DEFAULT_GRAPH_NAME,
  version: input?.version ?? DEFAULT_GRAPH_VERSION,
  tags: [...(input?.tags ?? [])],
  createdAtIso: input?.createdAtIso ?? new Date().toISOString()
});

export const compareById = <T extends { readonly id: string }>(left: T, right: T): number =>
  left.id.localeCompare(right.id);

export const resolveActiveSelectionMode = (
  selection: Pick<SelectionSnapshot, "nodeIds" | "edgeIds" | "groupIds">
): ActiveSelectionMode => {
  const modes: Exclude<ActiveSelectionMode, "none" | "mixed">[] = [
    selection.nodeIds.length > 0 ? "node" : undefined,
    selection.edgeIds.length > 0 ? "edge" : undefined,
    selection.groupIds.length > 0 ? "group" : undefined
  ].filter((mode): mode is Exclude<ActiveSelectionMode, "none" | "mixed"> => mode !== undefined);

  if (modes.length === 0) {
    return "none";
  }

  if (modes.length > 1) {
    return "mixed";
  }

  return modes[0] ?? "none";
};

export const cloneSelection = (
  input?: Partial<SelectionSnapshot>,
  fallback?: Partial<SelectionSnapshot>
): SelectionSnapshot => {
  const selection: SelectionSnapshot = {
    nodeIds: [...(input?.nodeIds ?? fallback?.nodeIds ?? [])].sort(),
    edgeIds: [...(input?.edgeIds ?? fallback?.edgeIds ?? [])].sort(),
    groupIds: [...(input?.groupIds ?? fallback?.groupIds ?? [])].sort(),
    activeSelectionMode:
      input?.activeSelectionMode ??
      fallback?.activeSelectionMode ??
      resolveActiveSelectionMode({
        nodeIds: [...(input?.nodeIds ?? fallback?.nodeIds ?? [])],
        edgeIds: [...(input?.edgeIds ?? fallback?.edgeIds ?? [])],
        groupIds: [...(input?.groupIds ?? fallback?.groupIds ?? [])]
      })
  };

  return {
    ...selection,
    activeSelectionMode: resolveActiveSelectionMode(selection)
  };
};

export const clonePort = (input: PortInput | Port, fallbackId: PortId): Port => {
  const cloned: Port = {
    id: input.id ?? fallbackId,
    name: input.name,
    direction: input.direction,
    metadata: cloneRecord(input.metadata)
  };

  return {
    ...cloned,
    ...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
    ...(input.accepts !== undefined ? { accepts: [...input.accepts].sort() } : {})
  };
};

export const cloneNode = (input: NodeInput | Node, fallbackPorts?: readonly Port[]): Node => {
  const base: Node = {
    id: input.id ?? createNodeId("snapshot"),
    type: input.type,
    position: { ...input.position },
    dimensions: input.dimensions === undefined ? { ...DEFAULT_NODE_SIZE } : { ...input.dimensions },
    label: input.label ?? input.type,
    properties: cloneRecord(input.properties),
    ports: (fallbackPorts ?? input.ports ?? []).map((port, index) =>
      clonePort(port, `port_snapshot_${index.toString(36).padStart(4, "0")}`)
    ),
    metadata: cloneRecord(input.metadata)
  };

  if (input.groupId !== undefined) {
    return {
      ...base,
      groupId: input.groupId
    };
  }

  return base;
};

export const cloneNodeWithoutGroup = (node: Node): Omit<Node, "groupId"> => ({
  id: node.id,
  type: node.type,
  position: { ...node.position },
  dimensions: { ...node.dimensions },
  label: node.label,
  properties: cloneRecord(node.properties),
  ports: node.ports.map((port) => clonePort(port, port.id)),
  metadata: cloneRecord(node.metadata)
});

export const cloneEdge = (input: EdgeInput | Edge): Edge => {
  const base: Edge = {
    id: input.id ?? createEdgeId("snapshot"),
    source: input.source,
    target: input.target,
    metadata: cloneRecord(input.metadata)
  };

  return {
    ...base,
    ...(input.sourcePortId !== undefined ? { sourcePortId: input.sourcePortId } : {}),
    ...(input.targetPortId !== undefined ? { targetPortId: input.targetPortId } : {}),
    ...(input.dataType !== undefined ? { dataType: input.dataType } : {})
  };
};

export const cloneGroup = (input: GroupInput | Group): Group => ({
  id: input.id ?? createGroupId("snapshot"),
  name: input.name,
  nodeIds: [...(input.nodeIds ?? [])].sort(),
  metadata: cloneRecord(input.metadata)
});

export const createGraphSnapshot = (
  input: GraphInput & { readonly metadata: GraphMetadata }
): GraphSnapshot => {
  const groups = (input.groups ?? []).map((group) => cloneGroup(group)).sort(compareById);
  const nodes = (input.nodes ?? []).map((node) => cloneNode(node)).sort(compareById);
  const edges = (input.edges ?? []).map((edge) => cloneEdge(edge)).sort(compareById);

  return {
    id: input.id ?? createGraphId("snapshot"),
    metadata: cloneMetadata(input.metadata),
    nodes,
    edges,
    groups,
    selection: cloneSelection(input.selection)
  };
};

export const createEmptyGraph = (input?: GraphInput): GraphSnapshot =>
  createGraphSnapshot({
    id: input?.id ?? createGraphId("core"),
    metadata: cloneMetadata(input?.metadata),
    nodes: [],
    edges: [],
    groups: [],
    ...(input?.selection !== undefined ? { selection: input.selection } : {})
  });
