import type { Doc } from "yjs";

import type { SyncAdapter, SyncConnectionState, WebRTCOptions } from "../types.js";

type ConnectionStateHandler = (state: SyncConnectionState) => void;

export const createWebRTCSyncAdapter = (
  roomId: string,
  ydoc: Doc,
  options: WebRTCOptions = {}
): SyncAdapter => {
  let provider: unknown = { ydoc };
  let state: SyncConnectionState = "disconnected";
  const listeners = new Set<ConnectionStateHandler>();

  const emit = (nextState: SyncConnectionState): void => {
    state = nextState;
    listeners.forEach((listener) => {
      listener(nextState);
    });
  };

  return {
    id: "webrtc",
    get provider() {
      return provider;
    },
    connect: async () => {
      emit("connecting");
      const mod = await import("y-webrtc");
      provider = new mod.WebrtcProvider(roomId, ydoc, {
        ...(options.signaling !== undefined ? { signaling: [...options.signaling] } : {}),
        ...(options.password !== undefined ? { password: options.password } : {})
      });
      emit((provider as { connected?: boolean }).connected ? "connected" : "connecting");
    },
    disconnect: async () => {
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
