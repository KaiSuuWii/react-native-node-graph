import * as Y from "yjs";

import type { YjsGraphDocument } from "./types.js";

export const createYjsGraphDocument = (ydoc: Y.Doc, roomId: string): YjsGraphDocument => {
  const nodes = ydoc.getMap<Y.Map<unknown>>("nodes");
  const edges = ydoc.getMap<Y.Map<unknown>>("edges");
  const groups = ydoc.getMap<Y.Map<unknown>>("groups");
  const metadata = ydoc.getMap<unknown>("metadata");
  const schema = ydoc.getMap<unknown>("schema");

  if (schema.get("roomId") === undefined) {
    schema.set("roomId", roomId);
  }

  if (schema.get("createdAt") === undefined) {
    schema.set("createdAt", new Date().toISOString());
  }

  if (schema.get("version") === undefined) {
    schema.set("version", 1);
  }

  return {
    ydoc,
    nodes,
    edges,
    groups,
    metadata,
    schema
  };
};
