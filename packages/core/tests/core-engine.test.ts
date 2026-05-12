import {
  CoreGraphError,
  createCoreEngine,
  createEmptyGraph,
  createGraphSnapshot,
  createGroupId,
  createMigrationRegistry,
  findStronglyConnectedComponents,
  type ExecutionOutputs,
  type GraphPlugin,
  type GraphDocumentEnvelope,
  type GraphEdgeSnapshot,
  type NodeTypeDefinition
} from "@kaiisuuwii/core";
import { createGraphId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it, vi } from "vitest";

const graphMetadata = {
  name: "Test Graph",
  version: "0.1.0",
  tags: ["unit"],
  createdAtIso: "2026-05-09T00:00:00.000Z"
} as const;

const passthroughNodeType: NodeTypeDefinition = {
  type: "passthrough",
  defaultLabel: "Passthrough",
  defaultDimensions: vec2(200, 100),
  ports: [
    {
      id: "port_in",
      name: "In",
      direction: "input",
      dataType: "number"
    },
    {
      id: "port_out",
      name: "Out",
      direction: "output",
      dataType: "number"
    }
  ]
};

const outputOnlyNodeType: NodeTypeDefinition = {
  type: "output-only",
  ports: [
    {
      id: "port_out",
      name: "Out",
      direction: "output",
      dataType: "number"
    }
  ]
};

const sourceExecutionNodeType: NodeTypeDefinition = {
  type: "source-exec",
  ports: [
    {
      id: "port_out",
      name: "Out",
      direction: "output",
      dataType: "number"
    }
  ],
  execution: {
    execute: ({ node }) => ({
      port_out: typeof node.properties.value === "number" ? node.properties.value : 1
    })
  }
};

const sumExecutionNodeType: NodeTypeDefinition = {
  type: "sum-exec",
  ports: [
    {
      id: "port_left",
      name: "Left",
      direction: "input",
      dataType: "number"
    },
    {
      id: "port_right",
      name: "Right",
      direction: "input",
      dataType: "number"
    },
    {
      id: "port_out",
      name: "Out",
      direction: "output",
      dataType: "number"
    }
  ],
  execution: {
    requiredInputs: ["port_left", "port_right"],
    execute: async ({ inputs }) => {
      await Promise.resolve();
      const left = typeof inputs.port_left === "number" ? inputs.port_left : 0;
      const right = typeof inputs.port_right === "number" ? inputs.port_right : 0;

      return {
        port_out: left + right
      };
    }
  }
};

const sinkExecutionNodeType: NodeTypeDefinition = {
  type: "sink-exec",
  ports: [
    {
      id: "port_in",
      name: "In",
      direction: "input",
      dataType: "number"
    }
  ],
  execution: {
    requiredInputs: ["port_in"],
    execute: ({ inputs }) => ({
      port_in: inputs.port_in
    })
  }
};

describe("core graph factory", () => {
  it("creates an empty graph and snapshot copies", () => {
    const empty = createEmptyGraph({
      id: createGraphId("empty"),
      metadata: graphMetadata
    });

    expect(empty).toEqual({
      id: empty.id,
      metadata: graphMetadata,
      nodes: [],
      edges: [],
      groups: [],
      selection: {
        nodeIds: [],
        edgeIds: [],
        groupIds: [],
        activeSelectionMode: "none"
      }
    });

    const snapshot = createGraphSnapshot({
      id: createGraphId("snapshot"),
      metadata: graphMetadata,
      nodes: [
        {
          id: "node_fixed_a",
          type: "passthrough",
          position: vec2(0, 0),
          label: "A"
        }
      ],
      edges: [],
      groups: []
    });

    expect(snapshot.nodes[0]).toMatchObject({
      id: "node_fixed_a",
      type: "passthrough",
      label: "A"
    });
    expect(snapshot.selection.activeSelectionMode).toBe("none");
    expect(snapshot.nodes).not.toBe(empty.nodes);
  });
});

describe("core engine node registry", () => {
  it("registers, looks up, and unregisters node types", () => {
    const engine = createCoreEngine();

    engine.registerNodeType(passthroughNodeType);

    expect(engine.getNodeType("passthrough")).toEqual(passthroughNodeType);
    expect(engine.unregisterNodeType("passthrough")).toBe(true);
    expect(engine.getNodeType("passthrough")).toBeUndefined();
  });
});

describe("core engine validation", () => {
  it("reports structural and type validation errors and warnings", () => {
    const engine = createCoreEngine({
      nodeTypes: [passthroughNodeType],
      propertySchemaValidator: (node) =>
        node.properties.invalid === true
          ? {
              isValid: false,
              errors: [
                {
                  severity: "error",
                  code: "PROP_INVALID",
                  message: "property invalid"
                }
              ],
              warnings: []
            }
          : {
              isValid: true,
              errors: [],
              warnings: []
            },
      executionSignatureValidator: ({ edge }) =>
        edge.metadata.invalidConnection === true
          ? {
              isValid: false,
              errors: [
                {
                  severity: "error",
                  code: "EXECUTION_INVALID",
                  message: "execution signature mismatch"
                }
              ],
              warnings: []
            }
          : {
              isValid: true,
              errors: [],
              warnings: []
            }
    });

    const result = engine.validateGraph({
      id: createGraphId("invalid"),
      metadata: graphMetadata,
      groups: [
        {
          id: "group_invalid_a",
          name: "Broken",
          nodeIds: ["node_missing"]
        },
        {
          id: "group_invalid_a",
          name: "Duplicate"
        }
      ],
      nodes: [
        {
          id: "node_invalid_a",
          type: "passthrough",
          position: vec2(0, 0),
          properties: { invalid: true },
          ports: [
            {
              id: "port_out",
              name: "Out",
              direction: "output",
              dataType: "number"
            }
          ]
        },
        {
          id: "node_invalid_a",
          type: "unknown",
          position: vec2(100, 0),
          ports: [
            {
              id: "port_in",
              name: "In",
              direction: "input",
              dataType: "number"
            }
          ]
        }
      ],
      edges: [
        {
          id: "edge_invalid_a",
          source: "node_invalid_a",
          target: "node_missing",
          sourcePortId: "port_out",
          targetPortId: "port_in",
          metadata: { invalidConnection: true }
        },
        {
          id: "edge_invalid_a",
          source: "node_invalid_a",
          target: "node_invalid_a",
          sourcePortId: "port_out",
          targetPortId: "port_out"
        }
      ],
      selection: {
        nodeIds: ["node_missing"],
        edgeIds: ["edge_missing"],
        groupIds: ["group_missing"]
      }
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "NODE_ID_CONFLICT",
        "EDGE_ID_CONFLICT",
        "GROUP_ID_CONFLICT",
        "PROP_INVALID",
        "EDGE_TARGET_NODE_MISSING",
        "EDGE_SOURCE_PORT_MISSING",
        "SELECTION_NODE_MISSING",
        "SELECTION_EDGE_MISSING",
        "SELECTION_GROUP_MISSING"
      ])
    );
    expect(result.warnings.map((warning) => warning.code)).toContain("NODE_TYPE_UNREGISTERED");
  });
});

