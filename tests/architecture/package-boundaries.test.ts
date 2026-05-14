import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  private?: boolean;
  publishConfig?: {
    access?: string;
    registry?: string;
  };
  repository?: {
    url?: string;
  };
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

    expect(dependencyNames).toContain("@kaiisuuwii/shared");
    expect(dependencyNames).not.toContain("react-native");
    expect(dependencyNames).not.toContain("@shopify/react-native-skia");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-skia");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-svg");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-web");
  });

  it("limits renderer-skia to shared and core contracts", () => {
    const manifest = readPackage("packages/renderer-skia/package.json");
    const dependencyNames = Object.keys(manifest.dependencies ?? {});

    expect(dependencyNames.sort()).toEqual(
      ["@kaiisuuwii/core", "@kaiisuuwii/shared"].sort()
    );
  });

  it("keeps persistence isolated from renderers and platform packages", () => {
    const manifest = readPackage("packages/persistence/package.json");
    const dependencyNames = Object.keys(manifest.dependencies ?? {});

    expect(dependencyNames.sort()).toEqual(
      ["@kaiisuuwii/core", "@kaiisuuwii/shared"].sort()
    );
    expect(dependencyNames).not.toContain("react");
    expect(dependencyNames).not.toContain("react-native");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-skia");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-svg");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-web");
  });

  it("keeps sync isolated from renderers and platform packages", () => {
    const manifest = readPackage("packages/sync/package.json");
    const dependencyNames = Object.keys(manifest.dependencies ?? {});

    expect(dependencyNames.sort()).toEqual(
      ["@kaiisuuwii/core", "@kaiisuuwii/shared"].sort()
    );
    expect(dependencyNames).not.toContain("react");
    expect(dependencyNames).not.toContain("react-native");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-skia");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-svg");
    expect(dependencyNames).not.toContain("@kaiisuuwii/renderer-web");
  });

  it("keeps publishable package metadata ready for npm release", () => {
    const packagePaths = [
      "packages/shared/package.json",
      "packages/core/package.json",
      "packages/renderer-skia/package.json",
      "packages/renderer-svg/package.json",
      "packages/renderer-web/package.json",
      "packages/plugins/package.json",
      "packages/react-native/package.json",
      "packages/sync/package.json",
      "packages/persistence/package.json"
    ];

    packagePaths.forEach((packagePath) => {
      const manifest = readPackage(packagePath);

      expect(manifest.private).toBe(false);
      expect(manifest.publishConfig?.access).toBe("public");
      expect(manifest.publishConfig?.registry).toBe("https://registry.npmjs.org/");
      expect(manifest.repository?.url).toBe(
        "https://github.com/KaiSuuWii/react-native-node-graph.git"
      );
    });
  });

  it("keeps docs and examples workspace-only", () => {
    const packagePaths = [
      "packages/examples/package.json",
      "packages/docs/package.json"
    ];

    packagePaths.forEach((packagePath) => {
      const manifest = readPackage(packagePath);

      expect(manifest.private).toBe(true);
      expect(manifest.publishConfig).toBeUndefined();
      expect(manifest.repository?.url).toBe(
        "https://github.com/KaiSuuWii/react-native-node-graph.git"
      );
    });
  });
});
