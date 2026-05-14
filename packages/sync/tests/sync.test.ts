import { createCoreEngine, type NodeTypeDefinition } from "@kaiisuuwii/core";
import {
  createEngineBridge,
  createGraphSync,
  createOfflineQueue,
  createSyncAwareness,
  createYjsGraphDocument,
  edgeToYjsMap,
  nodeToYjsMap,
  yjsMapToEdgeInput,
  yjsMapToNodeInput,
  type SyncAdapter,
  type SyncConnectionState
} from "@kaiisuuwii/sync";
import { createEdgeId, createNodeId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

const syncNodeType: NodeTypeDefinition = {
  type: "sync-node"
};

const createSyncEngine = () =>
  createCoreEngine({
    nodeTypes: [syncNodeType]
  });

const createYMap = (record: Record<string, unknown>): Y.Map<unknown> => {
  const map = new Y.Doc().getMap<unknown>("entry");
  Object.entries(record).forEach(([key, value]) => {
    map.set(key, value);
  });
  return map;
};

const createStandaloneYMap = (record: Record<string, unknown>): Y.Map<unknown> => {
  const map = new Y.Map<unknown>();
  Object.entries(record).forEach(([key, value]) => {
    map.set(key, value);
  });
  return map;
};

type InMemoryPeer = {
  readonly provider: {
    readonly ydoc: Y.Doc;
  };
  connected: boolean;
  updateHandler?: (update: Uint8Array, origin: unknown) => void;
};

const IN_MEMORY_ROOMS = new Map<string, Set<InMemoryPeer>>();

const getRoom = (roomId: string): Set<InMemoryPeer> => {
  const room = IN_MEMORY_ROOMS.get(roomId);

  if (room !== undefined) {
    return room;
  }

  const nextRoom = new Set<InMemoryPeer>();
  IN_MEMORY_ROOMS.set(roomId, nextRoom);
  return nextRoom;
};

const createInMemorySyncAdapter = (roomId: string, ydoc: Y.Doc): SyncAdapter => {
  const provider = { ydoc };
  const peer: InMemoryPeer = {
    provider,
    connected: false
  };
  let state: SyncConnectionState = "disconnected";
  const listeners = new Set<(nextState: SyncConnectionState) => void>();

  const emit = (nextState: SyncConnectionState): void => {
    state = nextState;
    listeners.forEach((listener) => {
      listener(nextState);
    });
  };

  return {
    id: "in-memory",
    provider,
    connect: async () => {
      const room = getRoom(roomId);
      room.add(peer);
      const updateHandler = (update: Uint8Array, origin: unknown): void => {
        if (origin === peer) {
          return;
        }

        room.forEach((candidate) => {
          if (candidate !== peer && candidate.connected) {
            Y.applyUpdate(candidate.provider.ydoc, update, peer);
          }
        });
      };

      peer.updateHandler = updateHandler;
      ydoc.on("update", updateHandler);
      peer.connected = true;

      room.forEach((candidate) => {
        if (candidate !== peer && candidate.connected) {
          Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(candidate.provider.ydoc), candidate);
          Y.applyUpdate(candidate.provider.ydoc, Y.encodeStateAsUpdate(ydoc), peer);
        }
      });

      emit("connected");
    },
    disconnect: async () => {
      if (peer.updateHandler !== undefined) {
        ydoc.off("update", peer.updateHandler);
        peer.updateHandler = undefined;
      }

      peer.connected = false;
      getRoom(roomId).delete(peer);
      emit("disconnected");
    },
    getConnectionState: () => state,
    on: (_event, handler) => {
      listeners.add(handler);
    },
    off: (_event, handler) => {
      listeners.delete(handler as (nextState: SyncConnectionState) => void);
    }
  };
};

