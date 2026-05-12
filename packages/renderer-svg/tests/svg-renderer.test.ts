import { createGraphSnapshot } from "@kaiisuuwii/core";
import { vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";

import { computeSvgViewBox, createSvgCameraState } from "../src/camera.js";
import { bezierPathD } from "../src/elements.js";
import {
  buildEdgeLayout,
  buildNodeLayout,
  createSvgEdgeElements,
  createSvgNodeElements
} from "../src/layout.js";
import { serializeSvgElement, serializeSvgRenderPlan } from "../src/serialize.js";
import { DARK_SVG_THEME, LIGHT_SVG_THEME } from "../src/theme.js";
import { createSvgRenderPlan } from "../src/index.js";
import type { SvgCubicBezierCurve, SvgRendererPlugin } from "../src/types.js";

const makeSnapshot = (nodeCount = 3) => {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node_test_${i}` as const,
    type: i === 0 ? "number" : i === nodeCount - 1 ? "display" : "math",
    position: vec2(120 + i * 260, 180),
    dimensions: vec2(220, 96),
    label: `Node ${i}`,
    ports:
      i === 0
        ? [{ id: `port_out_${i}`, name: "out", direction: "output" as const, dataType: "number" }]
        : i === nodeCount - 1
          ? [{ id: `port_in_${i}`, name: "in", direction: "input" as const, dataType: "number" }]
          : [
              { id: `port_in_${i}`, name: "in", direction: "input" as const, dataType: "number" },
              { id: `port_out_${i}`, name: "out", direction: "output" as const, dataType: "number" }
            ]
  }));

  const edges = Array.from({ length: Math.max(0, nodeCount - 1) }, (_, i) => ({
    id: `edge_test_${i}` as const,
    source: `node_test_${i}` as const,
    target: `node_test_${i + 1}` as const,
    sourcePortId: `port_out_${i}`,
    targetPortId: `port_in_${i + 1}`,
    dataType: "number"
  }));

  return createGraphSnapshot({
    id: "graph_test_snap",
    metadata: {
      name: "Test",
      version: "0.1.0",
      tags: [],
      createdAtIso: "2026-05-11T00:00:00.000Z"
    },
    nodes,
    edges,
    groups: [],
    selection: { nodeIds: [], edgeIds: [], groupIds: [], activeSelectionMode: "node" }
  });
};

describe("bezierPathD", () => {
  it("produces correct SVG path string for known control points", () => {
    const curve: SvgCubicBezierCurve = {
      start: vec2(0, 0),
      control1: vec2(50, 0),
      control2: vec2(50, 100),
      end: vec2(100, 100)
    };

    expect(bezierPathD(curve)).toBe("M 0 0 C 50 0 50 100 100 100");
  });

  it("handles negative coordinates", () => {
    const curve: SvgCubicBezierCurve = {
      start: vec2(-10, -20),
      control1: vec2(0, -20),
      control2: vec2(0, 30),
      end: vec2(10, 30)
    };

    expect(bezierPathD(curve)).toBe("M -10 -20 C 0 -20 0 30 10 30");
  });
});

describe("computeSvgViewBox", () => {
  it("produces correct viewBox for identity camera", () => {
    const camera = createSvgCameraState({ position: vec2(0, 0), zoom: 1 });
    const viewport = { width: 1280, height: 720 };

    expect(computeSvgViewBox(camera, viewport)).toBe("0 0 1280 720");
  });

  it("produces correct viewBox for zoomed and panned camera", () => {
    const camera = createSvgCameraState({ position: vec2(100, 50), zoom: 2 });
    const viewport = { width: 1280, height: 720 };

    expect(computeSvgViewBox(camera, viewport)).toBe("100 50 640 360");
  });

  it("produces correct viewBox for zoom-out camera", () => {
    const camera = createSvgCameraState({ position: vec2(0, 0), zoom: 0.5 });
    const viewport = { width: 800, height: 600 };

    expect(computeSvgViewBox(camera, viewport)).toBe("0 0 1600 1200");
  });
});

describe("createSvgNodeElements", () => {
  it("emits rect, header, label, and port elements", () => {
    const node = {
      id: "node_test_0" as const,
      type: "math",
      position: vec2(100, 100),
      dimensions: vec2(220, 96),
      label: "Test Node",
      ports: [
        { id: "port_a", name: "a", direction: "input" as const, dataType: "number" },
        { id: "port_b", name: "b", direction: "output" as const, dataType: "number" }
      ],
      properties: {},
      groupId: undefined
    };
    const layout = buildNodeLayout(node, LIGHT_SVG_THEME, false);
    const elements = createSvgNodeElements(layout, LIGHT_SVG_THEME, {
      enabled: true,
      addAriaLabels: true,
      addTitleElements: true,
      addRoleAttributes: true
    });

    const svg = elements.map(serializeSvgElement).join("");

    expect(svg).toContain("<rect");
    expect(svg).toContain("<text");
    expect(svg).toContain("Test Node");
    expect(svg).toContain("<circle");
  });

  it("emits aria-label when addAriaLabels is true", () => {
    const node = {
      id: "node_test_1" as const,
      type: "math",
      position: vec2(0, 0),
      dimensions: vec2(200, 80),
      label: "My Node",
      ports: [],
      properties: {},
      groupId: undefined
    };
    const layout = buildNodeLayout(node, LIGHT_SVG_THEME, false);
    const elements = createSvgNodeElements(layout, LIGHT_SVG_THEME, {
      enabled: true,
      addAriaLabels: true,
      addTitleElements: false,
      addRoleAttributes: true
    });
    const svg = elements.map(serializeSvgElement).join("");

    expect(svg).toContain('aria-label=');
    expect(svg).toContain("My Node");
  });
});

describe("createSvgEdgeElements", () => {
  it("emits bezier path with correct d attribute", () => {
    const snapshot = makeSnapshot(2);
    const edge = snapshot.edges[0]!;
    const layout = buildEdgeLayout(edge, snapshot, LIGHT_SVG_THEME, false);

    expect(layout).toBeDefined();

    if (layout === undefined) {
      return;
    }

    const elements = createSvgEdgeElements(layout, LIGHT_SVG_THEME);
    const svg = elements.map(serializeSvgElement).join("");

    expect(svg).toContain("<path");
    expect(svg).toContain('d="M');
    expect(svg).toContain(" C ");
  });

  it("emits selection highlight when edge is selected", () => {
    const snapshot = makeSnapshot(2);
    const edge = snapshot.edges[0]!;
    const layout = buildEdgeLayout(edge, snapshot, LIGHT_SVG_THEME, true);

    expect(layout).toBeDefined();

    if (layout === undefined) {
      return;
    }

    expect(layout.selected).toBe(true);
    const elements = createSvgEdgeElements(layout, LIGHT_SVG_THEME);

    expect(elements.length).toBeGreaterThan(1);
  });
});

describe("serializeSvgElement", () => {
  it("escapes special characters in text content", () => {
    const el = {
      kind: "text" as const,
      x: 0,
      y: 0,
      content: "A & B < C > D"
    };

    expect(serializeSvgElement(el)).toContain("A &amp; B &lt; C &gt; D");
  });

  it("escapes special characters in attribute values", () => {
    const el = {
      kind: "rect" as const,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fill: "rgba(0,0,0,0.5)"
    };

    const result = serializeSvgElement(el);

    expect(result).toContain("<rect");
    expect(result).not.toContain("&amp;");
  });

  it("serializes group with children recursively", () => {
    const el = {
      kind: "group" as const,
      children: [
        { kind: "rect" as const, x: 0, y: 0, width: 10, height: 10 },
        { kind: "circle" as const, cx: 5, cy: 5, r: 3 }
      ]
    };

    const result = serializeSvgElement(el);

    expect(result).toContain("<g");
    expect(result).toContain("<rect");
    expect(result).toContain("<circle");
    expect(result).toContain("</g>");
  });

  it("serializes clipPath element", () => {
    const el = {
      kind: "clipPath" as const,
      id: "clip-1",
      children: [{ kind: "rect" as const, x: 0, y: 0, width: 50, height: 50 }]
    };

    const result = serializeSvgElement(el);

    expect(result).toContain('<clipPath id="clip-1">');
    expect(result).toContain("</clipPath>");
  });
});

describe("serializeSvgRenderPlan", () => {
  it("opens and closes the <svg> root correctly", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(2),
      viewport: { width: 800, height: 600 }
    });
    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toMatch(/^<\?xml/);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="graph"');
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("emits defs block with arrow marker", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(2),
      viewport: { width: 800, height: 600 }
    });
    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toContain("<defs>");
    expect(svg).toContain("</defs>");
    expect(svg).toContain('id="svg-arrowhead"');
  });

  it("emits data-layer attributes for each layer kind", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(3),
      viewport: { width: 1280, height: 720 }
    });
    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toContain('data-layer="background"');
    expect(svg).toContain('data-layer="node"');
    expect(svg).toContain('data-layer="edge"');
  });
});

describe("viewport culling", () => {
  it("nodes far outside viewport bounds are absent from the element tree", () => {
    const nodes = [
      {
        id: "node_test_0" as const,
        type: "number",
        position: vec2(0, 0),
        dimensions: vec2(220, 96),
        label: "Visible",
        ports: [],
        properties: {}
      },
      {
        id: "node_test_1" as const,
        type: "display",
        position: vec2(50000, 50000),
        dimensions: vec2(220, 96),
        label: "Hidden",
        ports: [],
        properties: {}
      }
    ];
    const snapshot = createGraphSnapshot({
      id: "graph_test_snap",
      metadata: {
        name: "Cull Test",
        version: "0.1.0",
        tags: [],
        createdAtIso: "2026-05-11T00:00:00.000Z"
      },
      nodes,
      edges: [],
      groups: [],
      selection: { nodeIds: [], edgeIds: [], groupIds: [], activeSelectionMode: "node" }
    });

    const plan = createSvgRenderPlan({
      snapshot,
      viewport: { width: 1280, height: 720 },
      camera: { position: vec2(0, 0), zoom: 1 },
      virtualization: {
        enabled: true,
        cullOffscreenNodes: true,
        cullOffscreenEdges: true,
        viewportPaddingFactor: 1.2
      }
    });

    expect(plan.diagnostics.visibleNodeCount).toBe(1);
    expect(plan.diagnostics.culledNodeCount).toBe(1);

    const nodeLayer = plan.layers.find((l) => l.kind === "node");
    const svg = nodeLayer?.elements.map(serializeSvgElement).join("") ?? "";

    expect(svg).toContain("Visible");
    expect(svg).not.toContain("Hidden");
  });

  it("selected nodes are preserved even when offscreen", () => {
    const nodes = [
      {
        id: "node_test_0" as const,
        type: "number",
        position: vec2(50000, 50000),
        dimensions: vec2(220, 96),
        label: "Selected Offscreen",
        ports: [],
        properties: {}
      }
    ];
    const snapshot = createGraphSnapshot({
      id: "graph_test_snap",
      metadata: {
        name: "Selection Test",
        version: "0.1.0",
        tags: [],
        createdAtIso: "2026-05-11T00:00:00.000Z"
      },
      nodes,
      edges: [],
      groups: [],
      selection: {
        nodeIds: ["node_test_0"],
        edgeIds: [],
        groupIds: [],
        activeSelectionMode: "node"
      }
    });

    const plan = createSvgRenderPlan({
      snapshot,
      viewport: { width: 1280, height: 720 },
      camera: { position: vec2(0, 0), zoom: 1 },
      virtualization: {
        enabled: true,
        cullOffscreenNodes: true,
        cullOffscreenEdges: true,
        viewportPaddingFactor: 1.2
      }
    });

    expect(plan.diagnostics.visibleNodeCount).toBe(1);
  });
});

describe("plugin overlays", () => {
  it("plugin overlays appear in the plugin layer", () => {
    const testPlugin: SvgRendererPlugin = {
      name: "test-overlay-plugin",
      createOverlays: ({ camera }) => [
        {
          id: "overlay-0",
          kind: "text",
          label: "status",
          color: "#ff0000",
          position: vec2(camera.position.x + 10, camera.position.y + 10),
          text: "Plugin Overlay Active"
        }
      ]
    };

    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(2),
      viewport: { width: 1280, height: 720 },
      plugins: [testPlugin]
    });

    const pluginLayer = plan.layers.find((l) => l.kind === "plugin");

    expect(pluginLayer).toBeDefined();
    expect(pluginLayer!.elements.length).toBeGreaterThan(0);

    const svg = pluginLayer!.elements.map(serializeSvgElement).join("");

    expect(svg).toContain("Plugin Overlay Active");
  });
});

describe("theming", () => {
  it("dark theme changes node colors from light theme", () => {
    const snapshot = makeSnapshot(2);

    const lightPlan = createSvgRenderPlan({
      snapshot,
      viewport: { width: 1280, height: 720 },
      themeMode: "light"
    });

    const darkPlan = createSvgRenderPlan({
      snapshot,
      viewport: { width: 1280, height: 720 },
      themeMode: "dark"
    });

    const lightNodeSvg = lightPlan.layers
      .find((l) => l.kind === "node")!
      .elements.map(serializeSvgElement)
      .join("");

    const darkNodeSvg = darkPlan.layers
      .find((l) => l.kind === "node")!
      .elements.map(serializeSvgElement)
      .join("");

    expect(lightNodeSvg).toContain(LIGHT_SVG_THEME.nodeHeaderColor);
    expect(darkNodeSvg).toContain(DARK_SVG_THEME.nodeHeaderColor);
    expect(lightNodeSvg).not.toContain(DARK_SVG_THEME.nodeHeaderColor);
  });
});

describe("accessibility", () => {
  it("includes title elements for accessibility when addTitleElements is true", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(2),
      viewport: { width: 1280, height: 720 },
      accessibility: {
        enabled: true,
        addAriaLabels: true,
        addTitleElements: true,
        addRoleAttributes: true
      }
    });

    expect(Object.keys(plan.accessibility.titleById).length).toBeGreaterThan(0);
  });

  it("buildsSvgRenderScene returns focus order sorted by position", () => {
    const snapshot = createGraphSnapshot({
      id: "graph_test_snap",
      metadata: {
        name: "Accessibility Test",
        version: "0.1.0",
        tags: [],
        createdAtIso: "2026-05-11T00:00:00.000Z"
      },
      nodes: [
        {
          id: "node_test_1" as const,
          type: "math",
          position: vec2(400, 100),
          dimensions: vec2(220, 96),
          label: "Right Node",
          ports: []
        },
        {
          id: "node_test_0" as const,
          type: "number",
          position: vec2(100, 100),
          dimensions: vec2(220, 96),
          label: "Left Node",
          ports: []
        }
      ],
      edges: [],
      groups: [],
      selection: { nodeIds: [], edgeIds: [], groupIds: [], activeSelectionMode: "node" }
    });

    const plan = createSvgRenderPlan({
      snapshot,
      viewport: { width: 1280, height: 720 }
    });

    const [firstId, secondId] = plan.accessibility.focusOrder;

    expect(firstId).toBe("node_test_0");
    expect(secondId).toBe("node_test_1");
  });
});

describe("integration: createSvgRenderPlan + serializeSvgRenderPlan", () => {
  it("round-trip produces valid SVG for small fixture (3 nodes)", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(3),
      viewport: { width: 1280, height: 720 }
    });
    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg.indexOf("<svg")).toBeLessThan(svg.indexOf("</svg>"));
  });

  it("round-trip produces valid SVG for medium fixture (6 nodes)", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(6),
      viewport: { width: 1280, height: 720 }
    });
    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toContain("data-layer=\"node\"");
    expect(svg).toContain("data-layer=\"edge\"");
  });

  it("round-trip produces valid SVG for large fixture (10 nodes)", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(10),
      viewport: { width: 1280, height: 720 }
    });
    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toContain("data-layer=\"node\"");
    expect(plan.diagnostics.visibleNodeCount).toBeGreaterThan(0);
  });

  it("all 8 layer kinds are present in the plan", () => {
    const plan = createSvgRenderPlan({
      snapshot: makeSnapshot(3),
      viewport: { width: 1280, height: 720 }
    });
    const kinds = plan.layers.map((l) => l.kind);

    expect(kinds).toContain("background");
    expect(kinds).toContain("grid");
    expect(kinds).toContain("group");
    expect(kinds).toContain("edge");
    expect(kinds).toContain("node");
    expect(kinds).toContain("selection");
    expect(kinds).toContain("plugin");
    expect(kinds).toContain("debug");
  });
});

describe("architecture: renderer-svg imports", () => {
  it("does not import from react, react-native, or @shopify/react-native-skia", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const srcDir = path.resolve(process.cwd(), "packages/renderer-svg/src");
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

    const forbidden = ["react-native", "@shopify/react-native-skia", "react"];

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), "utf8");

      for (const pkg of forbidden) {
        const pattern = new RegExp(
          `from\\s+["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`
        );
        const hasImport = pattern.test(content);

        expect(hasImport, `${file} should not import from ${pkg}`).toBe(false);
      }
    }
  });
});
