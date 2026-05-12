import type { EdgeId, NodeId } from "@kaiisuuwii/shared";

import { compareById } from "./model.js";
import type {
  CycleGroup,
  ExecutionBatch,
  GraphEdgeSnapshot,
  GraphSnapshot,
  NodeTypeDefinition,
  ValidationError,
  ValidationResult
} from "./types.js";

type ExecutionPlanError = ValidationError;

export interface ExecutionPlan {
  readonly nodeIds: readonly NodeId[];
  readonly nodeOrder: readonly NodeId[];
  readonly batches: readonly ExecutionBatch[];
  readonly incomingByNodeId: Readonly<Record<string, readonly EdgeId[]>>;
  readonly outgoingByNodeId: Readonly<Record<string, readonly EdgeId[]>>;
  readonly batchIndexByNodeId: Readonly<Record<string, number>>;
}

const createError = (
  code: string,
  message: string,
  entityId?: string,
  path?: string
): ExecutionPlanError => ({
  severity: "error",
  code,
  message,
  ...(entityId !== undefined ? { entityId } : {}),
  ...(path !== undefined ? { path } : {})
});

const createValidationResult = (
  errors: readonly ExecutionPlanError[]
): ValidationResult => ({
  isValid: errors.length === 0,
  errors,
  warnings: [],
  cycleSets: []
});

const uniqueSorted = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort();

const getRelevantNodeIds = (
  snapshot: GraphSnapshot,
  targetNodeIds?: readonly NodeId[]
): readonly NodeId[] => {
  if (targetNodeIds === undefined || targetNodeIds.length === 0) {
    return snapshot.nodes.map((node) => node.id);
  }

  const incomingByTarget = new Map<NodeId, NodeId[]>();

  snapshot.edges.forEach((edge) => {
    const existing = incomingByTarget.get(edge.target) ?? [];
    incomingByTarget.set(edge.target, [...existing, edge.source]);
  });

  const queue = [...targetNodeIds];
  const visited = new Set<NodeId>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const sourceNodeId of incomingByTarget.get(current) ?? []) {
      if (!visited.has(sourceNodeId)) {
        queue.push(sourceNodeId);
      }
    }
  }

  return uniqueSorted([...visited]);
};

