import type {
  EdgeInput,
  GraphDocumentEnvelope,
  GraphInput,
  GraphSnapshot,
  NodeInput
} from "@kaiisuuwii/core";
import { createGraphSnapshot } from "@kaiisuuwii/core";
import { vec2 } from "@kaiisuuwii/shared";

type PipelineNodeInput = NodeInput & {
  readonly id: `node_${string}`;
};

const createDocument = (
  id: `graph_${string}`,
  name: string,
  tags: readonly string[],
  snapshot: GraphInput
): GraphDocumentEnvelope => ({
  version: 1,
  graph: createGraphSnapshot({
    ...snapshot,
    id,
    metadata: {
      name,
      version: "0.1.0",
      tags,
      createdAtIso: "2026-05-10T00:00:00.000Z"
    }
  })
});

const createPipelineDocument = (
  id: `graph_${string}`,
  name: string,
  chainLength: number
): GraphDocumentEnvelope => {
  const nodes: readonly PipelineNodeInput[] = Array.from({ length: chainLength }, (_, index) => {
    const nodeId = `node_${id}_${index}` as const;
    const isSource = index === 0;
    const isSink = index === chainLength - 1;

    return {
      id: nodeId,
      type: isSource ? "number" : isSink ? "display" : "math",
      position: vec2(120 + index * 260, 180 + (index % 2) * 84),
      dimensions: vec2(isSink ? 200 : 220, isSink ? 88 : 108),
      label: isSource ? "Source" : isSink ? "Display" : `Math ${index}`,
      groupId: `group_${id}_pipeline` as const,
      properties: isSource ? { value: 2 + index } : isSink ? {} : { bias: index },
      ports: isSource
        ? [
            {
                id: "port_source_out",
              name: "value",
              direction: "output" as const,
              dataType: "number"
            }
          ]
        : isSink
          ? [
              {
                id: "port_sink_in",
                name: "input",
                direction: "input" as const,
                dataType: "number"
              }
            ]
          : [
              {
                id: "port_mix_in_a",
                name: "a",
                direction: "input" as const,
                dataType: "number"
              },
              {
                id: "port_mix_out",
                name: "result",
                direction: "output" as const,
                dataType: "number"
              }
            ]
    };
  });

  const edges: readonly EdgeInput[] = Array.from({ length: Math.max(0, chainLength - 1) }, (_, index) => {
    const sourceNode = nodes[index]!;
    const targetNode = nodes[index + 1]!;

    return {
      id: `edge_${id}_${index}` as const,
      source: sourceNode.id,
      target: targetNode.id,
      sourcePortId: sourceNode.type === "number" ? "port_source_out" : "port_mix_out",
      targetPortId: targetNode.type === "display" ? "port_sink_in" : "port_mix_in_a",
      dataType: "number"
    };
  });

  return createDocument(id, name, ["pipeline", `${chainLength}-nodes`], {
    id,
    metadata: {
      name,
      version: "0.1.0",
      tags: [],
      createdAtIso: "2026-05-10T00:00:00.000Z"
    },
    nodes,
    edges,
    groups: [
      {
        id: `group_${id}_pipeline`,
        name: "Pipeline",
        nodeIds: nodes.map((node) => node.id)
      }
    ],
    selection: {
      nodeIds: [nodes[Math.min(1, nodes.length - 1)]?.id ?? nodes[0]?.id ?? ("node_missing" as const)],
      edgeIds: [],
      groupIds: [],
      activeSelectionMode: "node"
    }
  });
};

export const SMALL_GRAPH_EXAMPLE_DOCUMENT = createPipelineDocument(
  "graph_example_small",
  "Small Graph Fixture",
  3
);

export const MEDIUM_GRAPH_EXAMPLE_DOCUMENT = createPipelineDocument(
  "graph_example_medium",
  "Medium Graph Fixture",
  6
);

export const LARGE_GRAPH_EXAMPLE_DOCUMENT = createPipelineDocument(
  "graph_example_large",
  "Large Graph Fixture",
  10
);

export const PLUGIN_EXAMPLE_DOCUMENT = createDocument(
  "graph_example_plugin",
  "Plugin Example Fixture",
  ["plugin", "execution"],
  {
    id: "graph_example_plugin",
    metadata: {
      name: "Plugin Example Fixture",
      version: "0.1.0",
      tags: [],
      createdAtIso: "2026-05-10T00:00:00.000Z"
    },
    nodes: [
      {
        id: "node_plugin_source",
        type: "number",
        position: vec2(120, 120),
        dimensions: vec2(220, 96),
        label: "Source",
        groupId: "group_plugin_pipeline",
        properties: { value: 4 },
        ports: [
            {
              id: "port_source_out",
              name: "value",
              direction: "output",
              dataType: "number"
            }
        ]
      },
      {
        id: "node_plugin_mix",
        type: "math",
        position: vec2(420, 240),
        dimensions: vec2(240, 112),
        label: "Mix",
        groupId: "group_plugin_pipeline",
        properties: { bias: 3 },
        ports: [
            {
              id: "port_mix_in_a",
              name: "a",
              direction: "input",
              dataType: "number"
            },
            {
              id: "port_mix_in_b",
              name: "b",
              direction: "input",
              dataType: "number"
            },
            {
              id: "port_mix_out",
              name: "result",
              direction: "output",
              dataType: "number"
            }
        ]
      },
      {
        id: "node_plugin_sink",
        type: "display",
        position: vec2(780, 180),
        dimensions: vec2(200, 88),
        label: "Preview",
        groupId: "group_plugin_pipeline",
        ports: [
            {
              id: "port_sink_in",
              name: "input",
              direction: "input",
              dataType: "number"
            }
        ]
      }
    ],
    edges: [
      {
        id: "edge_plugin_source_mix",
        source: "node_plugin_source",
        target: "node_plugin_mix",
        sourcePortId: "port_source_out",
        targetPortId: "port_mix_in_a",
        dataType: "number"
      },
      {
        id: "edge_plugin_mix_sink",
        source: "node_plugin_mix",
        target: "node_plugin_sink",
        sourcePortId: "port_mix_out",
        targetPortId: "port_sink_in",
        dataType: "number"
      }
    ],
    groups: [
      {
        id: "group_plugin_pipeline",
        name: "Pipeline",
        nodeIds: ["node_plugin_source", "node_plugin_mix", "node_plugin_sink"]
      }
    ],
    selection: {
      nodeIds: ["node_plugin_mix"],
      edgeIds: [],
      groupIds: [],
      activeSelectionMode: "node"
    }
  }
);

