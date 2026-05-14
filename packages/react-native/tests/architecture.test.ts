import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("react-native package boundaries", () => {
  it("does not import forbidden higher-level packages", () => {
    const sourceFiles = [
      "packages/react-native/src/index.ts",
      "packages/react-native/src/NodeGraphCanvas.ts",
      "packages/react-native/src/gestures.ts",
      "packages/react-native/src/hooks/useCamera.ts",
      "packages/react-native/src/hooks/useDragNode.ts",
      "packages/react-native/src/hooks/useGraphEditor.ts",
      "packages/react-native/src/animations/useConnectionWire.ts",
      "packages/react-native/src/animations/useSelectionPulse.ts",
      "packages/react-native/src/types.ts"
    ].map(readSource).join("\n");

    expect(sourceFiles).not.toContain("@kaiisuuwii/layout");
    expect(sourceFiles).not.toContain("@kaiisuuwii/persistence");
    expect(sourceFiles).not.toContain("@kaiisuuwii/sync");
  });
});
