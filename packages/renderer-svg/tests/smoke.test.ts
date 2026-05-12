import { createSvgRenderPlan, serializeSvgRenderPlan } from "@kaiisuuwii/renderer-svg";
import { createGraphSnapshot } from "@kaiisuuwii/core";
import { vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";

describe("renderer-svg public api", () => {
  it("exposes createSvgRenderPlan and serializeSvgRenderPlan", () => {
    const snapshot = createGraphSnapshot({
      id: "graph_smoke_test",
      metadata: {
        name: "Smoke Test",
        version: "0.1.0",
        tags: [],
        createdAtIso: "2026-05-11T00:00:00.000Z"
      },
      nodes: [
        {
          id: "node_smoke_a",
          type: "number",
          position: vec2(100, 100),
          dimensions: vec2(220, 96),
          label: "A",
          ports: []
        }
      ],
      edges: [],
      groups: [],
      selection: { nodeIds: [], edgeIds: [], groupIds: [], activeSelectionMode: "node" }
    });

    const plan = createSvgRenderPlan({
      snapshot,
      viewport: { width: 800, height: 600 }
    });

    expect(plan.layers.length).toBeGreaterThan(0);
    expect(plan.viewBox).toBeDefined();

    const svg = serializeSvgRenderPlan(plan);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
