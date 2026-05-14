import type { Doc } from "yjs";

import type { SyncAdapter, SyncConnectionState, WebSocketOptions } from "../types.js";

type ConnectionStateHandler = (state: SyncConnectionState) => void;

export const createWebSocketSyncAdapter = (
  serverUrl: string,
  roomId: string,
  ydoc: Doc,
  options: WebSocketOptions = {}
): SyncAdapter => {
  let provider: unknown = { ydoc };
  let state: SyncConnectionState = "disconnected";
  const listeners = new Set<ConnectionStateHandler>();
  let unsubscribeStatus: (() => void) | undefined;

  const emit = (nextState: SyncConnectionState): void => {
    state = nextState;
    listeners.forEach((listener) => {
      listener(nextState);
    });
  };

  return {
    id: "websocket",
    get provider() {
      return provider;
    },
    connect: async () => {
      emit("connecting");
      const mod = await import("y-websocket");
      const websocketProvider = new mod.WebsocketProvider(serverUrl, roomId, ydoc, {
        ...(options.params !== undefined ? { params: { ...options.params } } : {}),
        ...(options.protocols !== undefined ? { protocols: [...options.protocols] } : {}),
        ...(options.reconnectIntervalMs !== undefined
          ? { resyncInterval: options.reconnectIntervalMs }
          : {})
      });
      provider = websocketProvider;
      const statusHandler = (event: { status: "connected" | "disconnected" }): void => {
        emit(event.status === "connected" ? "connected" : "disconnected");
      };
      websocketProvider.on("status", statusHandler);
      unsubscribeStatus = () => {
        websocketProvider.off("status", statusHandler);
      };
      emit(websocketProvider.wsconnected ? "connected" : websocketProvider.wsconnecting ? "connecting" : "disconnected");
    },
    disconnect: async () => {
      unsubscribeStatus?.();
      unsubscribeStatus = undefined;
      (provider as { destroy?: () => void } | undefined)?.destroy?.();
      provider = { ydoc };
      emit("disconnected");
    },
    getConnectionState: () => state,
    on: (_event, handler) => {
      listeners.add(handler);
    },
    off: (_event, handler) => {
      listeners.delete(handler as ConnectionStateHandler);
    }
  };
};
