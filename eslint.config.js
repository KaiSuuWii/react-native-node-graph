import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

const restrictedCoreImports = [
  "react-native",
  "@shopify/react-native-skia",
  "react",
  "react-dom",
  "@kaiisuuwii/renderer-skia",
  "@kaiisuuwii/renderer-svg",
  "@kaiisuuwii/renderer-web"
];

const restrictedSharedImports = [
  "react-native",
  "@shopify/react-native-skia",
  "react",
  "react-dom",
  "@kaiisuuwii/core",
  "@kaiisuuwii/renderer-skia",
  "@kaiisuuwii/renderer-svg",
  "@kaiisuuwii/renderer-web"
];

export default [
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/*.d.ts"]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs["recommended-type-checked"].rules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports"
        }
      ]
    }
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: restrictedCoreImports,
          patterns: ["packages/renderer-*"]
        }
      ]
    }
  },
  {
    files: ["packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: restrictedSharedImports,
          patterns: ["packages/core", "packages/renderer-*"]
        }
      ]
    }
  }
];