export const CUSTOM_NODE_EXAMPLE_DOCUMENT = createDocument(
  "graph_example_custom_node",
  "Custom Node Fixture",
  ["custom-node", "annotation"],
  {
    id: "graph_example_custom_node",
    metadata: {
      name: "Custom Node Fixture",
      version: "0.1.0",
      tags: [],
      createdAtIso: "2026-05-10T00:00:00.000Z"
    },
    nodes: [
      {
        id: "node_custom_annotation",
        type: "annotation",
        position: vec2(100, 80),
        dimensions: vec2(260, 112),
        label: "Read Me",
        properties: {
          note: "This annotation explains the pipeline."
        },
        ports: []
      },
      {
        id: "node_custom_source",
        type: "number",
        position: vec2(120, 260),
        dimensions: vec2(220, 96),
        label: "Seed",
        properties: { value: 9 },
        ports: [
            {
              id: "port_source_out",
              name: "value",
              direction: "output",
              dataType: "number"
            }
        ]
      },
      {
        id: "node_custom_display",
        type: "display",
        position: vec2(420, 260),
        dimensions: vec2(220, 88),
        label: "Result",
        ports: [
            {
              id: "port_sink_in",
              name: "input",
              direction: "input",
              dataType: "number"
            }
        ]
      }
    ],
    edges: [
      {
        id: "edge_custom_source_display",
        source: "node_custom_source",
        target: "node_custom_display",
        sourcePortId: "port_source_out",
        targetPortId: "port_sink_in",
        dataType: "number"
      }
    ],
    groups: [],
    selection: {
      nodeIds: ["node_custom_annotation"],
      edgeIds: [],
      groupIds: [],
      activeSelectionMode: "node"
    }
  }
);

export const INVALID_GRAPH_EXAMPLE_DOCUMENT = createDocument(
  "graph_example_invalid",
  "Invalid Graph Fixture",
  ["invalid", "validation"],
  {
    id: "graph_example_invalid",
    metadata: {
      name: "Invalid Graph Fixture",
      version: "0.1.0",
      tags: [],
      createdAtIso: "2026-05-10T00:00:00.000Z"
    },
    nodes: [
      {
        id: "node_invalid_source",
        type: "number",
        position: vec2(120, 120),
        dimensions: vec2(220, 96),
        label: "Broken Source",
        ports: [
          {
            id: "port_invalid_source_out",
            name: "value",
            direction: "output",
            dataType: "number"
          }
        ]
      }
    ],
    edges: [
      {
        id: "edge_invalid_missing_target",
        source: "node_invalid_source",
        target: "node_invalid_missing",
        sourcePortId: "port_invalid_source_out",
        targetPortId: "port_missing_in",
        dataType: "number"
      }
    ],
    groups: [
      {
        id: "group_invalid_missing",
        name: "Broken Group",
        nodeIds: ["node_invalid_missing"]
      }
    ],
    selection: {
      nodeIds: ["node_invalid_missing"],
      edgeIds: ["edge_invalid_missing_edge"],
      groupIds: ["group_invalid_missing"],
      activeSelectionMode: "mixed"
    }
  }
);

export const FOUNDATION_EXAMPLE_DOCUMENT = PLUGIN_EXAMPLE_DOCUMENT;

export const createFoundationExampleSnapshot = (): GraphSnapshot =>
  FOUNDATION_EXAMPLE_DOCUMENT.graph;

export const EXAMPLE_FIXTURES = {
  "small-graph": SMALL_GRAPH_EXAMPLE_DOCUMENT,
  "medium-graph": MEDIUM_GRAPH_EXAMPLE_DOCUMENT,
  "large-graph": LARGE_GRAPH_EXAMPLE_DOCUMENT,
  "invalid-graph": INVALID_GRAPH_EXAMPLE_DOCUMENT,
  "custom-node": CUSTOM_NODE_EXAMPLE_DOCUMENT,
  "plugin-example": PLUGIN_EXAMPLE_DOCUMENT
} as const;

export type ExampleFixtureId = keyof typeof EXAMPLE_FIXTURES;
