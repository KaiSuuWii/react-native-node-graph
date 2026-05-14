import type { GraphDocumentEnvelope } from "@kaiisuuwii/core";
import type { GraphId } from "@kaiisuuwii/shared";

import type { PersistenceSaveRecord } from "./types.js";

const DEFAULT_PREFIX = "@kaiisuuwii";

export const buildStorageKey = (graphId: GraphId, keyPrefix?: string): string =>
  `${keyPrefix ?? DEFAULT_PREFIX}:graph:${graphId}`;

export const isMissingResourceError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error.message.toLowerCase();
  return (
    code === "ENOENT" ||
    message.includes("not found") ||
    message.includes("no such file") ||
    message.includes("cannot find")
  );
};

export const parseGraphDocument = (serialized: string): GraphDocumentEnvelope | null => {
  try {
    return JSON.parse(serialized) as GraphDocumentEnvelope;
  } catch {
    return null;
  }
};

export const serializeGraphDocument = (document: GraphDocumentEnvelope, pretty = false): string =>
  JSON.stringify(document, null, pretty ? 2 : undefined);

export const cloneDocument = (document: GraphDocumentEnvelope): GraphDocumentEnvelope =>
  JSON.parse(JSON.stringify(document)) as GraphDocumentEnvelope;

export const getSavedAt = (document: GraphDocumentEnvelope): string | undefined => {
  const candidate = (document.graph.metadata as unknown as Readonly<Record<string, unknown>>).savedAt;
  return typeof candidate === "string" ? candidate : undefined;
};

export const compareIsoTimestamps = (left: string, right: string): number => {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return left.localeCompare(right);
  }

  return leftMs - rightMs;
};

export const toSaveRecord = (
  graphId: GraphId,
  adapterType: string,
  document: GraphDocumentEnvelope
): PersistenceSaveRecord | undefined => {
  const savedAt = getSavedAt(document);

  if (savedAt === undefined) {
    return undefined;
  }

  return {
    graphId,
    savedAt,
    version: document.version,
    nodeCount: document.graph.nodes.length,
    edgeCount: document.graph.edges.length,
    adapterType
  };
};