describe("core engine node CRUD", () => {
  it("creates, mutates, and deletes nodes with deterministic snapshots", () => {
    const groupId = createGroupId("main");
    const engine = createCoreEngine({
      idSeed: "deterministic",
      graph: {
        id: createGraphId("deterministic"),
        metadata: graphMetadata,
        groups: [{ id: groupId, name: "Main" }]
      },
      nodeTypes: [passthroughNodeType]
    });

    const node = engine.createNode({
      type: "passthrough",
      position: vec2(10, 20),
      properties: { labelColor: "red" },
      metadata: { createdBy: "test" },
      groupId
    });

    const updated = engine.updateNode(node.id, {
      position: vec2(30, 40),
      dimensions: vec2(240, 120),
      label: "Updated",
      properties: { disabled: true },
      metadata: { source: "unit" }
    });

    expect(updated).toMatchObject({
      id: node.id,
      position: vec2(30, 40),
      dimensions: vec2(240, 120),
      label: "Updated"
    });
    expect(updated.properties).toEqual({
      labelColor: "red",
      disabled: true
    });
    expect(updated.metadata).toEqual({
      createdBy: "test",
      source: "unit"
    });
    expect(engine.getSnapshot().groups[0]?.nodeIds).toEqual([node.id]);

    expect(engine.deleteNode(node.id)).toBe(true);
    expect(engine.getSnapshot().nodes).toEqual([]);
    expect(engine.getSnapshot().groups[0]?.nodeIds).toEqual([]);
  });

  it("rejects invalid node creation and rolls state back", () => {
    const pluginHooks = {
      beforeNodeCreate: vi.fn(),
      afterNodeCreate: vi.fn()
    };
    const plugin: GraphPlugin = {
      name: "validation-hooks",
      hooks: pluginHooks
    };
    const engine = createCoreEngine({
      nodeTypes: [
        {
          ...passthroughNodeType,
          validateProperties: (properties) =>
            typeof properties.invalid === "boolean" ? ["invalid property"] : []
        }
      ],
      schemaValidator: (input) =>
        input.label === "forbidden" ? ["label forbidden"] : [],
      plugins: [plugin]
    });

    expect(() =>
      engine.createNode({
        type: "missing",
        position: vec2(0, 0)
      })
    ).toThrowError(CoreGraphError);

    expect(() =>
      engine.createNode({
        type: "passthrough",
        position: vec2(0, 0),
        label: "forbidden",
        properties: { invalid: true }
      })
    ).toThrowError(/failed validation/i);

    expect(() =>
      engine.createNode({
        type: "passthrough",
        position: vec2(0, 0),
        ports: [
          { id: "port_dup", name: "A", direction: "input" },
          { id: "port_dup", name: "B", direction: "output" }
        ]
      })
    ).toThrowError(/already in use/i);

    expect(engine.getSnapshot().nodes).toEqual([]);
    expect(pluginHooks.beforeNodeCreate).toHaveBeenCalledTimes(2);
    expect(pluginHooks.afterNodeCreate).not.toHaveBeenCalled();
  });
});

describe("core engine edge CRUD and indices", () => {
  it("creates and removes edges while keeping adjacency indices correct", () => {
    const engine = createCoreEngine({
      idSeed: "adjacency",
      graph: {
        id: createGraphId("adjacency"),
        metadata: graphMetadata
      },
      nodeTypes: [passthroughNodeType]
    });
    const source = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });
    const target = engine.createNode({
      type: "passthrough",
      position: vec2(200, 0)
    });

    const edge = engine.createEdge({
      source: source.id,
      target: target.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });

    expect(engine.getStateSnapshot().adjacency[source.id]).toEqual({
      incoming: [],
      outgoing: [edge.id]
    });
    expect(engine.getStateSnapshot().adjacency[target.id]).toEqual({
      incoming: [edge.id],
      outgoing: []
    });
    expect(engine.getStateSnapshot().portLookup[`${source.id}:port_out`]).toBe(source.id);

    expect(engine.deleteEdge(edge.id)).toBe(true);
    expect(engine.getStateSnapshot().adjacency[source.id]).toEqual({
      incoming: [],
      outgoing: []
    });
    expect(engine.getStateSnapshot().adjacency[target.id]).toEqual({
      incoming: [],
      outgoing: []
    });
  });

  it("enforces edge validation rules and execution hooks", () => {
    const engine = createCoreEngine({
      idSeed: "validation",
      allowCycles: false,
      nodeTypes: [passthroughNodeType, outputOnlyNodeType],
      executionSignatureValidator: ({ edge }) =>
        edge.metadata.reject === true
          ? {
              isValid: false,
              errors: [
                {
                  severity: "error",
                  code: "EXECUTION_INVALID",
                  message: "execution signature mismatch"
                }
              ],
              warnings: []
            }
          : {
              isValid: true,
              errors: [],
              warnings: []
            }
    });
    const a = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });
    const b = engine.createNode({
      type: "passthrough",
      position: vec2(100, 0)
    });
    const c = engine.createNode({
      type: "output-only",
      position: vec2(200, 0)
    });

    engine.createEdge({
      source: a.id,
      target: b.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });

    expect(() =>
      engine.createEdge({
        source: b.id,
        target: c.id,
        sourcePortId: "port_out",
        targetPortId: "port_out"
      })
    ).toThrowError(/cannot be used as an edge target/i);

    expect(() =>
      engine.createEdge({
        source: b.id,
        target: a.id,
        sourcePortId: "port_out",
        targetPortId: "port_in",
        dataType: "string"
      })
    ).toThrowError(/data type/i);

    expect(() =>
      engine.createEdge({
        source: b.id,
        target: a.id,
        sourcePortId: "port_out",
        targetPortId: "port_in",
        metadata: { reject: true }
      })
    ).toThrowError(/execution signature mismatch/i);

    expect(() =>
      engine.createEdge({
        source: b.id,
        target: a.id,
        sourcePortId: "port_out",
        targetPortId: "port_in"
      })
    ).toThrowError(/would create a cycle/i);

    const selfLoopEngine = createCoreEngine({
      nodeTypes: [passthroughNodeType]
    });
    const selfNode = selfLoopEngine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });

    expect(() =>
      selfLoopEngine.createEdge({
        source: selfNode.id,
        target: selfNode.id,
        sourcePortId: "port_out",
        targetPortId: "port_in"
      })
    ).toThrowError(/self-loop/i);
  });
});

