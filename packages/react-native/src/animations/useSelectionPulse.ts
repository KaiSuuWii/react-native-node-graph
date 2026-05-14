import type { GraphSnapshot } from "@kaiisuuwii/core";

import { createSharedValue, withTiming } from "../runtime.js";

export const selectionKeyFromSnapshot = (snapshot: GraphSnapshot): string =>
  [
    snapshot.selection.nodeIds.join("|"),
    snapshot.selection.edgeIds.join("|"),
    snapshot.selection.groupIds.join("|")
  ].join("::");

export const useSelectionPulse = (snapshot: GraphSnapshot) => {
  const pulse = createSharedValue(0);
  let previousKey = selectionKeyFromSnapshot(snapshot);

  return {
    pulse,
    sync: (nextSnapshot: GraphSnapshot) => {
      const nextKey = selectionKeyFromSnapshot(nextSnapshot);

      if (nextKey !== previousKey) {
        withTiming(pulse, 1);
        withTiming(pulse, 0.4);
        withTiming(pulse, 0);
        previousKey = nextKey;
      }

      return pulse;
    }
  };
};
