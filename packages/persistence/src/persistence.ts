import type { CoreEngine, CoreEventName, GraphDocumentEnvelope } from "@kaiisuuwii/core";

import type {
  GraphPersistence,
  GraphPersistenceOptions,
  PersistenceConflictStrategy,
  PersistenceSaveRecord
} from "./types.js";
import { PersistenceConflictError } from "./types.js";
import { compareIsoTimestamps, getSavedAt, toSaveRecord } from "./utils.js";

const AUTO_SAVE_EVENTS = [
  "nodeAdded",
  "nodeRemoved",
  "edgeCreated",
  "edgeDeleted",
  "selectionChanged"
] as const satisfies readonly CoreEventName[];

const withSavedAt = (
  document: GraphDocumentEnvelope,
  savedAt: string,
  serializeMetadata: boolean
): GraphDocumentEnvelope => {
  if (!serializeMetadata) {
    return document;
  }

  const metadata = document.graph.metadata as unknown as Readonly<Record<string, unknown>>;

  return {
    ...document,
    graph: {
      ...document.graph,
      metadata: {
        ...metadata,
        savedAt
      } as unknown as typeof document.graph.metadata
    }
  };
};

const resolveInMemorySavedAt = (
  document: GraphDocumentEnvelope,
  lastSaveRecord: PersistenceSaveRecord | undefined
): string | undefined => lastSaveRecord?.savedAt ?? getSavedAt(document);

const shouldBlockSave = (
  strategy: PersistenceConflictStrategy,
  storedSavedAt: string | undefined,
  inMemorySavedAt: string | undefined
): boolean => {
  if (strategy === "last-write-wins" || storedSavedAt === undefined || inMemorySavedAt === undefined) {
    return false;
  }

  return compareIsoTimestamps(storedSavedAt, inMemorySavedAt) > 0;
};

export const createGraphPersistence = (
  engine: CoreEngine,
  options: GraphPersistenceOptions
): GraphPersistence => {
  const autoSaveEnabled = options.autoSave ?? true;
  const autoSaveDebounceMs = options.autoSaveDebounceMs ?? 1000;
  const conflictStrategy = options.conflictStrategy ?? "last-write-wins";
  const serializeMetadata = options.serializeMetadata ?? true;
  const unsubs: Array<() => void> = [];
  let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let saving = false;
  let lastSaveRecord: PersistenceSaveRecord | undefined;

  const clearPendingAutoSave = (): void => {
    if (autoSaveTimer !== undefined) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = undefined;
    }
  };

  const save = async (): Promise<void> => {
    clearPendingAutoSave();
    saving = true;

    try {
      const savedAt = new Date().toISOString();
      const baseDocument = engine.exportGraph();
      const document = withSavedAt(baseDocument, savedAt, serializeMetadata);

      if (conflictStrategy !== "last-write-wins") {
        const storedDocument = await options.adapter.load(options.graphId);
        const storedSavedAt = storedDocument === null ? undefined : getSavedAt(storedDocument);
        const inMemorySavedAt = resolveInMemorySavedAt(baseDocument, lastSaveRecord);

        if (shouldBlockSave(conflictStrategy, storedSavedAt, inMemorySavedAt)) {
          if (conflictStrategy === "skip-if-newer") {
            lastSaveRecord = storedDocument === null
              ? lastSaveRecord
              : toSaveRecord(options.graphId, options.adapter.id, storedDocument) ?? lastSaveRecord;
            return;
          }

          throw new PersistenceConflictError(
            options.graphId,
            storedSavedAt as string,
            inMemorySavedAt as string
          );
        }
      }

      await options.adapter.save(options.graphId, document);
      lastSaveRecord = toSaveRecord(options.graphId, options.adapter.id, document);
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error(String(error));
      options.onSaveError?.(resolvedError);
      throw resolvedError;
    } finally {
      saving = false;
    }
  };

  const scheduleAutoSave = (): void => {
    if (!autoSaveEnabled || disposed) {
      return;
    }

    clearPendingAutoSave();
    autoSaveTimer = setTimeout(() => {
      void save().catch(() => undefined);
    }, autoSaveDebounceMs);
  };

  if (autoSaveEnabled) {
    for (const eventName of AUTO_SAVE_EVENTS) {
      unsubs.push(engine.on(eventName, () => {
        scheduleAutoSave();
      }));
    }
  }

  return {
    graphId: options.graphId,
    load: async () => {
      try {
        const document = await options.adapter.load(options.graphId);

        if (document === null) {
          return null;
        }

        engine.importGraph(document);
        lastSaveRecord = toSaveRecord(options.graphId, options.adapter.id, document);
        return document;
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error(String(error));
        options.onLoadError?.(resolvedError);
        return null;
      }
    },
    save,
    delete: async () => {
      clearPendingAutoSave();
      await options.adapter.delete(options.graphId);
      lastSaveRecord = undefined;
    },
    getLastSaveRecord: () => lastSaveRecord,
    isSaving: () => saving,
    isPendingAutoSave: () => autoSaveTimer !== undefined,
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      clearPendingAutoSave();
      unsubs.forEach((unsubscribe) => unsubscribe());
    }
  };
};
