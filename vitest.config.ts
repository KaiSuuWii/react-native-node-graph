import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@react-native-node-graph/shared": fromRoot("./packages/shared/src/index.ts"),
      "@react-native-node-graph/core": fromRoot("./packages/core/src/index.ts"),
      "@react-native-node-graph/renderer-skia": fromRoot("./packages/renderer-skia/src/index.ts"),
      "@react-native-node-graph/renderer-svg": fromRoot("./packages/renderer-svg/src/index.ts"),
      "@react-native-node-graph/renderer-web": fromRoot("./packages/renderer-web/src/index.ts"),
      "@react-native-node-graph/examples": fromRoot("./packages/examples/src/index.ts"),
      "@react-native-node-graph/plugins": fromRoot("./packages/plugins/src/index.ts"),
      "@react-native-node-graph/docs": fromRoot("./packages/docs/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/tests/**/*.test.ts", "tests/**/*.test.ts"]
  }
});
