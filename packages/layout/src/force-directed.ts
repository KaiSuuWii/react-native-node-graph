import { performance } from "node:perf_hooks";
import { vec2, type Vec2 } from "@kaiisuuwii/shared";
import type {
  ForceDirectedLayoutOptions,
  IncrementalLayoutEngine,
  LayoutEngineState,
  LayoutGraphInput,
  LayoutResult
} from "./types.js";

const vLen = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);
const vNorm = (v: Vec2): Vec2 => {
  const len = Math.max(vLen(v), 0.0001);
  return vec2(v.x / len, v.y / len);
};

const initPositions = (
  nodes: LayoutGraphInput["nodes"],
  options: ForceDirectedLayoutOptions
): Map<string, Vec2> => {
  const positions = new Map<string, Vec2>();
  const radius = Math.sqrt(nodes.length) * options.idealEdgeLength * 0.5;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node === undefined) continue;

    if (node.initialPosition !== undefined) {
      positions.set(node.id, node.initialPosition);
    } else {
      const angle = (2 * Math.PI * i) / nodes.length;
      positions.set(node.id, vec2(radius * Math.cos(angle), radius * Math.sin(angle)));
    }
  }
  return positions;
};

const runIteration = (
  nodes: LayoutGraphInput["nodes"],
  edges: LayoutGraphInput["edges"],
  positions: Map<string, Vec2>,
  velocities: Map<string, Vec2>,
  temperature: number,
  options: ForceDirectedLayoutOptions
): { maxDisplacement: number; newTemperature: number } => {
  const forces = new Map<string, Vec2>(nodes.map((n) => [n.id, vec2(0, 0)]));
  const nodeIds = nodes.map((n) => n.id);

  // Repulsion between every pair
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const idA = nodeIds[i];
      const idB = nodeIds[j];
      if (idA === undefined || idB === undefined) continue;

      const posA = positions.get(idA) ?? vec2(0, 0);
      const posB = positions.get(idB) ?? vec2(0, 0);
      const delta = vec2(posB.x - posA.x, posB.y - posA.y);
      const dist = Math.max(vLen(delta), 1);
      const repulsion = options.repulsionStrength / (dist * dist);
      const dir = vNorm(delta);

      const fA = forces.get(idA) ?? vec2(0, 0);
      const fB = forces.get(idB) ?? vec2(0, 0);
      forces.set(idA, vec2(fA.x - repulsion * dir.x, fA.y - repulsion * dir.y));
      forces.set(idB, vec2(fB.x + repulsion * dir.x, fB.y + repulsion * dir.y));
    }
  }

  // Attraction along edges
  for (const edge of edges) {
    const posA = positions.get(edge.sourceNodeId) ?? vec2(0, 0);
    const posB = positions.get(edge.targetNodeId) ?? vec2(0, 0);
    const delta = vec2(posB.x - posA.x, posB.y - posA.y);
    const dist = vLen(delta);
    if (dist < 0.0001) continue;
    const attraction = options.attractionStrength * (dist - options.idealEdgeLength);
    const dir = vNorm(delta);

    const fA = forces.get(edge.sourceNodeId) ?? vec2(0, 0);
    const fB = forces.get(edge.targetNodeId) ?? vec2(0, 0);
    forces.set(edge.sourceNodeId, vec2(fA.x + attraction * dir.x, fA.y + attraction * dir.y));
    forces.set(edge.targetNodeId, vec2(fB.x - attraction * dir.x, fB.y - attraction * dir.y));
  }

  // Apply forces and gravity
  let maxDisp = 0;
  for (const node of nodes) {
    if (node.fixed === true) continue;

    const pos = positions.get(node.id) ?? vec2(0, 0);
    const vel = velocities.get(node.id) ?? vec2(0, 0);
    const f = forces.get(node.id) ?? vec2(0, 0);

    // Gravity toward origin
    const gravForce = vec2(-options.gravity * pos.x, -options.gravity * pos.y);

    const totalF = vec2(f.x + gravForce.x, f.y + gravForce.y);
    const disp = vec2(vel.x + totalF.x, vel.y + totalF.y);
    const dispLen = vLen(disp);
    const cappedLen = Math.min(dispLen, temperature);

    const cappedDisp =
      dispLen < 0.0001
        ? vec2(0, 0)
        : vec2((disp.x / dispLen) * cappedLen, (disp.y / dispLen) * cappedLen);

    positions.set(node.id, vec2(pos.x + cappedDisp.x, pos.y + cappedDisp.y));
    velocities.set(node.id, vec2(disp.x * 0.8, disp.y * 0.8));

    if (cappedLen > maxDisp) maxDisp = cappedLen;
  }

  return { maxDisplacement: maxDisp, newTemperature: temperature * options.cooling };
};

