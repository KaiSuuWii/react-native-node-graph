import type { EngineBridge, OfflineQueue, QueuedOperation } from "./types.js";

const mergeOperation = (queue: QueuedOperation[], operation: QueuedOperation): boolean => {
  if (operation.kind !== "nodeUpdated") {
    return false;
  }

  let index = -1;

  for (let cursor = queue.length - 1; cursor >= 0; cursor -= 1) {
    const candidate = queue[cursor];

    if (
      candidate !== undefined &&
      (candidate.kind === "nodeAdded" || candidate.kind === "nodeUpdated") &&
      candidate.node.id === operation.node.id
    ) {
      index = cursor;
      break;
    }
  }

  if (index < 0) {
    return false;
  }

  queue[index] = {
    ...queue[index],
    node: operation.node
  } as QueuedOperation;
  return true;
};

export const createOfflineQueue = (maxSize: number): OfflineQueue => {
  const queue: QueuedOperation[] = [];

  return {
    enqueue: (operation) => {
      if (mergeOperation(queue, operation)) {
        return;
      }

      queue.push(operation);

      while (queue.length > maxSize) {
        queue.shift();
      }
    },
    flush: (bridge: EngineBridge) => {
      const pending = queue.splice(0, queue.length);

      for (const operation of pending) {
        bridge.applyQueuedOperation(operation);
      }
    },
    clear: () => {
      queue.length = 0;
    },
    size: () => queue.length
  };
};
