import type { EdgeId, NodeId } from "@kaiisuuwii/shared";

import type { GroupId, PortId, PortInput } from "./types.js";

let portIdCounter = 0;
let groupIdCounter = 0;

export const createPortId = (seed = "port"): PortId => {
  portIdCounter += 1;
  return `port_${seed}_${portIdCounter.toString(36).padStart(4, "0")}`;
};

export const createGroupId = (seed = "group"): GroupId => {
  groupIdCounter += 1;
  return `group_${seed}_${groupIdCounter.toString(36).padStart(4, "0")}`;
};

export const createNodeFactory = (seed: string): ((input?: string) => NodeId) => {
  let counter = 0;

  return (input = seed): NodeId => {
    counter += 1;
    return `node_${input}_${counter.toString(36).padStart(4, "0")}`;
  };
};

export const createEdgeFactory = (seed: string): ((input?: string) => EdgeId) => {
  let counter = 0;

  return (input = seed): EdgeId => {
    counter += 1;
    return `edge_${input}_${counter.toString(36).padStart(4, "0")}`;
  };
};

export const createGroupFactory = (seed: string): ((input?: string) => GroupId) => {
  let counter = 0;

  return (input = seed): GroupId => {
    counter += 1;
    return `group_${input}_${counter.toString(36).padStart(4, "0")}`;
  };
};

export const makePortId = (nodeId: NodeId, index: number, port: PortInput): PortId => {
  const normalizedName = port.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const suffix = normalizedName.length > 0 ? normalizedName : index.toString(36).padStart(4, "0");
  return `port_${nodeId}_${port.direction}_${suffix}`;
};