const buildResult = (
  nodes: LayoutGraphInput["nodes"],
  positions: Map<string, Vec2>,
  algorithm: "force-directed",
  iterationsRun: number,
  converged: boolean,
  durationMs: number
): LayoutResult => ({
  positions: nodes
    .map((n) => {
      const pos = positions.get(n.id);
      return pos !== undefined ? { id: n.id, position: pos } : undefined;
    })
    .filter((r): r is { id: string; position: Vec2 } => r !== undefined),
  algorithm,
  iterationsRun,
  converged,
  durationMs
});

export const runForceDirectedLayout = (
  input: LayoutGraphInput,
  options: ForceDirectedLayoutOptions
): LayoutResult => {
  const start = performance.now();

  if (input.nodes.length === 0) {
    return { positions: [], algorithm: "force-directed", durationMs: performance.now() - start };
  }

  const positions = initPositions(input.nodes, options);
  const velocities = new Map<string, Vec2>(input.nodes.map((n) => [n.id, vec2(0, 0)]));
  let temperature = options.initialTemperature;
  let iteration = 0;
  let converged = false;

  while (iteration < options.iterations) {
    const { maxDisplacement, newTemperature } = runIteration(
      input.nodes,
      input.edges,
      positions,
      velocities,
      temperature,
      options
    );
    temperature = newTemperature;
    iteration += 1;

    if (maxDisplacement < options.convergenceThreshold) {
      converged = true;
      break;
    }
  }

  return buildResult(
    input.nodes,
    positions,
    "force-directed",
    iteration,
    converged,
    performance.now() - start
  );
};

class IncrementalForceLayout implements IncrementalLayoutEngine {
  private readonly input: LayoutGraphInput;
  private readonly options: ForceDirectedLayoutOptions;
  private positions: Map<string, Vec2>;
  private velocities: Map<string, Vec2>;
  private temperature: number;
  private iteration: number;
  private converged: boolean;

  constructor(input: LayoutGraphInput, options: ForceDirectedLayoutOptions) {
    this.input = input;
    this.options = options;
    this.positions = initPositions(input.nodes, options);
    this.velocities = new Map<string, Vec2>(input.nodes.map((n) => [n.id, vec2(0, 0)]));
    this.temperature = options.initialTemperature;
    this.iteration = 0;
    this.converged = false;
  }

  step(): LayoutResult {
    const start = performance.now();
    if (this.converged || this.iteration >= this.options.iterations) {
      return buildResult(
        this.input.nodes,
        this.positions,
        "force-directed",
        this.iteration,
        this.converged,
        performance.now() - start
      );
    }

    const { maxDisplacement, newTemperature } = runIteration(
      this.input.nodes,
      this.input.edges,
      this.positions,
      this.velocities,
      this.temperature,
      this.options
    );
    this.temperature = newTemperature;
    this.iteration += 1;

    if (maxDisplacement < this.options.convergenceThreshold) {
      this.converged = true;
    }

    return buildResult(
      this.input.nodes,
      this.positions,
      "force-directed",
      this.iteration,
      this.converged,
      performance.now() - start
    );
  }

  run(): LayoutResult {
    while (!this.converged && this.iteration < this.options.iterations) {
      this.step();
    }
    return this.step();
  }

  getState(): LayoutEngineState {
    return {
      positions: new Map(this.positions),
      velocities: new Map(this.velocities),
      temperature: this.temperature,
      iteration: this.iteration
    };
  }

  setPositions(positions: Map<string, Vec2>): void {
    for (const [id, pos] of positions) {
      this.positions.set(id, pos);
    }
    this.velocities = new Map<string, Vec2>(this.input.nodes.map((n) => [n.id, vec2(0, 0)]));
    this.temperature = this.options.initialTemperature;
    this.iteration = 0;
    this.converged = false;
  }
}

export const createIncrementalForceLayout = (
  input: LayoutGraphInput,
  options: ForceDirectedLayoutOptions
): IncrementalLayoutEngine => new IncrementalForceLayout(input, options);
