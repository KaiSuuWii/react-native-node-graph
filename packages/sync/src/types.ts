import type {
  CoreEngine,
  EdgeInput,
  GraphEdgeSnapshot,
  GraphNodeSnapshot,
  GraphSnapshot,
  NodeInput
} from "@kaiisuuwii/core";
import type { EdgeId, NodeId, Vec2 } from "@kaiisuuwii/shared";

export type SyncConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface SyncPresence {
  readonly clientId: number;
  readonly userId: string;
  readonly displayName: string;
  readonly color: string;
  readonly cursorPosition?: Vec2;
  readonly selectedNodeIds: readonly NodeId[];
  readonly selectedEdgeIds: readonly EdgeId[];
  readonly connectedAt: string;
  readonly lastActiveAt: string;
}

export interface SyncAwareness {
  setLocalPresence(presence: Partial<SyncPresence>): void;
  getLocalPresence(): SyncPresence;
  getRemotePresences(): readonly SyncPresence[];
  getAllPresences(): readonly SyncPresence[];
  on(event: "change", handler: (added: number[], updated: number[], removed: number[]) => void): void;
  off(event: "change", handler: (...args: any[]) => void): void;
}

export interface SyncAdapter {
  readonly id: string;
  readonly provider: unknown;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): SyncConnectionState;
  on(event: "connection-state-change", handler: (state: SyncConnectionState) => void): void;
  off(event: "connection-state-change", handler: (...args: any[]) => void): void;
}

export interface SyncConflict {
  readonly type: "node-update" | "edge-create" | "node-delete" | "edge-delete";
  readonly entityId: string;
  readonly localOperation: unknown;
  readonly remoteOperation: unknown;
}

export interface GraphSyncOptions {
  readonly roomId: string;
  readonly localUserId: string;
  readonly localDisplayName: string;
  readonly localColor?: string;
  readonly adapter: SyncAdapter;
  readonly offlineQueueEnabled?: boolean;
  readonly offlineQueueMaxSize?: number;
  readonly reconnectIntervalMs?: number;
  readonly maxReconnectAttempts?: number;
  readonly onConflict?: (conflict: SyncConflict) => "keep-local" | "keep-remote";
  readonly onConnectionStateChange?: (state: SyncConnectionState) => void;
  readonly onPresenceChange?: (presences: readonly SyncPresence[]) => void;
}

export interface GraphSync {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): SyncConnectionState;
  getAwareness(): SyncAwareness;
  updateCursorPosition(graphSpacePosition: Vec2): void;
  dispose(): void;
}

export interface YjsGraphDocument {
  readonly ydoc: import("yjs").Doc;
  readonly nodes: import("yjs").Map<import("yjs").Map<unknown>>;
  readonly edges: import("yjs").Map<import("yjs").Map<unknown>>;
  readonly groups: import("yjs").Map<import("yjs").Map<unknown>>;
  readonly metadata: import("yjs").Map<unknown>;
  readonly schema: import("yjs").Map<unknown>;
}

export type QueuedOperation =
  | { readonly kind: "nodeAdded"; readonly node: GraphNodeSnapshot }
  | { readonly kind: "nodeUpdated"; readonly node: GraphNodeSnapshot }
  | { readonly kind: "nodeRemoved"; readonly nodeId: NodeId }
  | { readonly kind: "edgeCreated"; readonly edge: GraphEdgeSnapshot }
  | { readonly kind: "edgeDeleted"; readonly edgeId: EdgeId };

export interface OfflineQueue {
  enqueue(operation: QueuedOperation): void;
  flush(bridge: EngineBridge): void;
  clear(): void;
  size(): number;
}

export interface EngineBridge {
  readonly yjsDocument: YjsGraphDocument;
  readonly applyQueuedOperation: (operation: QueuedOperation) => void;
  readonly applySnapshotToYjs: (snapshot: GraphSnapshot) => void;
  readonly applyYjsToEngine: () => void;
  readonly getSnapshotFromYjs: () => GraphSnapshot;
  readonly isEmpty: () => boolean;
  readonly dispose: () => void;
}

export interface EngineBridgeOptions {
  readonly shouldWriteLocal?: () => boolean;
  readonly onLocalOperation?: (operation: QueuedOperation) => void;
  readonly onConflict?: (conflict: SyncConflict) => "keep-local" | "keep-remote";
}

export interface WebSocketOptions {
  readonly params?: Readonly<Record<string, string>>;
  readonly protocols?: readonly string[];
  readonly reconnectIntervalMs?: number;
}

export interface WebRTCOptions {
  readonly signaling?: readonly string[];
  readonly password?: string;
}
