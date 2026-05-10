# Sprint 01 Changes Log

## Summary

This sprint established the initial monorepo, package boundaries, shared primitives, and root quality gates for `react-native-node-graph`.

## Workspace and tooling

- Added root workspace manifest in `package.json` using npm workspaces for `packages/*`.
- Added root scripts for `build`, `typecheck`, `lint`, `test`, `format`, `format:check`, and `clean`.
- Added TypeScript base config and project references:
  - `tsconfig.base.json`
  - `tsconfig.json`
  - `tsconfig.build.json`
  - `tsconfig.eslint.json`
- Added lint and formatting setup:
  - `eslint.config.js`
  - `.prettierrc.json`
  - `.prettierignore`
- Added test runner config:
  - `vitest.config.ts`
- Installed and locked the baseline dev toolchain in `package.json` and `package-lock.json`.

## Package layout created

- `packages/core`
- `packages/renderer-skia`
- `packages/renderer-svg`
- `packages/renderer-web`
- `packages/shared`
- `packages/examples`
- `packages/plugins`
- `packages/docs`

Each package now includes:

- `package.json`
- `src/index.ts`
- `tests/`
- `benchmarks/`
- `fixtures/`
- `tsconfig.json`
- `tsconfig.build.json`

## Architecture and boundaries

- Defined repository conventions in `REPOSITORY_CONVENTIONS.md`.
- Documented contributor workflow and package intent in `README.md`.
- Enforced source-level import restrictions with ESLint:
  - `shared` cannot import `core` or any renderer package.
  - `core` cannot import renderer packages, React, React Native, or Skia.
- Enforced manifest-level dependency rules with `tests/architecture/package-boundaries.test.ts`:
  - `shared` must remain dependency-free.
  - `core` may only depend on `shared`.
  - `renderer-skia` may only depend on `core` and `shared`.
- Kept `core` and `shared` TypeScript configs free of DOM libs to block DOM API usage at compile time.

## Public API entry points

- Added minimal public entry points for all packages through `src/index.ts`.
- Established the intended stable public APIs for Sprint 02+ in:
  - `packages/shared/src/index.ts`
  - `packages/core/src/index.ts`
  - `packages/renderer-skia/src/index.ts`

## Shared primitives added

Implemented in `packages/shared/src/index.ts`:

- ID types and generators:
  - `GraphId`
  - `NodeId`
  - `EdgeId`
  - `createGraphId`
  - `createNodeId`
  - `createEdgeId`
- Geometry primitives:
  - `Vec2`
  - `Bounds`
  - `vec2`
  - `addVec2`
  - `subtractVec2`
  - `scaleVec2`
  - `boundsFromPoints`
- Shared graph types:
  - `GraphMetadata`
  - `GraphInteractionPhase`
  - `GraphInteractionEventPayload`
- Default constants:
  - `DEFAULT_NODE_SIZE`
  - `DEFAULT_EDGE_WIDTH`
  - `DEFAULT_VIEWPORT_PADDING`

## Core and renderer foundation

- Added renderer-agnostic graph snapshot contracts in `packages/core/src/index.ts`:
  - `GraphNodeSnapshot`
  - `GraphEdgeSnapshot`
  - `GraphSnapshot`
  - `GraphInteractionContract`
  - `createGraphSnapshot`
- Added Skia-facing adapter foundation in `packages/renderer-skia/src/index.ts`:
  - `SkiaRenderNode`
  - `SkiaRenderPlan`
  - `createSkiaRenderPlan`
  - `forwardInteractionEvent`

## Tests added

- Shared unit coverage in `packages/shared/tests/shared.test.ts` for:
  - ID prefix shape
  - practical uniqueness assumptions
  - vector math correctness
  - bounds helper correctness
- Smoke tests for every package public entry point.
- Architecture boundary tests in `tests/architecture/package-boundaries.test.ts`.

## Verified checkpoints

