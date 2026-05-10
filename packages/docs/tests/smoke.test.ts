import { docsManifest } from "@react-native-node-graph/docs";
import { describe, expect, it } from "vitest";

describe("docs public api", () => {
  it("exposes a minimal manifest", () => {
    expect(docsManifest.sprint).toBe("foundation-and-architecture");
  });
});
