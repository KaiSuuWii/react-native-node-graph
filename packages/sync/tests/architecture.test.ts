import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("sync package boundaries", () => {
  it("does not import renderers or platform packages", () => {
    const sourceFiles = [
      "packages/sync/src/index.ts",
      "packages/sync/src/types.ts",
      "packages/sync/src/yjsModel.ts",
      "packages/sync/src/bridge.ts",
      "packages/sync/src/offlineQueue.ts",
      "packages/sync/src/awareness.ts",
      "packages/sync/src/sync.ts",
      "packages/sync/src/adapters/websocket.ts",
      "packages/sync/src/adapters/webrtc.ts"
    ].map(readSource).join("\n");

    expect(sourceFiles).not.toContain("@kaiisuuwii/renderer-skia");
    expect(sourceFiles).not.toContain("@kaiisuuwii/renderer-svg");
    expect(sourceFiles).not.toContain("@kaiisuuwii/renderer-web");
    expect(sourceFiles).not.toContain("react-native");
    expect(sourceFiles).not.toContain('from "react"');
  });
});
