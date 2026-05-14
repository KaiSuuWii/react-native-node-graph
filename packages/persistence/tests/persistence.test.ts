import {
  createCoreEngine,
  createGraphSnapshot,
  type GraphDocumentEnvelope,
  type GraphMetadata,
  type NodeTypeDefinition
} from "@kaiisuuwii/core";
import { createGraphId, vec2 } from "@kaiisuuwii/shared";
import {
  PersistenceConflictError,
  createAdapterIndex,
  createAsyncStorageAdapter,
  createFileSystemAdapter,
  createGraphPersistence,
  createLocalStorageAdapter,
  createMemoryAdapter,
  type AsyncStorageInterface,
  type FileSystemInterface,
  type PersistenceAdapter
} from "@kaiisuuwii/persistence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const graphMetadata: GraphMetadata = {
  name: "Persistence Graph",
  version: "0.2.0",
  tags: ["persistence"],
  createdAtIso: "2026-05-12T00:00:00.000Z"
};

const passthroughNodeType: NodeTypeDefinition = {
  type: "passthrough",
  defaultLabel: "Passthrough",
  ports: [
    {
      id: "port_out",
      name: "Out",
      direction: "output"
    }
  ]
};

const createDocument = (
  graphId: `graph_${string}`,
  savedAt?: string
): GraphDocumentEnvelope =>
  ({
    version: 1,
    graph: createGraphSnapshot({
      id: graphId,
      metadata: {
        ...graphMetadata,
        ...(savedAt !== undefined ? { savedAt } : {})
      },
      nodes: [
        {
          id: `node_${graphId}_a`,
          type: "passthrough",
          position: vec2(12, 24),
          label: "A"
        },
        {
          id: `node_${graphId}_b`,
          type: "passthrough",
          position: vec2(180, 24),
          label: "B"
        }
      ],
      edges: [],
      groups: []
    })
  }) satisfies GraphDocumentEnvelope;

const createEngine = () =>
  createCoreEngine({
    nodeTypes: [passthroughNodeType]
  });

const flushAutoSave = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
};

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  public get length(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
  }

  public getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.map.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("memory adapter", () => {
  it("returns false before save, true after save, and null for unknown ids", async () => {
    const adapter = createMemoryAdapter();
    const graphId = createGraphId("memory");
    const document = createDocument(graphId);

    await expect(adapter.exists(graphId)).resolves.toBe(false);
    await expect(adapter.load(graphId)).resolves.toBeNull();

    await adapter.save(graphId, document);

    await expect(adapter.exists(graphId)).resolves.toBe(true);
    await expect(adapter.load(graphId)).resolves.toEqual(document);
  });
});

describe("async storage adapter", () => {
  it("writes the expected key, lists it, and removes it", async () => {
    const store = new Map<string, string>();
    const asyncStorage: AsyncStorageInterface = {
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => {
        store.set(key, value);
      },
      removeItem: async (key) => {
        store.delete(key);
      },
      getAllKeys: async () => [...store.keys()]
    };
    const adapter = createAsyncStorageAdapter(asyncStorage, "@test");
    const graphId = createGraphId("async");

    await adapter.save(graphId, createDocument(graphId));

    expect([...store.keys()]).toEqual([`@test:graph:${graphId}`]);
    await expect(adapter.list()).resolves.toEqual([graphId]);

    await adapter.delete(graphId);
    await expect(adapter.exists(graphId)).resolves.toBe(false);
  });
});

describe("local storage adapter", () => {
  it("uses the prefixed key format and handles corrupt JSON", async () => {
    const storage = new MemoryStorage();
    const adapter = createLocalStorageAdapter(storage, "@web");
    const graphId = createGraphId("local");

    await adapter.save(graphId, createDocument(graphId));

    expect(storage.getItem(`@web:graph:${graphId}`)).toContain(`"id":"${graphId}"`);

    storage.setItem(`@web:graph:${graphId}`, "{not valid json");
    await expect(adapter.load(graphId)).resolves.toBeNull();
  });
});

