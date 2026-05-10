import {
  createGraphId,
  type EdgeId,
  type GraphId,
  type GraphMetadata,
  type NodeId
} from "@kaiisuuwii/shared";

import { cloneMetadata } from "./model.js";
import type {
  GraphInput,
  GraphSnapshot,
  Group,
  GroupId,
  HistoryCommand,
  Node,
  PortId,
  SelectionSnapshot,
  Edge
} from "./types.js";

export interface HistoryTransaction {
  label: string;
  commands: HistoryCommand[];
}

export interface HistoryState {
  undoStack: HistoryCommand[];
  redoStack: HistoryCommand[];
  transactionStack: HistoryTransaction[];
}

export interface InternalState {
  id: GraphId;
  metadata: GraphMetadata;
  nodeMap: Map<NodeId, Node>;
  edgeMap: Map<EdgeId, Edge>;
  groupMap: Map<GroupId, Group>;
  portLookup: Map<string, NodeId>;
  incomingEdges: Map<NodeId, Set<EdgeId>>;
  outgoingEdges: Map<NodeId, Set<EdgeId>>;
  selection: {
    nodeIds: Set<NodeId>;
    edgeIds: Set<EdgeId>;
    groupIds: Set<GroupId>;
  };
  history: HistoryState;
}

export const makeEmptyState = (graph?: GraphInput | GraphSnapshot): InternalState => ({
  id: graph?.id ?? createGraphId("core"),
  metadata: cloneMetadata(graph?.metadata),
  nodeMap: new Map<NodeId, Node>(),
  edgeMap: new Map<EdgeId, Edge>(),
  groupMap: new Map<GroupId, Group>(),
  portLookup: new Map<string, NodeId>(),
  incomingEdges: new Map<NodeId, Set<EdgeId>>(),
  outgoingEdges: new Map<NodeId, Set<EdgeId>>(),
  selection: {
    nodeIds: new Set<NodeId>(graph?.selection?.nodeIds ?? []),
    edgeIds: new Set<EdgeId>(graph?.selection?.edgeIds ?? []),
    groupIds: new Set<GroupId>(graph?.selection?.groupIds ?? [])
  },
  history: {
    undoStack: [],
    redoStack: [],
    transactionStack: []
  }
});

export const getPortLookupKey = (nodeId: NodeId, portId: PortId): string => `${nodeId}:${portId}`;

export const setSelectionFromSnapshot = (
  state: InternalState,
  selection: Pick<SelectionSnapshot, "nodeIds" | "edgeIds" | "groupIds">
): void => {
  state.selection.nodeIds = new Set(selection.nodeIds);
  state.selection.edgeIds = new Set(selection.edgeIds);
  state.selection.groupIds = new Set(selection.groupIds);
};
