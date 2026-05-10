# react-native-node-graph

Monorepo foundation for a renderer-agnostic graph toolkit with React Native targets.

## Workflow

1. Install dependencies with `npm install`
2. Build packages with `npm run build`
3. Typecheck the workspace with `npm run typecheck`
4. Lint the workspace with `npm run lint`
5. Run tests with `npm run test`

## Packages

- `@react-native-node-graph/shared`: Common IDs, math, metadata, events, and constants.
- `@react-native-node-graph/core`: Renderer-agnostic graph contracts and snapshot primitives.
- `@react-native-node-graph/renderer-skia`: Skia renderer-facing adapter contracts.
- `@react-native-node-graph/renderer-svg`: SVG renderer placeholder entry point.
- `@react-native-node-graph/renderer-web`: Web renderer placeholder entry point.
- `@react-native-node-graph/examples`: Example catalogue manifest placeholder.
- `@react-native-node-graph/plugins`: Plugin registry placeholder.
- `@react-native-node-graph/docs`: Documentation manifest placeholder.

See `REPOSITORY_CONVENTIONS.md` for source, test, benchmark, and fixture layout rules.
