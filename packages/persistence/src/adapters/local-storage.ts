import type { GraphId } from "@kaiisuuwii/shared";

import type { PersistenceAdapter } from "../types.js";
import { buildStorageKey, parseGraphDocument, serializeGraphDocument } from "../utils.js";

const getLocalStorage = (storage?: Storage): Storage => {
  const resolved = storage ?? globalThis.localStorage;

  if (resolved === undefined) {
    throw new Error("LocalStorage is not available in the current environment.");
  }

  return resolved;
};

const extractGraphIdFromKey = (key: string, keyPrefix?: string): GraphId | undefined => {
  const prefix = `${keyPrefix ?? "@kaiisuuwii"}:graph:`;
  return key.startsWith(prefix) ? (key.slice(prefix.length) as GraphId) : undefined;
};

export const createLocalStorageAdapter = (
  localStorage?: Storage,
  keyPrefix?: string
): PersistenceAdapter => ({
  id: "local-storage",
  load: async (graphId) => {
    const raw = getLocalStorage(localStorage).getItem(buildStorageKey(graphId, keyPrefix));
    return raw === null ? null : parseGraphDocument(raw);
  },
  save: async (graphId, document) => {
    getLocalStorage(localStorage).setItem(buildStorageKey(graphId, keyPrefix), serializeGraphDocument(document));
  },
  delete: async (graphId) => {
    getLocalStorage(localStorage).removeItem(buildStorageKey(graphId, keyPrefix));
  },
  list: async () => {
    const storage = getLocalStorage(localStorage);
    const result: GraphId[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key === null) {
        continue;
      }

      const graphId = extractGraphIdFromKey(key, keyPrefix);

      if (graphId !== undefined) {
        result.push(graphId);
      }
    }

    return result;
  },
  exists: async (graphId) => getLocalStorage(localStorage).getItem(buildStorageKey(graphId, keyPrefix)) !== null
});
