import { rendererWebEntryPoint } from "@react-native-node-graph/renderer-web";
import { describe, expect, it } from "vitest";

describe("renderer-web public api", () => {
  it("exposes a minimal entry point", () => {
    expect(rendererWebEntryPoint).toBe("renderer-web");
  });
});
