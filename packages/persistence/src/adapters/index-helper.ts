import type { GraphId } from "@kaiisuuwii/shared";

import type { AdapterIndex, PersistenceAdapter, PersistenceSaveRecord } from "../types.js";
import { compareIsoTimestamps, toSaveRecord } from "../utils.js";

export const createAdapterIndex = (adapter: PersistenceAdapter): AdapterIndex => {
  let records: readonly PersistenceSaveRecord[] = [];

  return {
    refresh: async () => {
      const graphIds = await adapter.list();
      const nextRecords: PersistenceSaveRecord[] = [];

      for (const graphId of graphIds) {
        const document = await adapter.load(graphId);

        if (document === null) {
          continue;
        }

        const record = toSaveRecord(graphId, adapter.id, document);

        if (record !== undefined) {
          nextRecords.push(record);
        }
      }

      records = nextRecords.sort((left, right) => compareIsoTimestamps(right.savedAt, left.savedAt));
      return records;
    },
    getAll: () => records,
    getRecent: (count) => records.slice(0, Math.max(0, count)),
    getById: (graphId: GraphId) => records.find((record) => record.graphId === graphId)
  };
};
