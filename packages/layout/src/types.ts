import type { Vec2 } from "@kaiisuuwii/shared";

export type LayoutAlgorithm = "layered" | "force-directed" | "tree" | "radial";
export type LayoutDirection = "top-bottom" | "bottom-top" | "left-right" | "right-left";
export type EdgeRoutingStyle = "curved" | "orthogonal" | "straight";

export interface LayoutNodeInput {
  readonly id: string;
  readonly size: Vec2;
  readonly fixed?: boolean;
  readonly initialPosition?: Vec2;
}

export interface LayoutEdgeInput {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
}

export interface LayoutGraphInput {
  readonly nodes: readonly LayoutNodeInput[];
  readonly edges: readonly LayoutEdgeInput[];
}

export interface LayoutNodeResult {
  readonly id: string;
  readonly position: Vec2;
}

export interface LayoutResult {
  readonly positions: readonly LayoutNodeResult[];
  readonly algorithm: LayoutAlgorithm;
  readonly iterationsRun?: number;
  readonly converged?: boolean;
  readonly durationMs: number;
}

export interface LayeredLayoutOptions {
  readonly algorithm: "layered";
  readonly direction: LayoutDirection;
  readonly nodePaddingX: number;
  readonly nodePaddingY: number;
  readonly rankSeparation: number;
  readonly edgeRouting: EdgeRoutingStyle;
  readonly centerGraph: boolean;
}

export interface ForceDirectedLayoutOptions {
  readonly algorithm: "force-directed";
  readonly iterations: number;
  readonly convergenceThreshold: number;
  readonly repulsionStrength: number;
  readonly attractionStrength: number;
  readonly idealEdgeLength: number;
  readonly gravity: number;
  readonly cooling: number;
  readonly initialTemperature: number;
  readonly edgeRouting: EdgeRoutingStyle;
}

export interface TreeLayoutOptions {
  readonly algorithm: "tree";
  readonly direction: LayoutDirection;
  readonly nodePaddingX: number;
  readonly nodePaddingY: number;
  readonly rootNodeId?: string;
  readonly edgeRouting: EdgeRoutingStyle;
  readonly centerSubtrees: boolean;
}

export interface RadialLayoutOptions {
  readonly algorithm: "radial";
  readonly centerNodeId?: string;
  readonly radiusStep: number;
  readonly startAngle: number;
  readonly edgeRouting: EdgeRoutingStyle;
}

export type LayoutOptions =
  | LayeredLayoutOptions
  | ForceDirectedLayoutOptions
  | TreeLayoutOptions
  | RadialLayoutOptions;

export interface LayoutEngineState {
  readonly positions: Map<string, Vec2>;
  readonly velocities: Map<string, Vec2>;
  readonly temperature: number;
  readonly iteration: number;
}

export interface IncrementalLayoutEngine {
  step(): LayoutResult;
  run(): LayoutResult;
  getState(): LayoutEngineState;
  setPositions(positions: Map<string, Vec2>): void;
}

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutError";
  }
}