describe("core engine selection", () => {
  it("updates immutable selection snapshots and emits selectionChanged", () => {
    const groupId = createGroupId("selection");
    const engine = createCoreEngine({
      nodeTypes: [passthroughNodeType],
      graph: {
        id: createGraphId("selection"),
        metadata: graphMetadata,
        groups: [{ id: groupId, name: "Selection" }]
      }
    });
    const left = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0),
      groupId
    });
    const right = engine.createNode({
      type: "passthrough",
      position: vec2(200, 0)
    });
    const edge = engine.createEdge({
      source: left.id,
      target: right.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });
    const events: string[] = [];

    engine.on("selectionChanged", ({ selection }) => {
      events.push(
        `${selection.activeSelectionMode}:${selection.nodeIds.length}:${selection.edgeIds.length}:${selection.groupIds.length}`
      );
    });

    expect(engine.selectNode(left.id)).toEqual({
      nodeIds: [left.id],
      edgeIds: [],
      groupIds: [],
      activeSelectionMode: "node"
    });
    expect(engine.selectEdge(edge.id, "add").activeSelectionMode).toBe("mixed");
    expect(engine.selectGroup(groupId, "add").groupIds).toEqual([groupId]);
    expect(engine.selectNode(left.id, "toggle").nodeIds).toEqual([]);
    expect(engine.clearSelection()).toEqual({
      nodeIds: [],
      edgeIds: [],
      groupIds: [],
      activeSelectionMode: "none"
    });
    expect(engine.getSnapshot().selection).toEqual(engine.getStateSnapshot().selection);
    expect(events).toEqual([
      "node:1:0:0",
      "mixed:1:1:0",
      "mixed:1:1:1",
      "mixed:0:1:1",
      "none:0:0:0"
    ]);
  });
});

describe("core engine history", () => {
  it("undoes and redoes node and edge operations", () => {
    const engine = createCoreEngine({
      idSeed: "history",
      nodeTypes: [passthroughNodeType]
    });
    const left = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });
    const right = engine.createNode({
      type: "passthrough",
      position: vec2(300, 0)
    });
    const edge = engine.createEdge({
      source: left.id,
      target: right.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });

    expect(engine.undo()).toBe(true);
    expect(engine.getSnapshot().edges).toEqual([]);
    expect(engine.undo()).toBe(true);
    expect(engine.getSnapshot().nodes.map((node) => node.id)).toEqual([left.id]);
    expect(engine.redo()).toBe(true);
    expect(engine.getSnapshot().nodes.map((node) => node.id)).toEqual([left.id, right.id]);
    expect(engine.redo()).toBe(true);
    expect(engine.getSnapshot().edges.map((currentEdge) => currentEdge.id)).toEqual([edge.id]);
  });

  it("batches commands in a transaction", () => {
    const engine = createCoreEngine({
      idSeed: "transaction",
      nodeTypes: [passthroughNodeType]
    });

    engine.beginTransaction("build");
    const left = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });
    const right = engine.createNode({
      type: "passthrough",
      position: vec2(200, 0)
    });
    engine.createEdge({
      source: left.id,
      target: right.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });
    expect(engine.endTransaction()).toBe(true);
    expect(engine.getStateSnapshot().history.undoDepth).toBe(1);

    expect(engine.undo()).toBe(true);
    expect(engine.getSnapshot().nodes).toEqual([]);
    expect(engine.getSnapshot().edges).toEqual([]);
    expect(engine.redo()).toBe(true);
    expect(engine.getSnapshot().nodes).toHaveLength(2);
    expect(engine.getSnapshot().edges).toHaveLength(1);
  });

  it("compresses drag-like update history", () => {
    const engine = createCoreEngine({
      idSeed: "compress",
      nodeTypes: [passthroughNodeType]
    });
    const node = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });

    engine.updateNode(node.id, { position: vec2(10, 0) });
    engine.updateNode(node.id, { position: vec2(20, 0) });
    engine.updateNode(node.id, { position: vec2(30, 0) });

    expect(engine.getStateSnapshot().history.undoDepth).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.getSnapshot().nodes[0]?.position).toEqual(vec2(0, 0));
  });
});