export const buildExecutionPlan = (
  snapshot: GraphSnapshot,
  targetNodeIds?: readonly NodeId[]
): { readonly validation: ValidationResult; readonly plan?: ExecutionPlan } => {
  const relevantNodeIds = getRelevantNodeIds(snapshot, targetNodeIds);
  const relevantNodeIdSet = new Set(relevantNodeIds);
  const errors: ExecutionPlanError[] = [];

  targetNodeIds?.forEach((nodeId) => {
    if (!snapshot.nodes.some((node) => node.id === nodeId)) {
      errors.push(
        createError(
          "EXECUTION_TARGET_NODE_MISSING",
          `Execution target node "${nodeId}" does not exist`,
          nodeId
        )
      );
    }
  });

  if (errors.length > 0) {
    return {
      validation: createValidationResult(errors)
    };
  }

  const incomingEdges = new Map<NodeId, EdgeId[]>();
  const outgoingEdges = new Map<NodeId, EdgeId[]>();

  relevantNodeIds.forEach((nodeId) => {
    incomingEdges.set(nodeId, []);
    outgoingEdges.set(nodeId, []);
  });

  snapshot.edges
    .slice()
    .sort(compareById)
    .forEach((edge) => {
      if (!relevantNodeIdSet.has(edge.source) || !relevantNodeIdSet.has(edge.target)) {
        return;
      }

      incomingEdges.set(edge.target, [...(incomingEdges.get(edge.target) ?? []), edge.id].sort());
      outgoingEdges.set(edge.source, [...(outgoingEdges.get(edge.source) ?? []), edge.id].sort());
    });

  const indegree = new Map<NodeId, number>();

  relevantNodeIds.forEach((nodeId) => {
    indegree.set(nodeId, incomingEdges.get(nodeId)?.length ?? 0);
  });

  const edgeById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
  const processed: NodeId[] = [];
  const batches: ExecutionBatch[] = [];
  let ready = relevantNodeIds
    .filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0)
    .sort();
  let batchIndex = 0;

  while (ready.length > 0) {
    const currentBatch = [...ready].sort();

    batches.push({
      index: batchIndex,
      nodeIds: currentBatch
    });
    processed.push(...currentBatch);
    const nextReady = new Set<NodeId>();

    currentBatch.forEach((nodeId) => {
      for (const outgoingEdgeId of outgoingEdges.get(nodeId) ?? []) {
        const targetNodeId = edgeById.get(outgoingEdgeId)?.target;

        if (targetNodeId === undefined) {
          continue;
        }

        const nextIndegree = (indegree.get(targetNodeId) ?? 0) - 1;
        indegree.set(targetNodeId, nextIndegree);

        if (nextIndegree === 0) {
          nextReady.add(targetNodeId);
        }
      }
    });

    ready = [...nextReady].sort();
    batchIndex += 1;
  }

  if (processed.length !== relevantNodeIds.length) {
    const cyclicNodeIds = relevantNodeIds.filter((nodeId) => !processed.includes(nodeId));
    errors.push(
      createError(
        "EXECUTION_CYCLE_DETECTED",
        `Execution requires a DAG, but a cycle was detected involving ${cyclicNodeIds.join(", ")}`,
        cyclicNodeIds[0]
      )
    );
    return {
      validation: createValidationResult(errors)
    };
  }

  const batchIndexByNodeId = Object.fromEntries(
    batches.flatMap((batch) => batch.nodeIds.map((nodeId) => [nodeId, batch.index]))
  );

  snapshot.edges
    .slice()
    .sort(compareById)
    .forEach((edge, index) => {
      if (!relevantNodeIdSet.has(edge.source) || !relevantNodeIdSet.has(edge.target)) {
        return;
      }

      const sourceBatch = batchIndexByNodeId[edge.source];
      const targetBatch = batchIndexByNodeId[edge.target];

      if (sourceBatch === undefined || targetBatch === undefined || sourceBatch >= targetBatch) {
        errors.push(
          createError(
            "EXECUTION_ORDER_INVALID",
            `Edge "${edge.id}" violates the computed execution order`,
            edge.id,
            `edges[${index}]`
          )
        );
      }
    });

  if (errors.length > 0) {
    return {
      validation: createValidationResult(errors)
    };
  }

  return {
    validation: createValidationResult([]),
    plan: {
      nodeIds: relevantNodeIds,
      nodeOrder: processed,
      batches,
      incomingByNodeId: Object.fromEntries(
        relevantNodeIds.map((nodeId) => [nodeId, incomingEdges.get(nodeId) ?? []])
      ),
      outgoingByNodeId: Object.fromEntries(
        relevantNodeIds.map((nodeId) => [nodeId, outgoingEdges.get(nodeId) ?? []])
      ),
      batchIndexByNodeId
    }
  };
};

export const validateExecutionPlan = (
  snapshot: GraphSnapshot,
  nodeTypes: ReadonlyMap<string, NodeTypeDefinition>,
  targetNodeIds?: readonly NodeId[]
): ValidationResult => {
  const base = buildExecutionPlan(snapshot, targetNodeIds);

  if (!base.validation.isValid || base.plan === undefined) {
    return base.validation;
  }

  const plan = base.plan;

  const errors: ExecutionPlanError[] = [];
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));

  plan.nodeOrder.forEach((nodeId) => {
    const node = nodeById.get(nodeId);

    if (node === undefined) {
      return;
    }

    const definition = nodeTypes.get(node.type);

    if (definition === undefined) {
      errors.push(
        createError(
          "EXECUTION_NODE_TYPE_UNREGISTERED",
          `Node "${node.id}" uses unregistered type "${node.type}"`,
          node.id
        )
      );
      return;
    }

    if (definition.execution === undefined) {
      errors.push(
        createError(
          "EXECUTION_HANDLER_MISSING",
          `Node "${node.id}" does not define an execution handler`,
          node.id
        )
      );
      return;
    }

    const requiredInputs = uniqueSorted(definition.execution.requiredInputs ?? []);

    requiredInputs.forEach((portId) => {
      const hasIncoming = (plan.incomingByNodeId[nodeId] ?? []).some((edgeId) => {
        const edge = edgeById.get(edgeId);

        return edge?.targetPortId === portId;
      });

      if (!hasIncoming) {
        errors.push(
          createError(
            "EXECUTION_INPUT_MISSING",
            `Node "${node.id}" is missing required input "${portId}"`,
            node.id
          )
        );
      }
    });
  });

  return createValidationResult(errors);
};