The following commands pass from the repository root:

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run test`

## Notes for later sprints

- `core` is intentionally small and renderer-agnostic. Extend it with graph model behavior, validation, history, and serialization without introducing platform imports.
- `shared` is the correct home for math, IDs, geometry, and cross-package event/type primitives.
- `renderer-skia` already depends only on snapshot and interaction contracts; keep future renderer work behind that seam.
- `renderer-svg`, `renderer-web`, `examples`, `plugins`, and `docs` are placeholders with working package wiring and smoke tests, ready for incremental expansion.

# Sprint 02 Changes Log

## Summary

This sprint turned `@react-native-node-graph/core` from a snapshot stub into a usable, renderer-agnostic graph editing engine with deterministic CRUD, normalized storage, node registries, validation, events, and disposal.

## Core graph model and factories

- Replaced the initial `core` placeholder API in `packages/core/src/index.ts` with graph model types for:
  - `Graph`
  - `Node`
  - `Port`
  - `Edge`
  - `Group`
- Added graph and ID helpers:
  - `createEmptyGraph`
  - `createGraphSnapshot`
  - `createCoreEngine`
  - `createPortId`
  - `createGroupId`
- Preserved the public `GraphSnapshot` contract while extending node and edge shapes for future renderer and serialization work.

## Engine internals and CRUD

- Implemented normalized internal storage in `CoreEngine` with:
  - node map
  - edge map
  - group map
  - port lookup index
  - incoming and outgoing adjacency indices
  - separate selection and history state snapshots
- Added node type registry APIs:
  - `registerNodeType`
  - `getNodeType`
  - `unregisterNodeType`
- Implemented node CRUD:
  - registered-type lookup
  - schema validation hook point
  - type-level property validation hook point
  - port normalization and validation
  - plugin hook stubs for `beforeNodeCreate` and `afterNodeCreate`
  - mutation support for position, dimensions, label, properties, ports, metadata, and group membership
  - cascading edge cleanup and group cleanup on deletion
- Implemented edge CRUD with validation for:
  - source and target node existence
  - source and target port existence
  - source and target direction correctness
  - data type compatibility
  - self-loop policy
  - optional acyclic graph policy
- Added graph loading and lifecycle behavior:
  - read-only snapshot access
  - internal state diagnostics access
  - explicit disposal with listener cleanup

## Events and determinism

- Added core event bus support for:
  - `nodeAdded`
  - `nodeRemoved`
  - `edgeCreated`
  - `edgeDeleted`
  - `graphLoaded`
- Made engine-generated node and edge IDs deterministic per engine instance through local ID factories, which keeps replayed operation sequences structurally identical.

## Tests added and updated

- Added `packages/core/tests/core-engine.test.ts` covering:
  - graph factory initialization
  - node registry registration and lookup
  - node creation validation failures
  - node mutation behavior
  - node deletion cascading edge cleanup
  - edge validation rules
  - adjacency index updates
  - stable CRUD event payloads
  - engine disposal behavior
  - deterministic replay of the same operation sequence
- Updated `packages/renderer-skia/tests/smoke.test.ts` to match the richer node snapshot shape.

## Verified checkpoints

The following commands pass from the repository root:

- `npm run build`
- `npm run typecheck`
- `npm run test`

## Verification note

- `npm run lint` is currently blocked in this Codex sandbox because ESLint's typed `parserOptions.project` resolution is being evaluated against sandbox-mirrored absolute paths rather than the workspace tsconfig root. The implementation issues previously reported by lint were fixed before this environment-level parser failure appeared.

# Sprint 03 Changes Log

## Summary

This sprint made `@react-native-node-graph/core` viable for editing workflows by adding validation reporting, immutable selection state, undo/redo history, transaction batching, and versioned graph serialization.

## Core API and snapshot model

- Extended `packages/core/src/index.ts` exports and `packages/core/src/types.ts` contracts with:
  - validation result types: `ValidationResult`, `ValidationError`, `ValidationWarning`
  - selection contracts: `SelectionSnapshot`, `SelectionChangeMode`, `ActiveSelectionMode`
  - history command contract: `HistoryCommand`
  - serialization contracts: `GraphDocumentEnvelope`, `GraphDocument`, `PartialGraphExportOptions`
  - migration contracts: `GraphMigration`, `GraphMigrationRegistry`
- Extended `GraphSnapshot` to include immutable `selection` data so renderer consumers can observe editing state without reading internal engine state.
- Added public core engine methods for:
  - `validateGraph`
  - `importGraph`
  - `exportGraph`
  - `exportPartialGraph`
  - `selectNode`
  - `selectEdge`
  - `selectGroup`
  - `clearSelection`
  - `beginTransaction`
  - `endTransaction`
  - `undo`
  - `redo`

## Validation and selection

- Reworked `packages/core/src/validation.ts` to support non-throwing graph validation results in addition to existing mutation-time guards.
- Added structural validation coverage for:
  - duplicate node, edge, group, and port IDs
  - dangling or invalid edge references
  - malformed group membership
  - invalid selection references
- Added type validation hook points for:
  - node property schema validation
  - execution signature validation during edge validation
- Added immutable selection tracking to graph snapshots and engine state snapshots:
  - selected nodes
  - selected edges
  - selected groups
  - active selection mode resolution
- Added selection operations for replace, additive, toggle, and clear behaviors.
- Added `selectionChanged` event emission with stable snapshot payloads.

## History and serialization

- Reworked `packages/core/src/engine.ts` around deterministic low-level graph mutations used by command-backed history entries.
- Added undo/redo command handling for:
  - node create
  - node update
  - node delete
  - edge create
  - edge delete
- Added transaction batching through `beginTransaction` and `endTransaction`.
- Added drag-style history compression for repeated position/dimension node updates.
- Added versioned graph serialization with:
  - document envelope version `1`
  - full graph export
  - graph import
  - partial graph export derived from the current selection or explicit IDs
- Added `createMigrationRegistry` as the scaffold for future document-version migrations.

## Tests and verification

- Replaced `packages/core/tests/core-engine.test.ts` with sprint-focused coverage for:
  - validation result reporting
  - type validation hooks
  - selection operations and `selectionChanged`
  - undo and redo behavior
  - transaction batching
  - history compression
  - versioned serialization round trips
  - migration registry behavior
  - deterministic command replay
- Fixed `packages/core/package.json` so the workspace-local `npm run test --workspace @react-native-node-graph/core` command resolves tests from the package directory.

## Verified checkpoints

The following commands pass from the repository root:

- `npm run build`
- `npm run typecheck`
- `npm run test`

The following package-local command also passes:

- `npm run test --workspace @react-native-node-graph/core`

# Sprint 04 Changes Log

## Summary

This sprint turned `@react-native-node-graph/renderer-skia` into a real renderer foundation package with camera math, scene composition, node and edge layout helpers, theme and interaction inputs, and a static example graph path that stays fully snapshot-driven.

## Renderer foundation and public API

- Replaced the initial `renderer-skia` placeholder API with a renderer planning surface split across:
  - `packages/renderer-skia/src/types.ts`
  - `packages/renderer-skia/src/theme.ts`
  - `packages/renderer-skia/src/camera.ts`
  - `packages/renderer-skia/src/layout.ts`
  - `packages/renderer-skia/src/scene.ts`
  - `packages/renderer-skia/src/index.ts`
- Added typed renderer contracts for:
  - `NodeGraphRendererProps`
  - `RendererTheme`
  - `RendererInteractionOptions`
  - `RendererPluginPlaceholder`
  - `CameraState`
  - `SkiaRenderScene`
  - expanded `SkiaRenderPlan`
- Kept the renderer input boundary cleanly based on immutable `GraphSnapshot` and `GraphInteractionContract`.

## Camera, transforms, and scene layers

- Added camera helpers for:
  - camera initialization
  - zoom clamping
  - graph-space to screen-space transforms
  - screen-space to graph-space transforms
  - pan updates
  - zoom-around-origin updates
- Added render layout helpers for:
  - node body and header geometry
  - label and port placement
  - port anchor resolution
  - cubic bezier edge curves
  - group bounds expansion
- Added first-pass scene graph composition with ordered layers for:
  - background
  - grid
  - group
  - edge
  - node
  - selection
  - debug
- Added selected and invalid edge styling hooks through render-state-aware edge layout generation.

## Example graph and fixtures

- Expanded `@react-native-node-graph/examples` to depend on the renderer package.
- Added static example assets in:
  - `packages/examples/src/fixtures.ts`
  - `packages/examples/src/screen.ts`
- Added a serialized renderer foundation fixture with:
  - three nodes
  - two edges
  - one group
  - immutable selection state
- Added `createRendererFoundationExampleScreen` as the first static example screen model that loads fixture data without invoking core mutation logic.
- Updated `packages/examples/src/index.ts` manifest exports to include the renderer foundation example.

## Dependency wiring

- Added optional peer dependency wiring in `packages/renderer-skia/package.json` for:
  - `@shopify/react-native-skia`
  - `react-native-reanimated`
  - `react-native-gesture-handler`
- Kept `renderer-skia` runtime dependencies limited to `core` and `shared` so the existing architecture boundary tests remain valid.

## Tests added and updated

- Replaced the old `renderer-skia` smoke test with sprint-focused coverage:
  - `packages/renderer-skia/tests/camera.test.ts`
  - `packages/renderer-skia/tests/layout.test.ts`
  - `packages/renderer-skia/tests/scene.test.ts`
- Added assertions for:
  - transform round trips
  - pan and zoom stability
  - node and port layout placement
  - bezier edge layout generation
  - render layer ordering
  - selection layer composition
- Updated `packages/examples/tests/smoke.test.ts` to verify fixture loading and example screen creation.

## Verified checkpoints

The following validation commands pass from the repository root without requiring `dist` writes:

- `npx tsc -p tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false`

The following package-focused validations also pass:

- `npx tsc -p packages/renderer-skia/tsconfig.json --noEmit --composite false --incremental false`
- `npx tsc -p packages/examples/tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false packages/renderer-skia/tests/camera.test.ts packages/renderer-skia/tests/layout.test.ts packages/renderer-skia/tests/scene.test.ts packages/examples/tests/smoke.test.ts`

## Verification note

- `npm run build`, `npm run typecheck`, and default `npm run test` are currently blocked in this Codex sandbox because TypeScript build mode and Vitest's default config bundler attempt to write to protected output locations such as package `dist` directories, `.tsbuildinfo`, and `node_modules/.vite-temp`.