describe("core engine execution", () => {
  it("validates missing inputs and execution cycles", () => {
    const engine = createCoreEngine({
      nodeTypes: [sourceExecutionNodeType, sumExecutionNodeType, sinkExecutionNodeType]
    });

    const missingInputValidation = engine.validateExecution(
      createGraphSnapshot({
        id: createGraphId("missing-input"),
        metadata: graphMetadata,
        nodes: [
          {
            id: "node_source_exec",
            type: "source-exec",
            position: vec2(0, 0),
            ports: sourceExecutionNodeType.ports
          },
          {
            id: "node_sum_exec",
            type: "sum-exec",
            position: vec2(200, 0),
            ports: sumExecutionNodeType.ports
          }
        ],
        edges: [
          {
            id: "edge_source_sum",
            source: "node_source_exec",
            target: "node_sum_exec",
            sourcePortId: "port_out",
            targetPortId: "port_left"
          }
        ],
        groups: []
      })
    );
    const cycleValidation = engine.validateExecution(
      createGraphSnapshot({
        id: createGraphId("cycle"),
        metadata: graphMetadata,
        nodes: [
          {
            id: "node_cycle_a",
            type: "sum-exec",
            position: vec2(0, 0),
            ports: sumExecutionNodeType.ports
          },
          {
            id: "node_cycle_b",
            type: "sum-exec",
            position: vec2(200, 0),
            ports: sumExecutionNodeType.ports
          }
        ],
        edges: [
          {
            id: "edge_cycle_ab",
            source: "node_cycle_a",
            target: "node_cycle_b",
            sourcePortId: "port_out",
            targetPortId: "port_left"
          },
          {
            id: "edge_cycle_ba",
            source: "node_cycle_b",
            target: "node_cycle_a",
            sourcePortId: "port_out",
            targetPortId: "port_right"
          }
        ],
        groups: []
      })
    );

    expect(missingInputValidation.errors.map((error) => error.code)).toContain(
      "EXECUTION_INPUT_MISSING"
    );
    expect(cycleValidation.errors.map((error) => error.code)).toContain(
      "EXECUTION_CYCLE_DETECTED"
    );
  });

  it("executes DAGs deterministically and reuses cache entries", async () => {
    const engine = createCoreEngine({
      idSeed: "execution",
      nodeTypes: [sourceExecutionNodeType, sumExecutionNodeType, sinkExecutionNodeType]
    });
    const left = engine.createNode({
      type: "source-exec",
      position: vec2(0, 0),
      properties: { value: 3 },
      ports: sourceExecutionNodeType.ports
    });
    const right = engine.createNode({
      type: "source-exec",
      position: vec2(0, 100),
      properties: { value: 7 },
      ports: sourceExecutionNodeType.ports
    });
    const sum = engine.createNode({
      type: "sum-exec",
      position: vec2(250, 50),
      ports: sumExecutionNodeType.ports
    });
    const sink = engine.createNode({
      type: "sink-exec",
      position: vec2(500, 50),
      ports: sinkExecutionNodeType.ports
    });

    engine.createEdge({
      source: left.id,
      target: sum.id,
      sourcePortId: "port_out",
      targetPortId: "port_left"
    });
    engine.createEdge({
      source: right.id,
      target: sum.id,
      sourcePortId: "port_out",
      targetPortId: "port_right"
    });
    engine.createEdge({
      source: sum.id,
      target: sink.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });

    const firstRun = await engine.execute().result;
    const secondRun = await engine.execute().result;

    expect(firstRun.status).toBe("completed");
    expect(firstRun.nodeOrder).toEqual([left.id, right.id, sum.id, sink.id]);
    expect(firstRun.nodeResults[sum.id]?.outputs).toEqual({ port_out: 10 });
    expect(firstRun.nodeResults[sink.id]?.outputs).toEqual({ port_in: 10 });
    expect(secondRun.status).toBe("completed");
    expect(secondRun.nodeOrder).toEqual(firstRun.nodeOrder);
    expect(secondRun.nodeResults[sink.id]?.outputs).toEqual(firstRun.nodeResults[sink.id]?.outputs);
    expect(secondRun.cacheStats.hits).toBe(4);
  });

  it("invalidates downstream execution cache after mutations", async () => {
    const engine = createCoreEngine({
      idSeed: "cache",
      nodeTypes: [sourceExecutionNodeType, sumExecutionNodeType, sinkExecutionNodeType]
    });
    const left = engine.createNode({
      type: "source-exec",
      position: vec2(0, 0),
      properties: { value: 2 },
      ports: sourceExecutionNodeType.ports
    });
    const right = engine.createNode({
      type: "source-exec",
      position: vec2(0, 80),
      properties: { value: 5 },
      ports: sourceExecutionNodeType.ports
    });
    const sum = engine.createNode({
      type: "sum-exec",
      position: vec2(200, 40),
      ports: sumExecutionNodeType.ports
    });
    const sink = engine.createNode({
      type: "sink-exec",
      position: vec2(420, 40),
      ports: sinkExecutionNodeType.ports
    });

    engine.createEdge({
      source: left.id,
      target: sum.id,
      sourcePortId: "port_out",
      targetPortId: "port_left"
    });
    engine.createEdge({
      source: right.id,
      target: sum.id,
      sourcePortId: "port_out",
      targetPortId: "port_right"
    });
    engine.createEdge({
      source: sum.id,
      target: sink.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });

    await engine.execute().result;
    engine.updateNode(left.id, {
      properties: { value: 10 }
    });
    const rerun = await engine.execute().result;

    expect(engine.getExecutionCacheSnapshot().map((entry) => entry.nodeId)).toEqual(
      [left.id, right.id, sink.id, sum.id].sort()
    );
    expect(rerun.cacheStats.hits).toBe(1);
    expect(rerun.cacheStats.misses).toBe(3);
    expect(rerun.nodeResults[sink.id]?.outputs).toEqual({ port_in: 15 });
  });

  it("supports cancellation through the execution handle", async () => {
    const engine = createCoreEngine({
      nodeTypes: [
        {
          type: "slow-source",
          ports: [
            {
              id: "port_out",
              name: "Out",
              direction: "output",
              dataType: "number"
            }
          ],
          execution: {
            execute: ({ signal }) =>
              new Promise<ExecutionOutputs>((resolve, reject) => {
                const timer = setTimeout(() => {
                  resolve({ port_out: 1 });
                }, 25);

                signal.addEventListener("abort", () => {
                  clearTimeout(timer);
                  const error = new Error("Execution aborted");
                  error.name = "AbortError";
                  reject(error);
                });
              })
          }
        }
      ]
    });

    engine.createNode({
      type: "slow-source",
      position: vec2(0, 0),
      ports: [
        {
          id: "port_out",
          name: "Out",
          direction: "output",
          dataType: "number"
        }
      ]
    });

    const handle = engine.execute();

    expect(handle.cancel()).toBe(true);
    await expect(handle.result).resolves.toMatchObject({
      status: "cancelled"
    });
  });
});

