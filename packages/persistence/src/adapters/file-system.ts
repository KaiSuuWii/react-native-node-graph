import type { GraphId } from "@kaiisuuwii/shared";

import type { FileSystemInterface, PersistenceAdapter } from "../types.js";
import { isMissingResourceError, parseGraphDocument, serializeGraphDocument } from "../utils.js";

const toFilePath = (directory: string, graphId: GraphId): string => `${directory}/${graphId}.json`;

export const createFileSystemAdapter = (
  fs: FileSystemInterface,
  directory: string
): PersistenceAdapter => ({
  id: "file-system",
  load: async (graphId) => {
    try {
      const raw = await fs.readFile(toFilePath(directory, graphId), "utf8");
      return parseGraphDocument(raw);
    } catch (error) {
      if (isMissingResourceError(error)) {
        return null;
      }

      throw error;
    }
  },
  save: async (graphId, document) => {
    await fs.writeFile(toFilePath(directory, graphId), serializeGraphDocument(document, true), "utf8");
  },
  delete: async (graphId) => {
    try {
      await fs.deleteFile(toFilePath(directory, graphId));
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
    }
  },
  list: async () => {
    const entries = await fs.readDirectory(directory);
    return entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.slice(0, -".json".length) as GraphId);
  },
  exists: async (graphId) => fs.exists(toFilePath(directory, graphId))
});
