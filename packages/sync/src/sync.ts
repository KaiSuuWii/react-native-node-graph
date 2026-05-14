import type { CoreEngine, CoreEventName } from "@kaiisuuwii/core";
import type { EdgeId, NodeId, Vec2 } from "@kaiisuuwii/shared";
import * as Y from "yjs";

import { createSyncAwareness } from "./awareness.js";
import { createEngineBridge } from "./bridge.js";
import { createOfflineQueue } from "./offlineQueue.js";
import type {
  GraphSync,
  GraphSyncOptions,
  SyncAwareness,
  SyncConnectionState
} from "./types.js";
import { createYjsGraphDocument } from "./yjsModel.js";

const deterministicColorFromUserId = (userId: string): string => {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  const red = 80 + (hash & 0x7f);
  const green = 80 + ((hash >> 8) & 0x7f);
  const blue = 80 + ((hash >> 16) & 0x7f);

  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

const getAdapterDoc = (adapter: GraphSyncOptions["adapter"]): Y.Doc => {
  const provider = adapter.provider as { readonly ydoc?: Y.Doc } | undefined;
  return provider?.ydoc instanceof Y.Doc ? provider.ydoc : new Y.Doc();
};

const SYNC_SELECTION_EVENTS = ["selectionChanged"] as const satisfies readonly CoreEventName[];

export const createGraphSync = (
  engine: CoreEngine,
  options: GraphSyncOptions
): GraphSync => {
  const ydoc = getAdapterDoc(options.adapter);
  const yjsDocument = createYjsGraphDocument(ydoc, options.roomId);
  const offlineQueueEnabled = options.offlineQueueEnabled ?? true;
  const offlineQueue = createOfflineQueue(options.offlineQueueMaxSize ?? 500);
  const reconnectIntervalMs = options.reconnectIntervalMs ?? 3000;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  const awareness = createSyncAwareness(
    ydoc,
    options.localUserId,
    options.localDisplayName,
    options.localColor ?? deterministicColorFromUserId(options.localUserId)
  );

  let disposed = false;
  let explicitDisconnect = false;
  let connectionState: SyncConnectionState = options.adapter.getConnectionState();
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let connectPromise: Promise<void> | undefined;

  const bridge = createEngineBridge(engine, yjsDocument, {
    shouldWriteLocal: () => !offlineQueueEnabled || connectionState === "connected",
    onLocalOperation: (operation) => {
      if (offlineQueueEnabled) {
        offlineQueue.enqueue(operation);
      }
    },
    ...(options.onConflict !== undefined ? { onConflict: options.onConflict } : {})
  });

  const clearReconnectTimer = (): void => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const emitConnectionState = (nextState: SyncConnectionState): void => {
    connectionState = nextState;
    options.onConnectionStateChange?.(nextState);
  };

  const syncPresenceSelection = (): void => {
    const selection = engine.getSnapshot().selection;
    awareness.setLocalPresence({
      selectedNodeIds: [...selection.nodeIds] as readonly NodeId[],
      selectedEdgeIds: [...selection.edgeIds] as readonly EdgeId[]
    });
  };

  const selectionUnsubscribers = SYNC_SELECTION_EVENTS.map((eventName) =>
    engine.on(eventName, () => {
      syncPresenceSelection();
    })
  );

  const awarenessHandler = (): void => {
    options.onPresenceChange?.(awareness.getAllPresences());
  };
  awareness.on("change", awarenessHandler);

  const scheduleReconnect = (): void => {
    if (disposed || explicitDisconnect) {
      return;
    }

    if (maxReconnectAttempts !== Number.POSITIVE_INFINITY && reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectAttempts += 1;
      void connect();
    }, reconnectIntervalMs);
  };

  const seedOrLoadInitialState = (): void => {
    if (bridge.isEmpty()) {
      bridge.applySnapshotToYjs(engine.getSnapshot());
    } else {
      bridge.applyYjsToEngine();
    }
  };

  const connect = async (): Promise<void> => {
    if (disposed) {
      return;
    }

    if (connectPromise !== undefined) {
      return connectPromise;
    }

    connectPromise = (async () => {
      emitConnectionState("connecting");

      try {
        await options.adapter.connect();
        emitConnectionState("connected");
        reconnectAttempts = 0;
        clearReconnectTimer();
        seedOrLoadInitialState();

        if (offlineQueueEnabled) {
          offlineQueue.flush(bridge);
        }

        syncPresenceSelection();
      } catch (error) {
        emitConnectionState("error");
        scheduleReconnect();
        throw error;
      } finally {
        connectPromise = undefined;
      }
    })();

    return connectPromise;
  };

  const disconnect = async (): Promise<void> => {
    explicitDisconnect = true;
    clearReconnectTimer();
    await options.adapter.disconnect();
    emitConnectionState("disconnected");
    offlineQueue.clear();
  };

  const adapterStateHandler = (nextState: SyncConnectionState): void => {
    emitConnectionState(nextState);

    if ((nextState === "disconnected" || nextState === "error") && !explicitDisconnect) {
      scheduleReconnect();
    }
  };
  options.adapter.on("connection-state-change", adapterStateHandler);

  syncPresenceSelection();

  return {
    connect,
    disconnect,
    getConnectionState: () => connectionState,
    getAwareness: (): SyncAwareness => awareness,
    updateCursorPosition: (graphSpacePosition: Vec2) => {
      awareness.setLocalPresence({
        cursorPosition: {
          x: graphSpacePosition.x,
          y: graphSpacePosition.y
        }
      });
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      explicitDisconnect = true;
      clearReconnectTimer();
      awareness.off("change", awarenessHandler);
      (awareness as SyncAwareness & { destroy?: () => void }).destroy?.();
      selectionUnsubscribers.forEach((unsubscribe) => unsubscribe());
      options.adapter.off("connection-state-change", adapterStateHandler);
      void options.adapter.disconnect().catch(() => undefined);
      bridge.dispose();
      ydoc.destroy();
    }
  };
};
