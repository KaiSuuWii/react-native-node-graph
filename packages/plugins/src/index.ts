import type {
  ExecutionInputs,
  GraphPlugin,
  GraphPluginContext,
  NodeTypeDefinition
} from "@react-native-node-graph/core";
import type {
  RenderEdgeLayout,
  RenderNodeLayout,
  RendererPlugin
} from "@react-native-node-graph/renderer-skia";
import { vec2 } from "@react-native-node-graph/shared";

const readNumericInput = (
  inputs: ExecutionInputs,
  portId: string,
  fallback = 0
): number => {
  const value = inputs[portId];

  if (Array.isArray(value)) {
    return value.reduce<number>(
      (total, entry) => total + (typeof entry === "number" ? entry : 0),
      0
    );
  }

  return typeof value === "number" ? value : fallback;
};

const executableNodeTypes = (): readonly NodeTypeDefinition[] => [
  {
    type: "number",
    defaultLabel: "Number",
    ports: [
      {
        id: "port_source_out",
        name: "value",
        direction: "output",
        dataType: "number"
      }
    ],
    execution: {
      execute: ({ node }) => ({
        port_source_out:
          typeof node.properties.value === "number" ? node.properties.value : 1
      })
    }
  },
  {
    type: "math",
    defaultLabel: "Math",
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
    ],
    execution: {
      requiredInputs: ["port_mix_in_a"],
      execute: ({ inputs, node }) => ({
        port_mix_out:
          readNumericInput(inputs, "port_mix_in_a") +
          readNumericInput(
            inputs,
            "port_mix_in_b",
            typeof node.properties.bias === "number" ? node.properties.bias : 0
          )
      })
    }
  },
  {
    type: "display",
    defaultLabel: "Display",
    ports: [
      {
        id: "port_sink_in",
        name: "input",
        direction: "input",
        dataType: "number"
      }
    ],
    execution: {
      requiredInputs: ["port_sink_in"],
      execute: ({ inputs }) => ({
        port_sink_in: readNumericInput(inputs, "port_sink_in")
      })
    }
  }
];

const annotationNodeType: NodeTypeDefinition = {
  type: "annotation",
  defaultLabel: "Annotation",
  ports: [],
  execution: {
    execute: ({ node }) => ({
      note:
        typeof node.properties.note === "string" && node.properties.note.length > 0
          ? node.properties.note
          : node.label
    })
  }
};

export const createExecutableNodePlugin = (): GraphPlugin => ({
  name: "sample-executable-node-plugin",
  initialize: ({ engine }: GraphPluginContext) => {
    executableNodeTypes().forEach((definition) => {
      engine.registerNodeType(definition);
    });

    return () => {
      executableNodeTypes().forEach((definition) => {
        engine.unregisterNodeType(definition.type);
      });
    };
  }
});

export const createAnnotationNodePlugin = (): GraphPlugin => ({
  name: "sample-annotation-node-plugin",
  initialize: ({ engine }: GraphPluginContext) => {
    engine.registerNodeType(annotationNodeType);

    return () => {
      engine.unregisterNodeType(annotationNodeType.type);
    };
  }
});

const withNodeBadge = (
  layout: RenderNodeLayout,
  label: string,
  color: string
): RenderNodeLayout => ({
  ...layout,
  pluginVisuals: [
    ...layout.pluginVisuals,
    {
      kind: "badge",
      label,
      color
    }
  ]
});

const withEdgeLabel = (
  layout: RenderEdgeLayout,
  label: string
): RenderEdgeLayout => ({
  ...layout,
  pluginVisuals: [
    ...layout.pluginVisuals,
    {
      kind: "label",
      label,
      color: layout.color,
      position: vec2(
        (layout.curve.start.x + layout.curve.end.x) / 2,
        (layout.curve.start.y + layout.curve.end.y) / 2
      )
    }
  ]
});

export const createExecutableRendererPlugin = (): RendererPlugin => ({
  name: "sample-executable-renderer-plugin",
  interactionHandlers: [
    {
      id: "inspect-executable-node",
      description: "Marks pointer events that target executable graph visuals."
    }
  ],
  decorateNodeLayout: (layout, node) => {
    if (node.type === "number") {
      return {
        ...withNodeBadge(layout, "SRC", "#d97706"),
        headerColor: "#f59e0b",
        bodyColor: "#fff7ed"
      };
    }

    if (node.type === "math") {
      return {
        ...withNodeBadge(layout, "EXEC", "#0f766e"),
        headerColor: "#14b8a6",
        bodyColor: "#ecfeff"
      };
    }

    if (node.type === "display") {
      return {
        ...withNodeBadge(layout, "OUT", "#2563eb"),
        headerColor: "#60a5fa",
        bodyColor: "#eff6ff"
      };
    }

    return layout;
  },
  decorateEdgeLayout: (layout) => withEdgeLabel(layout, "data"),
  createOverlays: ({ snapshot, nodes }) =>
    nodes.map((node) => ({
      id: `overlay:${node.id}`,
      kind: "text",
      label: `plugin:${node.id}`,
      color: "#334155",
      position: vec2(node.position.x, node.position.y - 20),
      text: `${snapshot.metadata.name}:${node.label}`
    }))
});

export const createAnnotationRendererPlugin = (): RendererPlugin => ({
  name: "sample-annotation-renderer-plugin",
  decorateNodeLayout: (layout, node) => {
    if (node.type !== "annotation") {
      return layout;
    }

    return {
      ...withNodeBadge(layout, "NOTE", "#7c3aed"),
      headerColor: "#ddd6fe",
      bodyColor: "#f5f3ff",
      borderColor: "#7c3aed"
    };
  },
  createOverlays: ({ nodes }) =>
    nodes
      .filter((node) => node.type === "annotation")
      .map((node) => ({
        id: `annotation:${node.id}`,
        kind: "text",
        label: `annotation:${node.id}`,
        color: "#6d28d9",
        position: vec2(node.position.x, node.position.y + node.size.y + 18),
        text: "Annotation nodes are read-only documentation helpers."
      }))
});

export const pluginRegistry = [
  "sample-executable-node-plugin",
  "sample-executable-renderer-plugin",
  "sample-annotation-node-plugin",
  "sample-annotation-renderer-plugin"
] as const;
