import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@kaiisuuwii/shared": fromRoot("./packages/shared/src/index.ts"),
      "@kaiisuuwii/core": fromRoot("./packages/core/src/index.ts"),
      "@kaiisuuwii/renderer-skia": fromRoot("./packages/renderer-skia/src/index.ts"),
      "@kaiisuuwii/renderer-svg": fromRoot("./packages/renderer-svg/src/index.ts"),
      "@kaiisuuwii/renderer-web": fromRoot("./packages/renderer-web/src/index.ts"),
      "@kaiisuuwii/examples": fromRoot("./packages/examples/src/index.ts"),
      "@kaiisuuwii/plugins": fromRoot("./packages/plugins/src/index.ts"),
      "@kaiisuuwii/docs": fromRoot("./packages/docs/src/index.ts"),
      "@kaiisuuwii/layout": fromRoot("./packages/layout/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/tests/**/*.test.ts", "tests/**/*.test.ts"]
  }
});