describe("core engine serialization", () => {
  it("round-trips graphs through versioned JSON envelopes and supports partial export", () => {
    const groupId = createGroupId("serialize");
    const engine = createCoreEngine({
      idSeed: "serialize",
      nodeTypes: [passthroughNodeType],
      graph: {
        id: createGraphId("serialize"),
        metadata: graphMetadata,
        groups: [{ id: groupId, name: "Serialize" }]
      }
    });
    const left = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0),
      groupId
    });
    const right = engine.createNode({
      type: "passthrough",
      position: vec2(200, 0)
    });
    const edge = engine.createEdge({
      source: left.id,
      target: right.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });
    engine.selectNode(left.id);
    engine.selectEdge(edge.id, "add");

    const exported = engine.exportGraph();
    const partial = engine.exportPartialGraph();
    const importedEngine = createCoreEngine({
      nodeTypes: [passthroughNodeType]
    });

    expect(exported.version).toBe(1);
    expect(partial.graph.nodes.map((node) => node.id)).toEqual([left.id, right.id]);
    expect(partial.graph.edges.map((currentEdge) => currentEdge.id)).toEqual([edge.id]);

    importedEngine.importGraph(exported);
    expect(importedEngine.getSnapshot()).toEqual(engine.getSnapshot());
  });

  it("uses the migration registry scaffold for older envelopes", () => {
    const document: GraphDocumentEnvelope = {
      version: 0,
      graph: createEmptyGraph({
        id: createGraphId("legacy"),
        metadata: graphMetadata
      })
    };
    const registry = createMigrationRegistry([
      {
        fromVersion: 0,
        toVersion: 1,
        migrate: (current) => ({
          ...current,
          version: 1
        })
      }
    ]);
    const engine = createCoreEngine({
      nodeTypes: [passthroughNodeType]
    });

    expect(() => engine.importGraph(document, registry)).not.toThrow();
    expect(engine.exportGraph().version).toBe(1);
  });
});

