import { rendererWebEntryPoint } from "@kaiisuuwii/renderer-web";
import { describe, expect, it } from "vitest";

describe("renderer-web public api", () => {
  it("exposes a minimal entry point", () => {
    expect(rendererWebEntryPoint).toBe("renderer-web");
  });
});
