import { createGraphSnapshot, type GraphDocumentEnvelope, type GraphSnapshot } from "@react-native-node-graph/core";
import { createEdgeId, createGraphId, createNodeId, vec2 } from "@react-native-node-graph/shared";

const sourceNodeId = createNodeId("source");
const mixNodeId = createNodeId("mix");
const sinkNodeId = createNodeId("sink");
const sourceToMixEdgeId = createEdgeId("edge-source-mix");
const mixToSinkEdgeId = createEdgeId("edge-mix-sink");

export const FOUNDATION_EXAMPLE_DOCUMENT: GraphDocumentEnvelope = {
  version: 1,
  graph: createGraphSnapshot({
    id: createGraphId("renderer-foundation"),
    metadata: {
      name: "Renderer Foundation Fixture",
      version: "0.1.0",
      tags: ["sprint-04", "static"],
      createdAtIso: "2026-05-10T00:00:00.000Z"
    },
    nodes: [
      {
        id: sourceNodeId,
        type: "number",
        position: vec2(120, 120),
        dimensions: vec2(220, 96),
        label: "Source",
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
        id: mixNodeId,
        type: "math",
        position: vec2(420, 240),
        dimensions: vec2(240, 112),
        label: "Mix",
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
        id: sinkNodeId,
        type: "display",
        position: vec2(780, 180),
        dimensions: vec2(200, 88),
        label: "Preview",
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
        id: sourceToMixEdgeId,
        source: sourceNodeId,
        target: mixNodeId,
        sourcePortId: "port_source_out",
        targetPortId: "port_mix_in_a",
        dataType: "number"
      },
      {
        id: mixToSinkEdgeId,
        source: mixNodeId,
        target: sinkNodeId,
        sourcePortId: "port_mix_out",
        targetPortId: "port_sink_in",
        dataType: "number"
      }
    ],
    groups: [
      {
        id: "group_pipeline",
        name: "Pipeline",
        nodeIds: [sourceNodeId, mixNodeId, sinkNodeId]
      }
    ],
    selection: {
      nodeIds: [mixNodeId],
      edgeIds: [],
      groupIds: [],
      activeSelectionMode: "node"
    }
  })
};

export const createFoundationExampleSnapshot = (): GraphSnapshot =>
  FOUNDATION_EXAMPLE_DOCUMENT.graph;
