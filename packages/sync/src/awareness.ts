import type { EdgeId, NodeId, Vec2 } from "@kaiisuuwii/shared";
import type { Doc } from "yjs";

import type { SyncAwareness, SyncPresence } from "./types.js";

type AwarenessChangeHandler = (added: number[], updated: number[], removed: number[]) => void;

interface PresenceRoomState {
  readonly presences: Map<number, SyncPresence>;
  readonly listeners: Set<AwarenessChangeHandler>;
}

const PRESENCE_ROOMS = new Map<string, PresenceRoomState>();

const getRoomId = (ydoc: Doc): string => {
  const roomId = ydoc.getMap("schema").get("roomId");
  return typeof roomId === "string" && roomId.length > 0 ? roomId : ydoc.guid;
};

const getPresenceRoom = (roomId: string): PresenceRoomState => {
  const room = PRESENCE_ROOMS.get(roomId);

  if (room !== undefined) {
    return room;
  }

  const nextRoom: PresenceRoomState = {
    presences: new Map(),
    listeners: new Set()
  };
  PRESENCE_ROOMS.set(roomId, nextRoom);
  return nextRoom;
};

const clonePresence = (presence: SyncPresence): SyncPresence => ({
  ...presence,
  ...(presence.cursorPosition !== undefined
    ? {
        cursorPosition: {
          x: presence.cursorPosition.x,
          y: presence.cursorPosition.y
        } satisfies Vec2
      }
    : {}),
  selectedNodeIds: [...presence.selectedNodeIds] as readonly NodeId[],
  selectedEdgeIds: [...presence.selectedEdgeIds] as readonly EdgeId[]
});

const emit = (
  room: PresenceRoomState,
  added: number[],
  updated: number[],
  removed: number[]
): void => {
  room.listeners.forEach((listener) => {
    listener(added, updated, removed);
  });
};

const makeInitialPresence = (
  clientId: number,
  userId: string,
  displayName: string,
  color: string
): SyncPresence => {
  const now = new Date().toISOString();

  return {
    clientId,
    userId,
    displayName,
    color,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    connectedAt: now,
    lastActiveAt: now
  };
};

export const createSyncAwareness = (
  ydoc: Doc,
  localUserId: string,
  localDisplayName: string,
  localColor: string
): SyncAwareness & { destroy: () => void } => {
  const roomId = getRoomId(ydoc);
  const room = getPresenceRoom(roomId);
  let localPresence = makeInitialPresence(ydoc.clientID, localUserId, localDisplayName, localColor);

  room.presences.set(localPresence.clientId, clonePresence(localPresence));
  emit(room, [localPresence.clientId], [], []);

  return {
    setLocalPresence: (presence) => {
      localPresence = {
        ...localPresence,
        ...presence,
        selectedNodeIds: [...(presence.selectedNodeIds ?? localPresence.selectedNodeIds)],
        selectedEdgeIds: [...(presence.selectedEdgeIds ?? localPresence.selectedEdgeIds)],
        lastActiveAt: new Date().toISOString()
      };
      room.presences.set(localPresence.clientId, clonePresence(localPresence));
      emit(room, [], [localPresence.clientId], []);
    },
    getLocalPresence: () => clonePresence(localPresence),
    getRemotePresences: () =>
      [...room.presences.values()]
        .filter((presence) => presence.clientId !== localPresence.clientId)
        .map(clonePresence),
    getAllPresences: () => [...room.presences.values()].map(clonePresence),
    on: (_event, handler) => {
      room.listeners.add(handler);
    },
    off: (_event, handler) => {
      room.listeners.delete(handler as AwarenessChangeHandler);
    },
    destroy: () => {
      if (room.presences.delete(localPresence.clientId)) {
        emit(room, [], [], [localPresence.clientId]);
      }
    }
  };
};
