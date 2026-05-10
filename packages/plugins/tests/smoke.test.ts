import { createCoreEngine } from "@kaiisuuwii/core";
import { createSkiaRenderPlan } from "@kaiisuuwii/renderer-skia";
import {
  createAnnotationNodePlugin,
  createAnnotationRendererPlugin,
  createExecutableNodePlugin,
  createExecutableRendererPlugin,
  pluginRegistry
} from "@kaiisuuwii/plugins";
import { createGraphId, vec2 } from "@kaiisuuwii/shared";
import { describe, expect, it } from "vitest";

describe("plugins public api", () => {
  it("exposes the sample plugin registry", () => {
    expect(pluginRegistry).toEqual([
      "sample-executable-node-plugin",
      "sample-executable-renderer-plugin",
      "sample-annotation-node-plugin",
      "sample-annotation-renderer-plugin"
    ]);
  });

  it("executes sample plugin node types and decorates renderer output", async () => {
    const engine = createCoreEngine({
      graph: {
        id: createGraphId("plugin-execution"),
        metadata: {
          name: "Plugin Execution",
          version: "0.1.0",
          tags: ["plugins"],
          createdAtIso: "2026-05-10T00:00:00.000Z"
        }
      },
      plugins: [createExecutableNodePlugin()]
    });
    const source = engine.createNode({
      type: "number",
      position: vec2(0, 0),
      properties: { value: 9 }
    });
    const math = engine.createNode({
      type: "math",
      position: vec2(200, 0)
    });
    const sink = engine.createNode({
      type: "display",
      position: vec2(420, 0)
    });

    engine.createEdge({
      source: source.id,
      target: math.id,
      sourcePortId: "port_source_out",
      targetPortId: "port_mix_in_a"
    });
    engine.createEdge({
      source: math.id,
      target: sink.id,
      sourcePortId: "port_mix_out",
      targetPortId: "port_sink_in"
    });

    const execution = await engine.execute().result;
    const plan = createSkiaRenderPlan({
      snapshot: engine.getSnapshot(),
      interaction: { onEvent: () => undefined },
      viewport: {
        width: 800,
        height: 600
      },
      plugins: [createExecutableRendererPlugin()]
    });

    expect(execution.status).toBe("completed");
    expect(execution.nodeResults[sink.id]?.outputs).toEqual({ port_sink_in: 9 });
    expect(plan.nodes[0]?.pluginVisuals.length).toBeGreaterThan(0);
    expect(plan.scene.layers.map((layer) => layer.kind)).toContain("plugin");

    const annotationEngine = createCoreEngine({
      plugins: [createExecutableNodePlugin(), createAnnotationNodePlugin()]
    });

    const annotation = annotationEngine.createNode({
      type: "annotation",
      position: vec2(40, 160),
      label: "Docs",
      properties: { note: "Annotation nodes decorate examples." }
    });
    const annotationPlan = createSkiaRenderPlan({
      snapshot: annotationEngine.getSnapshot(),
      interaction: { onEvent: () => undefined },
      viewport: {
        width: 800,
        height: 600
      },
      plugins: [createAnnotationRendererPlugin()]
    });

    expect(annotation.type).toBe("annotation");
    expect(annotationPlan.nodes.find((node) => node.id === annotation.id)?.pluginVisuals.length).toBe(1);
  });
});
