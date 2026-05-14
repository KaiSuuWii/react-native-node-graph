import type { GraphDocumentEnvelope } from "@kaiisuuwii/core";
import type { GraphId } from "@kaiisuuwii/shared";

import type { PersistenceAdapter } from "../types.js";
import { cloneDocument } from "../utils.js";

export const createMemoryAdapter = (): PersistenceAdapter => {
  const documents = new Map<GraphId, GraphDocumentEnvelope>();

  return {
    id: "memory",
    load: async (graphId) => {
      const document = documents.get(graphId);
      return document === undefined ? null : cloneDocument(document);
    },
    save: async (graphId, document) => {
      documents.set(graphId, cloneDocument(document));
    },
    delete: async (graphId) => {
      documents.delete(graphId);
    },
    list: async () => [...documents.keys()],
    exists: async (graphId) => documents.has(graphId)
  };
};
