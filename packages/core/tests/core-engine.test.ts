import {
  CoreGraphError,
  createCoreEngine,
  createEmptyGraph,
  createGraphSnapshot,
  createGroupId,
  createMigrationRegistry,
  type ExecutionOutputs,
  type GraphPlugin,
  type GraphDocumentEnvelope,
  type NodeTypeDefinition
} from "@react-native-node-graph/core";
import { createGraphId, vec2 } from "@react-native-node-graph/shared";
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