const iterativeDfsFinish = (
  start: NodeId,
  adj: Map<NodeId, readonly NodeId[]>,
  visited: Set<NodeId>,
  order: NodeId[]
): void => {
  const stack: Array<{ nodeId: NodeId; childIndex: number }> = [{ nodeId: start, childIndex: 0 }];
  visited.add(start);

  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    const children = adj.get(top.nodeId) ?? [];

    if (top.childIndex < children.length) {
      const child = children[top.childIndex++]!;

      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ nodeId: child, childIndex: 0 });
      }
    } else {
      order.push(top.nodeId);
      stack.pop();
    }
  }
};

const iterativeDfsCollect = (
  start: NodeId,
  adj: Map<NodeId, readonly NodeId[]>,
  visited: Set<NodeId>,
  component: NodeId[]
): void => {
  const stack: NodeId[] = [start];
  visited.add(start);

  while (stack.length > 0) {
    const current = stack.pop()!;
    component.push(current);

    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
};

export const findStronglyConnectedComponents = (
  nodes: readonly NodeId[],
  edges: readonly GraphEdgeSnapshot[],
  allowSelfLoops = false
): readonly CycleGroup[] => {
  const nodeSet = new Set(nodes);
  const adj = new Map<NodeId, NodeId[]>();
  const radj = new Map<NodeId, NodeId[]>();

  for (const n of nodes) {
    adj.set(n, []);
    radj.set(n, []);
  }

  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) {
      continue;
    }

    adj.get(edge.source)!.push(edge.target);
    radj.get(edge.target)!.push(edge.source);
  }

  const visited = new Set<NodeId>();
  const finishOrder: NodeId[] = [];

  for (const n of nodes) {
    if (!visited.has(n)) {
      iterativeDfsFinish(n, adj, visited, finishOrder);
    }
  }

  const visited2 = new Set<NodeId>();
  const result: CycleGroup[] = [];

  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const n = finishOrder[i]!;

    if (!visited2.has(n)) {
      const component: NodeId[] = [];
      iterativeDfsCollect(n, radj, visited2, component);

      const componentSet = new Set(component);
      const hasSelfLoop = edges.some((e) => e.source === e.target && componentSet.has(e.source));

      if (component.length > 1 || (component.length === 1 && hasSelfLoop && allowSelfLoops)) {
        const entryEdgeIds = edges
          .filter((e) => nodeSet.has(e.source) && !componentSet.has(e.source) && componentSet.has(e.target))
          .map((e) => e.id)
          .sort();
        const exitEdgeIds = edges
          .filter((e) => componentSet.has(e.source) && nodeSet.has(e.target) && !componentSet.has(e.target))
          .map((e) => e.id)
          .sort();

        result.push({
          nodeIds: ([...component] as NodeId[]).sort(),
          entryEdgeIds,
          exitEdgeIds
        });
      }
    }
  }

  return result;
};

export const condenseSCCs = (
  sccGroups: readonly CycleGroup[],
  edges: readonly GraphEdgeSnapshot[]
): Map<number, number[]> => {
  const nodeToScc = new Map<NodeId, number>();

  sccGroups.forEach((group, i) => {
    for (const nodeId of group.nodeIds) {
      nodeToScc.set(nodeId, i);
    }
  });

  const condensation = new Map<number, number[]>();

  for (let i = 0; i < sccGroups.length; i++) {
    condensation.set(i, []);
  }

  for (const edge of edges) {
    const srcScc = nodeToScc.get(edge.source);
    const tgtScc = nodeToScc.get(edge.target);

    if (srcScc !== undefined && tgtScc !== undefined && srcScc !== tgtScc) {
      const existing = condensation.get(srcScc) ?? [];

      if (!existing.includes(tgtScc)) {
        condensation.set(srcScc, [...existing, tgtScc]);
      }
    }
  }

  return condensation;
};
