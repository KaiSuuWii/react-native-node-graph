import type { GraphId } from "@kaiisuuwii/shared";

import type { AsyncStorageInterface, PersistenceAdapter } from "../types.js";
import { buildStorageKey, parseGraphDocument, serializeGraphDocument } from "../utils.js";

const extractGraphIdFromKey = (key: string, keyPrefix?: string): GraphId | undefined => {
  const prefix = `${keyPrefix ?? "@kaiisuuwii"}:graph:`;
  return key.startsWith(prefix) ? (key.slice(prefix.length) as GraphId) : undefined;
};

export const createAsyncStorageAdapter = (
  asyncStorage: AsyncStorageInterface,
  keyPrefix?: string
): PersistenceAdapter => ({
  id: "async-storage",
  load: async (graphId) => {
    const raw = await asyncStorage.getItem(buildStorageKey(graphId, keyPrefix));
    return raw === null ? null : parseGraphDocument(raw);
  },
  save: async (graphId, document) => {
    await asyncStorage.setItem(buildStorageKey(graphId, keyPrefix), serializeGraphDocument(document));
  },
  delete: async (graphId) => {
    await asyncStorage.removeItem(buildStorageKey(graphId, keyPrefix));
  },
  list: async () => {
    const keys = await asyncStorage.getAllKeys();
    return keys
      .map((key) => extractGraphIdFromKey(key, keyPrefix))
      .filter((graphId): graphId is GraphId => graphId !== undefined);
  },
  exists: async (graphId) => (await asyncStorage.getItem(buildStorageKey(graphId, keyPrefix))) !== null
});
