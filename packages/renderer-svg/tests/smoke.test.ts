import { rendererSvgEntryPoint } from "@kaiisuuwii/renderer-svg";
import { describe, expect, it } from "vitest";

describe("renderer-svg public api", () => {
  it("exposes a minimal entry point", () => {
    expect(rendererSvgEntryPoint).toBe("renderer-svg");
  });
});
