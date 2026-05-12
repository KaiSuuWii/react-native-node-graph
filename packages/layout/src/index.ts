import { runLayeredLayout } from "./layered.js";
import { createIncrementalForceLayout, runForceDirectedLayout } from "./force-directed.js";
import { runTreeLayout } from "./tree.js";
import { runRadialLayout } from "./radial.js";
import {
  LayoutError,
  type ForceDirectedLayoutOptions,
  type IncrementalLayoutEngine,
  type LayoutGraphInput,
  type LayoutOptions,
  type LayoutResult
} from "./types.js";

export const applyLayout = (
  input: LayoutGraphInput,
  options: LayoutOptions
): LayoutResult => {
  switch (options.algorithm) {
    case "layered":
      return runLayeredLayout(input, options);
    case "force-directed":
      return runForceDirectedLayout(input, options);
    case "tree":
      return runTreeLayout(input, options);
    case "radial":
      return runRadialLayout(input, options);
    default: {
      const _exhaustive: never = options;
      throw new LayoutError(`Unknown layout algorithm: ${String((_exhaustive as LayoutOptions).algorithm)}`);
    }
  }
};

export const createIncrementalLayout = (
  input: LayoutGraphInput,
  options: ForceDirectedLayoutOptions
): IncrementalLayoutEngine => createIncrementalForceLayout(input, options);

export {
  applyResultToEngine,
  buildAdjacency,
  centerPositions,
  detectRoots,
  graphInputFromSnapshot
} from "./utils.js";
export { runLayeredLayout } from "./layered.js";
export { runForceDirectedLayout, createIncrementalForceLayout } from "./force-directed.js";
export { runTreeLayout } from "./tree.js";
export { runRadialLayout } from "./radial.js";
export { LayoutError } from "./types.js";
export type {
  EdgeRoutingStyle,
  ForceDirectedLayoutOptions,
  IncrementalLayoutEngine,
  LayeredLayoutOptions,
  LayoutAlgorithm,
  LayoutDirection,
  LayoutEdgeInput,
  LayoutEngineState,
  LayoutGraphInput,
  LayoutNodeInput,
  LayoutNodeResult,
  LayoutOptions,
  LayoutResult,
  RadialLayoutOptions,
  TreeLayoutOptions
} from "./types.js";
