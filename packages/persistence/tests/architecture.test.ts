import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("persistence package boundaries", () => {
  it("does not import renderers or platform packages", () => {
    const sourceFiles = [
      "packages/persistence/src/index.ts",
      "packages/persistence/src/types.ts",
      "packages/persistence/src/utils.ts",
      "packages/persistence/src/persistence.ts",
      "packages/persistence/src/adapters/async-storage.ts",
      "packages/persistence/src/adapters/local-storage.ts",
      "packages/persistence/src/adapters/file-system.ts",
      "packages/persistence/src/adapters/memory.ts",
      "packages/persistence/src/adapters/index-helper.ts"
    ].map(readSource).join("\n");

    expect(sourceFiles).not.toContain("@kaiisuuwii/renderer-skia");
    expect(sourceFiles).not.toContain("@kaiisuuwii/renderer-svg");
    expect(sourceFiles).not.toContain("@kaiisuuwii/renderer-web");
    expect(sourceFiles).not.toContain("react-native");
    expect(sourceFiles).not.toContain('from "react"');
  });
});
