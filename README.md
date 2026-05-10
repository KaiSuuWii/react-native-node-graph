# react-native-node-graph

Renderer-agnostic graph toolkit for React Native-oriented node editors, with a deterministic core engine, renderer adapters, plugin extension points, and example fixtures.

## Workspace Commands

1. `npm install`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test`
5. `npm run benchmark:renderer`

## Packages

- `@react-native-node-graph/shared`: ID helpers, geometry primitives, and shared graph metadata contracts.
- `@react-native-node-graph/core`: Graph CRUD, validation, history, execution, plugins, and serialization.
- `@react-native-node-graph/renderer-skia`: Scene planning, camera math, theme switching, accessibility descriptors, diagnostics, and editor interaction helpers.
- `@react-native-node-graph/renderer-svg`: SVG renderer workspace placeholder.
- `@react-native-node-graph/renderer-web`: Web renderer workspace placeholder.
- `@react-native-node-graph/plugins`: Sample executable-node and annotation plugin implementations.
- `@react-native-node-graph/examples`: Example fixtures and an example app model with theme, validation, and import/export toggles.
- `@react-native-node-graph/docs`: Architecture and release documentation with executable API examples.

## Sprint 08 Highlights

- Light and dark renderer themes with runtime scale switching.
- Deterministic accessibility metadata in render plans, including focus order and screen reader labels.
- Expanded example fixtures for small, medium, large, invalid, custom-node, and plugin scenarios.
- Example-app developer toggles for validation overlays, debug overlays, theme switching, and import/export flows.
- Release hardening through docs-backed examples, renderer theme tests, example integration tests, and CI commands.

## Publishing Notes

Workspace packages are prepared for public npm publication with `exports`, `files`, `license`, `repository`, and `publishConfig.access` metadata. The root package remains private so the monorepo shell is not published.

For GitHub Packages, the official npm-registry guidance also requires:

- Lowercase scoped package names.
- A correct `repository` URL in each `package.json`.
- Either a scope-mapped `.npmrc` or `publishConfig.registry` entry.
- A scope that matches the publishing GitHub user or organization.

This repository already includes the repository metadata. If you publish to GitHub Packages instead of npmjs, confirm that the `@react-native-node-graph/*` scope matches the target GitHub namespace before publishing.

See `REPOSITORY_CONVENTIONS.md` for package boundaries and layout rules.
