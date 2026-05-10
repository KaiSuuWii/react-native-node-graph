import type { Bounds, Vec2 } from "@kaiisuuwii/shared";

import type { SpatialIndex, SpatialIndexEntry, SpatialIndexEntryKind } from "./types.js";

const createCellKey = (x: number, y: number): string => `${x}:${y}`;

const getCellRange = (bounds: Bounds, cellSize: number): readonly [number, number, number, number] => [
  Math.floor(bounds.min.x / cellSize),
  Math.floor(bounds.min.y / cellSize),
  Math.floor(bounds.max.x / cellSize),
  Math.floor(bounds.max.y / cellSize)
];

const boundsContainPoint = (bounds: Bounds, point: Vec2): boolean =>
  point.x >= bounds.min.x &&
  point.x <= bounds.max.x &&
  point.y >= bounds.min.y &&
  point.y <= bounds.max.y;

const boundsOverlap = (left: Bounds, right: Bounds): boolean =>
  left.min.x <= right.max.x &&
  left.max.x >= right.min.x &&
  left.min.y <= right.max.y &&
  left.max.y >= right.min.y;

export const createSpatialIndex = (cellSize = 128): SpatialIndex => {
  const entries = new Map<string, SpatialIndexEntry>();
  const cells = new Map<string, Set<string>>();

  const getEntryKey = (kind: SpatialIndexEntryKind, id: string): string => `${kind}:${id}`;

  const unlinkEntry = (entry: SpatialIndexEntry): void => {
    const [minCellX, minCellY, maxCellX, maxCellY] = getCellRange(entry.bounds, cellSize);

    for (let x = minCellX; x <= maxCellX; x += 1) {
      for (let y = minCellY; y <= maxCellY; y += 1) {
        const cellKey = createCellKey(x, y);
        const cell = cells.get(cellKey);

        cell?.delete(getEntryKey(entry.kind, entry.id));

        if (cell !== undefined && cell.size === 0) {
          cells.delete(cellKey);
        }
      }
    }
  };

  const linkEntry = (entry: SpatialIndexEntry): void => {
    const [minCellX, minCellY, maxCellX, maxCellY] = getCellRange(entry.bounds, cellSize);

    for (let x = minCellX; x <= maxCellX; x += 1) {
      for (let y = minCellY; y <= maxCellY; y += 1) {
        const cellKey = createCellKey(x, y);
        const cell = cells.get(cellKey) ?? new Set<string>();

        cell.add(getEntryKey(entry.kind, entry.id));
        cells.set(cellKey, cell);
      }
    }
  };

  const queryEntries = (keys: readonly string[]): SpatialIndexEntry[] => {
    const results = new Map<string, SpatialIndexEntry>();

    for (const key of keys) {
      for (const entryKey of cells.get(key) ?? []) {
        const entry = entries.get(entryKey);

        if (entry !== undefined) {
          results.set(entryKey, entry);
        }
      }
    }

    return [...results.values()];
  };

  return {
    cellSize,
    getEntries: () => [...entries.values()],
    insert: (entry) => {
      const entryKey = getEntryKey(entry.kind, entry.id);
      const previous = entries.get(entryKey);

      if (previous !== undefined) {
        unlinkEntry(previous);
      }

      entries.set(entryKey, entry);
      linkEntry(entry);
    },
    update: (entry) => {
      const entryKey = getEntryKey(entry.kind, entry.id);
      const previous = entries.get(entryKey);

      if (previous !== undefined) {
        unlinkEntry(previous);
      }

      entries.set(entryKey, entry);
      linkEntry(entry);
    },
    remove: (kind, id) => {
      const entryKey = getEntryKey(kind, id);
      const entry = entries.get(entryKey);

      if (entry === undefined) {
        return false;
      }

      unlinkEntry(entry);
      entries.delete(entryKey);
      return true;
    },
    queryPoint: (point) => {
      const cellKey = createCellKey(
        Math.floor(point.x / cellSize),
        Math.floor(point.y / cellSize)
      );

      return queryEntries([cellKey]).filter((entry) => boundsContainPoint(entry.bounds, point));
    },
    queryBounds: (bounds) => {
      const [minCellX, minCellY, maxCellX, maxCellY] = getCellRange(bounds, cellSize);
      const cellKeys: string[] = [];

      for (let x = minCellX; x <= maxCellX; x += 1) {
        for (let y = minCellY; y <= maxCellY; y += 1) {
          cellKeys.push(createCellKey(x, y));
        }
      }

      return queryEntries(cellKeys).filter((entry) => boundsOverlap(entry.bounds, bounds));
    }
  };
};
