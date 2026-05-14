import type { CoreEngine, GraphDocumentEnvelope } from "@kaiisuuwii/core";
import type { GraphId } from "@kaiisuuwii/shared";

export interface PersistenceAdapter {
  readonly id: string;
  readonly load: (graphId: GraphId) => Promise<GraphDocumentEnvelope | null>;
  readonly save: (graphId: GraphId, document: GraphDocumentEnvelope) => Promise<void>;
  readonly delete: (graphId: GraphId) => Promise<void>;
  readonly list: () => Promise<readonly GraphId[]>;
  readonly exists: (graphId: GraphId) => Promise<boolean>;
}

export interface PersistenceSaveRecord {
  readonly graphId: GraphId;
  readonly savedAt: string;
  readonly version: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly adapterType: string;
}

export type PersistenceConflictStrategy = "last-write-wins" | "skip-if-newer" | "throw";

export class PersistenceConflictError extends Error {
  public readonly graphId: GraphId;
  public readonly storedSavedAt: string;
  public readonly inMemorySavedAt: string;

  public constructor(graphId: GraphId, storedSavedAt: string, inMemorySavedAt: string) {
    super(`Persistence conflict for "${graphId}": stored document is newer than the in-memory snapshot.`);
    this.name = "PersistenceConflictError";
    this.graphId = graphId;
    this.storedSavedAt = storedSavedAt;
    this.inMemorySavedAt = inMemorySavedAt;
  }
}

export interface GraphPersistenceOptions {
  readonly graphId: GraphId;
  readonly adapter: PersistenceAdapter;
  readonly autoSave?: boolean;
  readonly autoSaveDebounceMs?: number;
  readonly conflictStrategy?: PersistenceConflictStrategy;
  readonly onSaveError?: (err: Error) => void;
  readonly onLoadError?: (err: Error) => void;
  readonly serializeMetadata?: boolean;
}

export interface GraphPersistence {
  readonly graphId: GraphId;
  readonly load: () => Promise<GraphDocumentEnvelope | null>;
  readonly save: () => Promise<void>;
  readonly delete: () => Promise<void>;
  readonly getLastSaveRecord: () => PersistenceSaveRecord | undefined;
  readonly isSaving: () => boolean;
  readonly isPendingAutoSave: () => boolean;
  readonly dispose: () => void;
}

export interface AsyncStorageInterface {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
  readonly getAllKeys: () => Promise<readonly string[]>;
}

export interface FileSystemInterface {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (path: string, content: string, encoding: "utf8") => Promise<void>;
  readonly deleteFile: (path: string) => Promise<void>;
  readonly readDirectory: (path: string) => Promise<readonly string[]>;
  readonly exists: (path: string) => Promise<boolean>;
}

export interface AdapterIndex {
  readonly refresh: () => Promise<readonly PersistenceSaveRecord[]>;
  readonly getAll: () => readonly PersistenceSaveRecord[];
  readonly getRecent: (count: number) => readonly PersistenceSaveRecord[];
  readonly getById: (graphId: GraphId) => PersistenceSaveRecord | undefined;
}

export interface GraphPersistenceControllerFactory {
  readonly create: (engine: CoreEngine, options: GraphPersistenceOptions) => GraphPersistence;
}