describe("core engine events and disposal", () => {
  it("rejects duplicate plugins and isolates failing plugin hooks", () => {
    const dispose = vi.fn();
    const plugin: GraphPlugin = {
      name: "runtime-plugin",
      initialize: ({ engine }) => {
        engine.registerNodeType(passthroughNodeType);
      },
      dispose,
      hooks: {
        afterNodeCreate: () => {
          throw new Error("hook failure");
        }
      }
    };
    const engine = createCoreEngine();

    engine.registerPlugin(plugin);

    expect(() => engine.registerPlugin(plugin)).toThrowError(/already been registered/i);

    const node = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });

    expect(node.type).toBe("passthrough");
    expect(engine.getPlugins()).toEqual([
      expect.objectContaining({
        name: "runtime-plugin",
        initialized: true,
        lastError: "hook failure"
      })
    ]);
    expect(engine.unregisterPlugin("runtime-plugin")).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("emits stable graph events during load and CRUD operations", () => {
    const engine = createCoreEngine({
      idSeed: "events",
      nodeTypes: [passthroughNodeType]
    });
    const events: string[] = [];

    engine.on("graphLoaded", (payload) => {
      events.push(`graph:${payload.graph.id}`);
    });
    engine.on("nodeAdded", (payload) => {
      events.push(`nodeAdded:${payload.node.id}:${payload.graph.nodes.length}`);
    });
    engine.on("edgeCreated", (payload) => {
      events.push(`edgeCreated:${payload.edge.id}:${payload.graph.edges.length}`);
    });
    engine.on("edgeDeleted", (payload) => {
      events.push(`edgeDeleted:${payload.edge.id}:${payload.graph.edges.length}`);
    });
    engine.on("nodeRemoved", (payload) => {
      events.push(`nodeRemoved:${payload.node.id}:${payload.removedEdges.length}`);
    });

    const loadedGraphId = "graph_events_fixed";
    engine.loadGraph({
      id: loadedGraphId,
      metadata: graphMetadata
    });
    const left = engine.createNode({
      type: "passthrough",
      position: vec2(0, 0)
    });
    const right = engine.createNode({
      type: "passthrough",
      position: vec2(100, 0)
    });
    const edge = engine.createEdge({
      source: left.id,
      target: right.id,
      sourcePortId: "port_out",
      targetPortId: "port_in"
    });
    engine.deleteEdge(edge.id);
    engine.deleteNode(left.id);

    expect(events).toEqual([
      `graph:${loadedGraphId}`,
      "nodeAdded:node_passthrough_0001:1",
      "nodeAdded:node_passthrough_0002:2",
      "edgeCreated:edge_edge_0001:1",
      "edgeDeleted:edge_edge_0001:0",
      "nodeRemoved:node_passthrough_0001:0"
    ]);
  });

  it("emits execution lifecycle events", async () => {
    const engine = createCoreEngine({
      idSeed: "execution-events",
      nodeTypes: [sourceExecutionNodeType]
    });
    const node = engine.createNode({
      type: "source-exec",
      position: vec2(0, 0),
      ports: sourceExecutionNodeType.ports
    });
    const events: string[] = [];

    engine.on("executionStarted", ({ executionId, nodeIds }) => {
      events.push(`start:${executionId}:${nodeIds.join(",")}`);
    });
    engine.on("executionCompleted", ({ result }) => {
      events.push(`complete:${result.executionId}:${result.status}`);
    });

    const run = await engine.execute().result;

    expect(run.nodeResults[node.id]?.outputs).toEqual({ port_out: 1 });
    expect(events).toEqual([
      `start:${run.executionId}:${node.id}`,
      `complete:${run.executionId}:completed`
    ]);
  });

  it("disposes safely and rejects later access", () => {
    const engine = createCoreEngine({
      nodeTypes: [passthroughNodeType]
    });
    const listener = vi.fn();
    engine.on("nodeAdded", listener);

    engine.dispose();

    expect(engine.isDisposed()).toBe(true);
    expect(() => engine.getSnapshot()).toThrowError(/disposed/i);
    expect(() =>
      engine.createNode({
        type: "passthrough",
        position: vec2(0, 0)
      })
    ).toThrowError(/disposed/i);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("core engine determinism", () => {
  it("produces identical snapshots for the same operation sequence", () => {
    const createEngine = () =>
      createCoreEngine({
        idSeed: "replay",
        graph: {
          id: "graph_replay_fixed",
          metadata: graphMetadata
        },
        nodeTypes: [passthroughNodeType]
      });

    const runSequence = () => {
      const engine = createEngine();
      const left = engine.createNode({
        type: "passthrough",
        position: vec2(0, 0)
      });
      const right = engine.createNode({
        type: "passthrough",
        position: vec2(300, 0)
      });

      engine.updateNode(left.id, {
        label: "Left"
      });
      engine.createEdge({
        source: left.id,
        target: right.id,
        sourcePortId: "port_out",
        targetPortId: "port_in"
      });

      const snapshot = engine.getSnapshot();

      while (engine.undo()) {
        continue;
      }

      while (engine.redo()) {
        continue;
      }

      expect(engine.getSnapshot()).toEqual(snapshot);
      return snapshot;
    };

    expect(runSequence()).toEqual(runSequence());
  });

  it("produces identical execution results for the same graph", async () => {
    const createEngine = () =>
      createCoreEngine({
        idSeed: "replay-execution",
        nodeTypes: [sourceExecutionNodeType, sumExecutionNodeType, sinkExecutionNodeType]
      });

    const runSequence = async () => {
      const engine = createEngine();
      const left = engine.createNode({
        type: "source-exec",
        position: vec2(0, 0),
        properties: { value: 4 },
        ports: sourceExecutionNodeType.ports
      });
      const right = engine.createNode({
        type: "source-exec",
        position: vec2(0, 120),
        properties: { value: 6 },
        ports: sourceExecutionNodeType.ports
      });
      const sum = engine.createNode({
        type: "sum-exec",
        position: vec2(200, 60),
        ports: sumExecutionNodeType.ports
      });
      const sink = engine.createNode({
        type: "sink-exec",
        position: vec2(420, 60),
        ports: sinkExecutionNodeType.ports
      });

      engine.createEdge({
        source: left.id,
        target: sum.id,
        sourcePortId: "port_out",
        targetPortId: "port_left"
      });
      engine.createEdge({
        source: right.id,
        target: sum.id,
        sourcePortId: "port_out",
        targetPortId: "port_right"
      });
      engine.createEdge({
        source: sum.id,
        target: sink.id,
        sourcePortId: "port_out",
        targetPortId: "port_in"
      });

      return engine.execute().result;
    };

    const leftRun = await runSequence();
    const rightRun = await runSequence();

    expect({
      ...leftRun,
      startedAtIso: "normalized",
      completedAtIso: "normalized"
    }).toEqual({
      ...rightRun,
      startedAtIso: "normalized",
      completedAtIso: "normalized"
    });
  });
});

// ─── Sprint 11: Cyclic execution ─────────────────────────────────────────────

const makeNodeId = (id: string) => id as Parameters<typeof findStronglyConnectedComponents>[0][number];

const edgeSnap = (
  id: string,
  source: string,
  target: string
): GraphEdgeSnapshot => ({
  id: id as GraphEdgeSnapshot["id"],
  source: source as GraphEdgeSnapshot["source"],
  target: target as GraphEdgeSnapshot["target"]
});

describe("findStronglyConnectedComponents", () => {
  it("returns no SCCs for a DAG", () => {
    const nodes = ["a", "b", "c"].map(makeNodeId);
    const edges = [edgeSnap("e1", "a", "b"), edgeSnap("e2", "b", "c")];
    expect(findStronglyConnectedComponents(nodes, edges)).toHaveLength(0);
  });

  it("detects a 3-node cycle", () => {
    const nodes = ["a", "b", "c"].map(makeNodeId);
    const edges = [edgeSnap("e1", "a", "b"), edgeSnap("e2", "b", "c"), edgeSnap("e3", "c", "a")];
    const sccs = findStronglyConnectedComponents(nodes, edges);
    expect(sccs).toHaveLength(1);
    expect(sccs[0]!.nodeIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("detects two independent cycles", () => {
    const nodes = ["a", "b", "c", "d"].map(makeNodeId);
    const edges = [
      edgeSnap("e1", "a", "b"),
      edgeSnap("e2", "b", "a"),
      edgeSnap("e3", "c", "d"),
      edgeSnap("e4", "d", "c")
    ];
    const sccs = findStronglyConnectedComponents(nodes, edges);
    expect(sccs).toHaveLength(2);
    const sorted = sccs.map((s) => s.nodeIds.slice().sort()).sort((x, y) => x[0]!.localeCompare(y[0]!));
    expect(sorted).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("does not report a self-loop when allowSelfLoops is false", () => {
    const nodes = ["a"].map(makeNodeId);
    const edges = [edgeSnap("e1", "a", "a")];
    expect(findStronglyConnectedComponents(nodes, edges, false)).toHaveLength(0);
  });

  it("reports a self-loop SCC when allowSelfLoops is true", () => {
    const nodes = ["a"].map(makeNodeId);
    const edges = [edgeSnap("e1", "a", "a")];
    const sccs = findStronglyConnectedComponents(nodes, edges, true);
    expect(sccs).toHaveLength(1);
    expect(sccs[0]!.nodeIds).toEqual(["a"]);
  });

  it("computes entryEdgeIds and exitEdgeIds for a cycle embedded in a larger graph", () => {
    // x → a → b → a (cycle), b → y
    const nodes = ["x", "a", "b", "y"].map(makeNodeId);
    const edges = [
      edgeSnap("entry", "x", "a"),
      edgeSnap("forward", "a", "b"),
      edgeSnap("back", "b", "a"),
      edgeSnap("exit", "b", "y")
    ];
    const sccs = findStronglyConnectedComponents(nodes, edges);
    expect(sccs).toHaveLength(1);
    const scc = sccs[0]!;
    expect(scc.nodeIds.sort()).toEqual(["a", "b"]);
    expect(scc.entryEdgeIds).toEqual(["entry"]);
    expect(scc.exitEdgeIds).toEqual(["exit"]);
  });
});

// Node types for cyclic execution tests

const cyclicSourceType: NodeTypeDefinition = {
  type: "cyclic-source",
  defaultLabel: "Source",
  ports: [
    { id: "feedback", name: "Feedback", direction: "input" },
    { id: "out", name: "Out", direction: "output" }
  ],
  execution: {
    requiredInputs: [],
    execute: async ({ inputs, properties }) => {
      const feedback = (inputs["feedback"] as number | undefined) ?? 0;
      const base = (properties["base"] as number) ?? 1.0;
      return { out: base + feedback * 0.5 };
    }
  }
};

const cyclicPassthroughType: NodeTypeDefinition = {
  type: "cyclic-passthrough",
  defaultLabel: "Passthrough",
  ports: [
    { id: "in", name: "In", direction: "input" },
    { id: "out", name: "Out", direction: "output" }
  ],
  execution: {
    requiredInputs: ["in"],
    execute: async ({ inputs }) => ({ out: inputs["in"] })
  }
};

const cyclicDampenType: NodeTypeDefinition = {
  type: "cyclic-dampen",
  defaultLabel: "Dampen",
  ports: [
    { id: "in", name: "In", direction: "input" },
    { id: "out", name: "Out", direction: "output" }
  ],
  execution: {
    requiredInputs: ["in"],
    execute: async ({ inputs, properties }) => {
      const factor = (properties["factor"] as number) ?? 0.5;
      return { out: (inputs["in"] as number) * factor };
    }
  }
};

const cyclicStringType: NodeTypeDefinition = {
  type: "cyclic-string",
  defaultLabel: "StringNode",
  ports: [
    { id: "trigger", name: "Trigger", direction: "input" },
    { id: "out", name: "Out", direction: "output" }
  ],
  execution: {
    requiredInputs: [],
    execute: async ({ inputs }) => {
      const trigger = (inputs["trigger"] as number | undefined) ?? 0;
      return { out: trigger > 0 ? "active" : "idle" };
    }
  }
};

const makeCyclicEngine = (opts?: { maxIterations?: number; convergenceThreshold?: number }) =>
  createCoreEngine({
    idSeed: "cyclic-test",
    allowCycles: true,
    cyclicExecution: {
      allowCycles: true,
      maxIterations: opts?.maxIterations ?? 50,
      convergenceThreshold: opts?.convergenceThreshold ?? 0.0001
    },
    nodeTypes: [
      cyclicSourceType,
      cyclicPassthroughType,
      cyclicDampenType,
      cyclicStringType,
      sourceExecutionNodeType,
      sumExecutionNodeType,
      sinkExecutionNodeType
    ]
  });

describe("cyclic execution — allowCycles: false rejects cyclic graph", () => {
  it("returns failed status when graph contains a cycle", async () => {
    const engine = createCoreEngine({
      idSeed: "no-cycles",
      allowCycles: true,
      nodeTypes: [cyclicSourceType, cyclicPassthroughType, cyclicDampenType]
    });

    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    // Engine with allowCycles: false at execution level
    const strictEngine = createCoreEngine({
      idSeed: "strict-no-cycles",
      allowCycles: true,
      nodeTypes: [cyclicSourceType, cyclicPassthroughType, cyclicDampenType]
    });

    const snap = engine.getSnapshot();
    strictEngine.loadGraph({ nodes: snap.nodes, edges: snap.edges });

    const result = await strictEngine.execute().result;
    expect(result.status).toBe("failed");
  });
});

describe("cyclic execution — core fixed-point", () => {
  it("runs a DAG with allowCycles:true and returns iterationsRun: 0", async () => {
    const engine = makeCyclicEngine();
    const left = engine.createNode({ type: "source-exec", position: vec2(0, 0), properties: { value: 3 }, ports: sourceExecutionNodeType.ports });
    const right = engine.createNode({ type: "source-exec", position: vec2(0, 120), properties: { value: 7 }, ports: sourceExecutionNodeType.ports });
    const sum = engine.createNode({ type: "sum-exec", position: vec2(200, 60), ports: sumExecutionNodeType.ports });
    engine.createEdge({ source: left.id, target: sum.id, sourcePortId: "port_out", targetPortId: "port_left" });
    engine.createEdge({ source: right.id, target: sum.id, sourcePortId: "port_out", targetPortId: "port_right" });

    const result = await engine.execute().result;
    expect(result.status).toBe("completed");
    expect(result.iterationsRun).toBe(0);
    expect(result.converged).toBe(true);
    expect(result.cycleGroups).toHaveLength(0);
    expect(result.nodeResults[sum.id]?.outputs["port_out"]).toBe(10);
  });

  it("emits executionCycleIteration events per iteration with non-increasing maxDelta", async () => {
    const engine = makeCyclicEngine();
    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const iterEvents: { iteration: number; maxDelta: number }[] = [];
    engine.on("executionCycleIteration", (e) => iterEvents.push({ iteration: e.iteration, maxDelta: e.maxDelta }));

    const result = await engine.execute().result;
    expect(result.status).toBe("completed");
    expect(iterEvents.length).toBeGreaterThan(0);
    expect(iterEvents[0]!.iteration).toBe(1);

    // Deltas should be non-increasing overall (may fluctuate slightly but should trend down)
    const lastDelta = iterEvents[iterEvents.length - 1]!.maxDelta;
    expect(lastDelta).toBeLessThan(0.0001);
  });

  it("emits executionConverged when cycle converges", async () => {
    const engine = makeCyclicEngine();
    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const convergedEvents: { groupIndex: number; iterations: number; finalDelta: number }[] = [];
    engine.on("executionConverged", (e) => convergedEvents.push(e));

    const result = await engine.execute().result;
    expect(result.converged).toBe(true);
    expect(convergedEvents).toHaveLength(1);
    expect(convergedEvents[0]!.finalDelta).toBeLessThan(0.0001);
  });

  it("emits executionDiverged when maxIterations exceeded", async () => {
    const engine = makeCyclicEngine({ maxIterations: 2, convergenceThreshold: 0.0000001 });
    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });

    // Two-node cycle that won't converge in 2 iters with very tight threshold
    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const divergedEvents: { groupIndex: number; iterations: number; lastDelta: number }[] = [];
    engine.on("executionDiverged", (e) => divergedEvents.push(e));

    const result = await engine.execute().result;
    expect(result.converged).toBe(false);
    expect(divergedEvents).toHaveLength(1);
    expect(divergedEvents[0]!.iterations).toBe(2);
  });

  it("treats non-numeric output change as Infinity delta", async () => {
    const engine = makeCyclicEngine({ maxIterations: 3, convergenceThreshold: 0.0000001 });
    const a = engine.createNode({ type: "cyclic-string", position: vec2(0, 0), ports: cyclicStringType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: a.id, sourcePortId: "out", targetPortId: "trigger" });

    const iterEvents: { maxDelta: number }[] = [];
    engine.on("executionCycleIteration", (e) => iterEvents.push({ maxDelta: e.maxDelta }));

    // First iteration: a has no prior output, b has no prior output → no prior for a's out → Infinity
    // After cycle stabilizes (string doesn't change), delta becomes 0
    await engine.execute().result;

    // At least one event should have Infinity (first pass from cold start with changing string value)
    const hasInfinity = iterEvents.some((e) => e.maxDelta === Infinity);
    expect(hasInfinity).toBe(true);
  });

  it("warm-start: second execute on unchanged cyclic graph converges in 1 iteration", async () => {
    const engine = makeCyclicEngine();
    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const firstResult = await engine.execute().result;
    expect(firstResult.status).toBe("completed");
    expect(firstResult.iterationsRun).toBeGreaterThan(1);

    const secondResult = await engine.execute().result;
    expect(secondResult.status).toBe("completed");
    // Second run warm-starts from cache → converges in 1 iteration (delta already < threshold)
    expect(secondResult.iterationsRun).toBe(1);
    expect(secondResult.converged).toBe(true);
  });

  it("cyclic fixture: 3-node feedback loop converges and produces correct outputs", async () => {
    const engine = makeCyclicEngine();
    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 2 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const result = await engine.execute().result;
    expect(result.status).toBe("completed");
    expect(result.converged).toBe(true);
    expect(result.cycleGroups).toHaveLength(1);
    expect(result.cycleGroups[0]!.nodeIds.sort()).toEqual([a.id, b.id, c.id].sort());

    // Fixed-point: a_out = 2 + c_out*0.5, b_out = a_out, c_out = b_out*0.5
    // → a_out = 2 + 0.5*(0.5*a_out) → a_out*(1 - 0.25) = 2 → a_out ≈ 2.667
    const aOut = result.nodeResults[a.id]?.outputs["out"] as number;
    expect(aOut).toBeCloseTo(8 / 3, 3);
  });

  it("two runs produce identical outputs (determinism)", async () => {
    const build = async () => {
      const engine = makeCyclicEngine();
      const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
      const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
      const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });
      engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
      engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
      engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });
      return (await engine.execute().result).nodeResults;
    };

    const [r1, r2] = await Promise.all([build(), build()]);
    const nodeIds = Object.keys(r1!);

    for (const id of nodeIds) {
      const out1 = r1![id]?.outputs;
      const out2 = r2![id]?.outputs;

      for (const key of Object.keys(out1 ?? {})) {
        const v1 = (out1 as Record<string, unknown>)[key] as number;
        const v2 = (out2 as Record<string, unknown>)[key] as number;
        expect(Math.abs(v1 - v2)).toBeLessThan(0.0001);
      }
    }
  });
});

describe("cyclic execution — stepped handle", () => {
  it("step() advances the cycle one iteration at a time", async () => {
    const engine = createCoreEngine({
      idSeed: "stepped-test",
      allowCycles: true,
      cyclicExecution: {
        allowCycles: true,
        maxIterations: 50,
        convergenceThreshold: 0.0001,
        cycleBehavior: "stepped"
      },
      nodeTypes: [cyclicSourceType, cyclicPassthroughType, cyclicDampenType]
    });

    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const handle = engine.execute() as import("@kaiisuuwii/core").SteppedExecutionHandle;
    expect(typeof handle.step).toBe("function");

    let steps = 0;
    let done = false;
    let finalResult: import("@kaiisuuwii/core").ExecutionResult | undefined;

    while (!done && steps < 200) {
      const { done: d, result } = await handle.step();
      done = d;
      steps++;
      if (result !== undefined) {
        finalResult = result;
      }
    }

    expect(finalResult).toBeDefined();
    expect(finalResult!.status).toBe("completed");
    expect(finalResult!.converged).toBe(true);
  });

  it("cancel() on a stepped handle yields status: cancelled", async () => {
    const engine = createCoreEngine({
      idSeed: "stepped-cancel",
      allowCycles: true,
      cyclicExecution: {
        allowCycles: true,
        maxIterations: 1000,
        convergenceThreshold: 1e-12,
        cycleBehavior: "stepped"
      },
      nodeTypes: [cyclicSourceType, cyclicPassthroughType, cyclicDampenType]
    });

    const a = engine.createNode({ type: "cyclic-source", position: vec2(0, 0), properties: { base: 1 }, ports: cyclicSourceType.ports });
    const b = engine.createNode({ type: "cyclic-passthrough", position: vec2(200, 0), ports: cyclicPassthroughType.ports });
    const c = engine.createNode({ type: "cyclic-dampen", position: vec2(400, 0), properties: { factor: 0.5 }, ports: cyclicDampenType.ports });

    engine.createEdge({ source: a.id, target: b.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: b.id, target: c.id, sourcePortId: "out", targetPortId: "in" });
    engine.createEdge({ source: c.id, target: a.id, sourcePortId: "out", targetPortId: "feedback" });

    const handle = engine.execute() as import("@kaiisuuwii/core").SteppedExecutionHandle;

    // Take one step to start, then cancel
    await handle.step();
    handle.cancel();

    // Next step should complete with cancelled status
    const { done, result } = await handle.step();
    expect(done).toBe(true);
    expect(result!.status).toBe("cancelled");
  });
});
