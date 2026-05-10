import type { EdgeId, NodeId } from "@kaiisuuwii/shared";

import { compareById } from "./model.js";
import type {
  ExecutionBatch,
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
  warnings: []
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
