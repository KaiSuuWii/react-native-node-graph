import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
};

const readPackage = (relativePath: string): PackageManifest => {
  const manifestPath = resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
};

describe("package boundaries", () => {
  it("keeps shared dependency-free", () => {
    const manifest = readPackage("packages/shared/package.json");

    expect(manifest.dependencies ?? {}).toEqual({});
  });

  it("keeps core isolated from renderers and platform packages", () => {
    const manifest = readPackage("packages/core/package.json");
    const dependencyNames = Object.keys(manifest.dependencies ?? {});

    expect(dependencyNames).toContain("@react-native-node-graph/shared");
    expect(dependencyNames).not.toContain("react-native");
    expect(dependencyNames).not.toContain("@shopify/react-native-skia");
    expect(dependencyNames).not.toContain("@react-native-node-graph/renderer-skia");
    expect(dependencyNames).not.toContain("@react-native-node-graph/renderer-svg");
    expect(dependencyNames).not.toContain("@react-native-node-graph/renderer-web");
  });

  it("limits renderer-skia to shared and core contracts", () => {
    const manifest = readPackage("packages/renderer-skia/package.json");
    const dependencyNames = Object.keys(manifest.dependencies ?? {});

    expect(dependencyNames.sort()).toEqual(
      ["@react-native-node-graph/core", "@react-native-node-graph/shared"].sort()
    );
  });
});