describe("file system adapter", () => {
  it("returns null when the file does not exist and only lists json ids", async () => {
    const files = new Map<string, string>();
    const fs: FileSystemInterface = {
      readFile: async (path) => {
        const content = files.get(path);

        if (content === undefined) {
          const error = new Error("not found") as Error & { code: string };
          error.code = "ENOENT";
          throw error;
        }

        return content;
      },
      writeFile: async (path, content) => {
        files.set(path, content);
      },
      deleteFile: async (path) => {
        files.delete(path);
      },
      readDirectory: async () => ["graph_saved.json", "notes.txt", "graph_other.json"],
      exists: async (path) => files.has(path)
    };
    const adapter = createFileSystemAdapter(fs, "/graphs");

    await expect(adapter.load("graph_missing")).resolves.toBeNull();
    await expect(adapter.list()).resolves.toEqual(["graph_saved", "graph_other"]);
  });
});

describe("graph persistence controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-saves after the debounce period", async () => {
    const engine = createEngine();
    const saveSpy = vi.fn<PersistenceAdapter["save"]>(async () => undefined);
    const adapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      id: "memory",
      save: saveSpy
    };
    const persistence = createGraphPersistence(engine, {
      graphId: createGraphId("autosave"),
      adapter,
      autoSaveDebounceMs: 50
    });

    engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });

    expect(persistence.isPendingAutoSave()).toBe(true);

    await flushAutoSave(100);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(persistence.isPendingAutoSave()).toBe(false);
    persistence.dispose();
    engine.dispose();
  });

  it("coalesces rapid mutations into a single save", async () => {
    const engine = createEngine();
    const saveSpy = vi.fn<PersistenceAdapter["save"]>(async () => undefined);
    const adapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      id: "memory",
      save: saveSpy
    };
    const persistence = createGraphPersistence(engine, {
      graphId: createGraphId("debounce"),
      adapter,
      autoSaveDebounceMs: 50
    });

    engine.createNode({ type: "passthrough", position: vec2(0, 0) });
    engine.createNode({ type: "passthrough", position: vec2(40, 0) });
    engine.clearSelection();

    await flushAutoSave(100);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    persistence.dispose();
    engine.dispose();
  });

  it("dispose cancels pending auto-save", async () => {
    const engine = createEngine();
    const saveSpy = vi.fn<PersistenceAdapter["save"]>(async () => undefined);
    const adapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      id: "memory",
      save: saveSpy
    };
    const persistence = createGraphPersistence(engine, {
      graphId: createGraphId("dispose"),
      adapter,
      autoSaveDebounceMs: 50
    });

    engine.createNode({ type: "passthrough", position: vec2(0, 0) });
    persistence.dispose();

    await flushAutoSave(100);

    expect(saveSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("injects savedAt into metadata on save", async () => {
    const engine = createEngine();
    const adapter = createMemoryAdapter();
    const graphId = createGraphId("manual");
    const persistence = createGraphPersistence(engine, {
      graphId,
      adapter,
      autoSave: false
    });

    engine.createNode({ type: "passthrough", position: vec2(0, 0) });
    await persistence.save();

    const stored = await adapter.load(graphId);
    expect(typeof stored?.graph.metadata.savedAt).toBe("string");
    expect(typeof persistence.getLastSaveRecord()?.savedAt).toBe("string");
    persistence.dispose();
    engine.dispose();
  });

  it("last-write-wins always saves", async () => {
    const graphId = createGraphId("lww");
    const adapter = createMemoryAdapter();
    await adapter.save(graphId, createDocument(graphId, "2026-05-12T00:00:10.000Z"));
    const saveSpy = vi.fn(adapter.save);
    const engine = createEngine();
    const persistence = createGraphPersistence(engine, {
      graphId,
      adapter: {
        ...adapter,
        save: saveSpy
      },
      autoSave: false,
      conflictStrategy: "last-write-wins"
    });

    engine.importGraph(createDocument(graphId, "2026-05-12T00:00:01.000Z"));
    await persistence.save();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    persistence.dispose();
    engine.dispose();
  });

  it("skip-if-newer does not overwrite a newer stored document", async () => {
    const graphId = createGraphId("skip");
    const adapter = createMemoryAdapter();
    const storedDocument = createDocument(graphId, "2026-05-12T00:00:10.000Z");
    await adapter.save(graphId, storedDocument);
    const saveSpy = vi.fn(adapter.save);
    const engine = createEngine();
    const persistence = createGraphPersistence(engine, {
      graphId,
      adapter: {
        ...adapter,
        save: saveSpy
      },
      autoSave: false,
      conflictStrategy: "skip-if-newer"
    });

    engine.importGraph(createDocument(graphId, "2026-05-12T00:00:01.000Z"));
    await persistence.save();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(persistence.getLastSaveRecord()?.savedAt).toBe("2026-05-12T00:00:10.000Z");
    persistence.dispose();
    engine.dispose();
  });

  it("throw raises PersistenceConflictError with both timestamps", async () => {
    const graphId = createGraphId("throw");
    const adapter = createMemoryAdapter();
    await adapter.save(graphId, createDocument(graphId, "2026-05-12T00:00:10.000Z"));
    const engine = createEngine();
    const persistence = createGraphPersistence(engine, {
      graphId,
      adapter,
      autoSave: false,
      conflictStrategy: "throw"
    });

    engine.importGraph(createDocument(graphId, "2026-05-12T00:00:01.000Z"));

    await expect(persistence.save()).rejects.toMatchObject<PersistenceConflictError>({
      name: "PersistenceConflictError",
      graphId,
      storedSavedAt: "2026-05-12T00:00:10.000Z",
      inMemorySavedAt: "2026-05-12T00:00:01.000Z"
    });

    persistence.dispose();
    engine.dispose();
  });

  it("calls onSaveError when adapter.save rejects", async () => {
    const engine = createEngine();
    const onSaveError = vi.fn();
    const persistence = createGraphPersistence(engine, {
      graphId: createGraphId("save-error"),
      adapter: {
        ...createMemoryAdapter(),
        id: "broken",
        save: async () => {
          throw new Error("save failed");
        }
      },
      autoSave: false,
      onSaveError
    });

    await expect(persistence.save()).rejects.toThrow("save failed");
    expect(onSaveError).toHaveBeenCalledTimes(1);
    persistence.dispose();
    engine.dispose();
  });

  it("calls onLoadError when adapter.load rejects", async () => {
    const engine = createEngine();
    const onLoadError = vi.fn();
    const persistence = createGraphPersistence(engine, {
      graphId: createGraphId("load-error"),
      adapter: {
        ...createMemoryAdapter(),
        id: "broken",
        load: async () => {
          throw new Error("load failed");
        }
      },
      autoSave: false,
      onLoadError
    });

    await expect(persistence.load()).resolves.toBeNull();
    expect(onLoadError).toHaveBeenCalledTimes(1);
    persistence.dispose();
    engine.dispose();
  });

  it("round-trips a saved graph into a fresh engine", async () => {
    const graphId = createGraphId("roundtrip");
    const adapter = createMemoryAdapter();
    const sourceEngine = createEngine();
    const targetEngine = createEngine();
    const sourcePersistence = createGraphPersistence(sourceEngine, {
      graphId,
      adapter,
      autoSave: false
    });
    const targetPersistence = createGraphPersistence(targetEngine, {
      graphId,
      adapter,
      autoSave: false
    });

    sourceEngine.createNode({ type: "passthrough", position: vec2(20, 40) });
    sourceEngine.createNode({ type: "passthrough", position: vec2(140, 40) });
    await sourcePersistence.save();
    await targetPersistence.load();

    expect(targetEngine.getSnapshot().nodes).toEqual(sourceEngine.getSnapshot().nodes);
    expect(typeof targetEngine.getSnapshot().metadata.savedAt).toBe("string");

    sourcePersistence.dispose();
    targetPersistence.dispose();
    sourceEngine.dispose();
    targetEngine.dispose();
  });
});

describe("adapter index", () => {
  it("returns recent documents sorted by savedAt descending", async () => {
    const adapter = createMemoryAdapter();
    const graphIds = [
      createGraphId("index-a"),
      createGraphId("index-b"),
      createGraphId("index-c"),
      createGraphId("index-d")
    ] as const;
    const timestamps = [
      "2026-05-12T00:00:01.000Z",
      "2026-05-12T00:00:04.000Z",
      "2026-05-12T00:00:03.000Z",
      "2026-05-12T00:00:02.000Z"
    ] as const;

    for (let index = 0; index < graphIds.length; index += 1) {
      await adapter.save(graphIds[index], createDocument(graphIds[index], timestamps[index]));
    }

    const index = createAdapterIndex(adapter);
    await index.refresh();

    expect(index.getRecent(3).map((record) => record.graphId)).toEqual([
      graphIds[1],
      graphIds[2],
      graphIds[3]
    ]);
    expect(index.getById(graphIds[0])?.savedAt).toBe(timestamps[0]);
  });
});
