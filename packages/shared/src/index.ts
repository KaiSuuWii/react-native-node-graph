export type GraphId = `graph_${string}`;
export type NodeId = `node_${string}`;
export type EdgeId = `edge_${string}`;

const DEFAULT_ID_SEED = "seed";
let idCounter = 0;

const nextId = (prefix: "graph" | "node" | "edge", seed = DEFAULT_ID_SEED): string => {
  idCounter += 1;
  return `${prefix}_${seed}_${idCounter.toString(36).padStart(4, "0")}`;
};

export const createGraphId = (seed?: string): GraphId => nextId("graph", seed) as GraphId;

export const createNodeId = (seed?: string): NodeId => nextId("node", seed) as NodeId;

export const createEdgeId = (seed?: string): EdgeId => nextId("edge", seed) as EdgeId;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly min: Vec2;
  readonly max: Vec2;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const addVec2 = (left: Vec2, right: Vec2): Vec2 =>
  vec2(left.x + right.x, left.y + right.y);

export const subtractVec2 = (left: Vec2, right: Vec2): Vec2 =>
  vec2(left.x - right.x, left.y - right.y);

export const scaleVec2 = (input: Vec2, factor: number): Vec2 =>
  vec2(input.x * factor, input.y * factor);

export const boundsFromPoints = (points: readonly Vec2[]): Bounds => {
  const first = points[0];

  if (first === undefined) {
    return {
      min: vec2(0, 0),
      max: vec2(0, 0)
    };
  }

  const rest = points.slice(1);

  return rest.reduce<Bounds>(
    (current, point) => ({
      min: vec2(Math.min(current.min.x, point.x), Math.min(current.min.y, point.y)),
      max: vec2(Math.max(current.max.x, point.x), Math.max(current.max.y, point.y))
    }),
    { min: first, max: first }
  );
};

export interface GraphMetadata {
  readonly name: string;
  readonly version: string;
  readonly tags: readonly string[];
  readonly createdAtIso: string;
}

export type GraphInteractionPhase = "start" | "move" | "end" | "cancel";

export interface GraphInteractionEventPayload {
  readonly pointerId: string;
  readonly phase: GraphInteractionPhase;
  readonly position: Vec2;
  readonly timestampMs: number;
  readonly targetId?: NodeId | EdgeId;
}

export const DEFAULT_NODE_SIZE = vec2(160, 64);
export const DEFAULT_EDGE_WIDTH = 2;
export const DEFAULT_VIEWPORT_PADDING = 24;