describe("sync package", () => {
  it("round-trips node maps through Yjs serialization", () => {
    const node = {
      id: createNodeId("sync"),
      type: "sync-node",
      position: vec2(10, 20),
      dimensions: vec2(120, 80),
      label: "Node",
      properties: { count: 1 },
      ports: [],
      metadata: { role: "source" }
    };
    const map = createYMap(nodeToYjsMap(node));
    const input = yjsMapToNodeInput(map);

    expect(input).toMatchObject({
      id: node.id,
      type: node.type,
      label: node.label
    });
    expect(input.properties).toEqual(node.properties);
  });

  it("round-trips edge maps through Yjs serialization", () => {
    const edge = {
      id: createEdgeId("sync"),
      source: createNodeId("source"),
      target: createNodeId("target"),
      metadata: { weight: 3 }
    };
    const map = createYMap(edgeToYjsMap(edge));
    const input = yjsMapToEdgeInput(map);

    expect(input).toMatchObject({
      id: edge.id,
      source: edge.source,
      target: edge.target
    });
    expect(input.metadata).toEqual(edge.metadata);
  });

  it("writes local engine node additions into Yjs", () => {
    const engine = createSyncEngine();
    const ydoc = new Y.Doc();
    const yjsDocument = createYjsGraphDocument(ydoc, "bridge-write");
    createEngineBridge(engine, yjsDocument);

    const node = engine.createNode({
      id: createNodeId("bridge"),
      type: "sync-node",
      position: vec2(20, 40),
      label: "Bridge"
    });

    expect(yjsDocument.nodes.get(node.id)?.get("label")).toBe("Bridge");
  });

  it("applies remote Yjs node additions back into the engine", () => {
    const engine = createSyncEngine();
    const ydoc = new Y.Doc();
    const yjsDocument = createYjsGraphDocument(ydoc, "bridge-read");
    createEngineBridge(engine, yjsDocument);

    ydoc.transact(() => {
      yjsDocument.nodes.set(
        "node_remote",
        createStandaloneYMap(nodeToYjsMap({
          id: "node_remote",
          type: "sync-node",
          position: vec2(50, 60),
          dimensions: vec2(120, 80),
          label: "Remote",
          properties: {},
          ports: [],
          metadata: {}
        }))
      );
    });

    expect(engine.getSnapshot().nodes.map((node) => node.id)).toContain("node_remote");
  });

  it("prevents remote echo writes from duplicating nodes", () => {
    const engine = createSyncEngine();
    const ydoc = new Y.Doc();
    const yjsDocument = createYjsGraphDocument(ydoc, "bridge-echo");
    createEngineBridge(engine, yjsDocument);

    ydoc.transact(() => {
      yjsDocument.nodes.set(
        "node_echo",
        createStandaloneYMap(nodeToYjsMap({
          id: "node_echo",
          type: "sync-node",
          position: vec2(10, 10),
          dimensions: vec2(120, 80),
          label: "Echo",
          properties: {},
          ports: [],
          metadata: {}
        }))
      );
    });

    expect(yjsDocument.nodes.size).toBe(1);
    expect(engine.getSnapshot().nodes).toHaveLength(1);
  });

  it("drops the oldest queued operation when capacity is exceeded", () => {
    const queue = createOfflineQueue(2);

    queue.enqueue({ kind: "nodeRemoved", nodeId: createNodeId("first") });
    queue.enqueue({ kind: "edgeDeleted", edgeId: createEdgeId("second") });
    queue.enqueue({ kind: "nodeRemoved", nodeId: createNodeId("third") });

    const applied: string[] = [];
    queue.flush({
      applyQueuedOperation: (operation) => {
        applied.push(operation.kind === "edgeDeleted" ? operation.edgeId : operation.nodeId);
      }
    } as Parameters<typeof queue.flush>[0]);

    expect(applied).toHaveLength(2);
    expect(applied[0]).not.toContain("first");
  });

  it("flushes queued operations in FIFO order", () => {
    const queue = createOfflineQueue(4);
    const firstId = createNodeId("first");
    const secondId = createNodeId("second");
    const applied: string[] = [];

    queue.enqueue({ kind: "nodeRemoved", nodeId: firstId });
    queue.enqueue({ kind: "nodeRemoved", nodeId: secondId });
    queue.flush({
      applyQueuedOperation: (operation) => {
        applied.push(operation.kind === "nodeRemoved" ? operation.nodeId : "");
      }
    } as Parameters<typeof queue.flush>[0]);

    expect(applied).toEqual([firstId, secondId]);
  });

  it("merges local awareness updates and filters remote presences", () => {
    const roomId = "awareness-room";
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    createYjsGraphDocument(doc1, roomId);
    createYjsGraphDocument(doc2, roomId);
    const awareness1 = createSyncAwareness(doc1, "user-1", "User One", "#111111");
    const awareness2 = createSyncAwareness(doc2, "user-2", "User Two", "#222222");

    awareness1.setLocalPresence({
      cursorPosition: vec2(10, 20)
    });

    expect(awareness1.getLocalPresence().cursorPosition).toEqual(vec2(10, 20));
    expect(awareness2.getRemotePresences()[0]?.userId).toBe("user-1");

    awareness1.destroy();
    awareness2.destroy();
  });

  it("syncs two in-process clients and flushes queued mutations after reconnect", async () => {
    const roomId = "integration-room";
    const engine1 = createSyncEngine();
    const engine2 = createSyncEngine();
    const sync1 = createGraphSync(engine1, {
      roomId,
      localUserId: "user-1",
      localDisplayName: "User One",
      adapter: createInMemorySyncAdapter(roomId, new Y.Doc())
    });
    const sync2 = createGraphSync(engine2, {
      roomId,
      localUserId: "user-2",
      localDisplayName: "User Two",
      adapter: createInMemorySyncAdapter(roomId, new Y.Doc())
    });

    await sync1.connect();
    await sync2.connect();

    engine1.createNode({
      id: createNodeId("shared"),
      type: "sync-node",
      position: vec2(100, 100),
      label: "Shared"
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(engine2.getSnapshot().nodes).toHaveLength(1);

    await sync1.disconnect();

    for (let index = 0; index < 10; index += 1) {
      engine1.createNode({
        id: createNodeId(`offline_${index}`),
        type: "sync-node",
        position: vec2(index * 10, index * 10),
        label: `Offline ${index}`
      });
    }

    await sync1.connect();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(engine2.getSnapshot().nodes).toHaveLength(11);
    expect(sync2.getAwareness().getRemotePresences()[0]?.userId).toBe("user-1");

    sync1.updateCursorPosition(vec2(320, 220));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(sync2.getAwareness().getRemotePresences()[0]?.cursorPosition).toEqual(vec2(320, 220));

    sync1.dispose();
    sync2.dispose();
    engine1.dispose();
    engine2.dispose();
  });
});
