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

This sprint turned `@kaiisuuwii/core` from a snapshot stub into a usable, renderer-agnostic graph editing engine with deterministic CRUD, normalized storage, node registries, validation, events, and disposal.

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

This sprint made `@kaiisuuwii/core` viable for editing workflows by adding validation reporting, immutable selection state, undo/redo history, transaction batching, and versioned graph serialization.

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
- Fixed `packages/core/package.json` so the workspace-local `npm run test --workspace @kaiisuuwii/core` command resolves tests from the package directory.

## Verified checkpoints

The following commands pass from the repository root:

- `npm run build`
- `npm run typecheck`
- `npm run test`

The following package-local command also passes:

- `npm run test --workspace @kaiisuuwii/core`

# Sprint 04 Changes Log

## Summary

This sprint turned `@kaiisuuwii/renderer-skia` into a real renderer foundation package with camera math, scene composition, node and edge layout helpers, theme and interaction inputs, and a static example graph path that stays fully snapshot-driven.

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

- Expanded `@kaiisuuwii/examples` to depend on the renderer package.
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

# Sprint 05 Changes Log

## Summary

This sprint turned the Skia package from a static renderer foundation into an editor-capable interaction layer with hit testing, a spatial index, gesture-to-command mapping, preview feedback, and an example harness that exercises real core mutations.

## Renderer interaction and hit testing

- Added renderer-side interaction contracts and editor state in `packages/renderer-skia/src/types.ts` for:
  - connection previews
  - marquee selection overlays
  - hit-test results and targets
  - spatial index entries
  - editor controller options and methods
- Added `packages/renderer-skia/src/spatial-index.ts` with a lightweight grid spatial index supporting:
  - inserts
  - updates
  - removals
  - point queries
  - bounds queries
- Added `packages/renderer-skia/src/hit-testing.ts` with:
  - point-in-bounds helpers
  - bounds intersection helpers
  - bezier edge distance sampling
  - scene spatial index construction
  - point hit testing with interaction priority
  - bounds hit testing for marquee selection

## Editor controller and gesture mapping

- Added `packages/renderer-skia/src/editor.ts` with a pure graph editor controller that maps semantic gestures to core engine commands:
  - tap selection for nodes, edges, groups, and canvas clear
  - double tap toggle selection and canvas zoom reset
  - long press marquee initialization
  - drag for node movement and canvas panning
  - pinch zoom through camera math
  - connection preview start, update, commit, and cancel
- Kept editing mutations routed through core APIs:
  - `selectNode`
  - `selectEdge`
  - `selectGroup`
  - `clearSelection`
  - `updateNode`
  - `createEdge`
  - `validateGraph` for preview validation
- Group dragging policy is implemented by dragging member nodes through the same node update path rather than bypassing core rules.

## Scene composition and visual editing feedback

- Extended `packages/renderer-skia/src/scene.ts` to render:
  - edge selection highlights
  - group selection highlights
  - connection preview overlays
  - marquee selection overlays
- Extended interaction options in `packages/renderer-skia/src/theme.ts` with:
  - hit slop
  - edge hit width
  - long press marquee toggle
- Updated `packages/renderer-skia/src/index.ts` exports so the renderer package exposes:
  - the editor controller
  - hit-testing helpers
  - spatial index helpers
  - expanded scene and interaction types

## Example harness

- Updated `packages/examples/src/fixtures.ts` so the foundation fixture has valid group membership on nodes.
- Extended `packages/examples/src/screen.ts` into a real editing harness backed by `createCoreEngine`, exposing:
  - live render plan generation from engine snapshots
  - node selection
  - node dragging
  - edge creation
  - selection clearing

## Tests added

- Added `packages/renderer-skia/tests/spatial-index.test.ts` for:
  - insert/query behavior
  - update/query behavior
  - removal behavior
- Added `packages/renderer-skia/tests/hit-testing.test.ts` for:
  - port priority over node hits
  - edge hit testing
  - deterministic marquee bounds queries
- Added `packages/renderer-skia/tests/editor.test.ts` for:
  - selection gesture to core selection flow
  - node drag updating graph state with undo support
  - invalid connection preview feedback
  - valid edge creation through preview commit
- Updated `packages/renderer-skia/tests/scene.test.ts` for the new interaction layer ordering.
- Updated `packages/examples/tests/smoke.test.ts` to assert the harness can generate a live render plan.

## Verified checkpoints

The following validations pass from the repository root:

- `npx tsc -p packages/core/tsconfig.json --noEmit --composite false --incremental false`
- `npx tsc -p packages/renderer-skia/tsconfig.json --noEmit --composite false --incremental false`
- `npx tsc -p packages/examples/tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false packages/renderer-skia/tests/hit-testing.test.ts packages/renderer-skia/tests/spatial-index.test.ts packages/renderer-skia/tests/editor.test.ts packages/renderer-skia/tests/scene.test.ts packages/renderer-skia/tests/layout.test.ts packages/renderer-skia/tests/camera.test.ts packages/examples/tests/smoke.test.ts`

## Verification note

- `npm run build --workspace @kaiisuuwii/core` and `npm run build --workspace @kaiisuuwii/renderer-skia` remain blocked in this Codex sandbox because writes to package `dist` artifacts and `.tsbuildinfo` files are denied with `EPERM`.

# Sprint 06 Changes Log

## Summary

This sprint added renderer-side virtualization, level-of-detail controls, dirty-region diagnostics, debug overlays, and a deterministic benchmark harness so large graphs can be profiled and reasoned about with measurements instead of guesswork.

## Renderer virtualization and LOD

- Extended `packages/renderer-skia/src/types.ts` with public contracts for:
  - virtualization options
  - debug options
  - node LOD state
  - scene diagnostics
  - debug overlays
- Added default and resolver support in `packages/renderer-skia/src/theme.ts` for:
  - viewport culling padding
  - offscreen node and edge suppression
  - selected-element preservation
  - incremental redraw tracking
  - zoom thresholds for labels, ports, decorations, and edge simplification
- Added `packages/renderer-skia/src/performance.ts` with reusable helpers for:
  - viewport bounds derivation
  - bounds expansion and union
  - curve and item bounds
  - LOD rule selection
  - frame timing estimation
- Reworked `packages/renderer-skia/src/scene.ts` to:
  - cull offscreen nodes, groups, and edges against the graph-space viewport
  - preserve selected elements even when offscreen suppression is enabled
  - simplify edge routing at distant zoom levels
  - suppress port layouts when port LOD is disabled
  - attach per-frame scene diagnostics including visible and culled counts
  - compute dirty redraw bounds by diffing retained scene geometry

## Diagnostics and interaction safety

- Extended `packages/renderer-skia/src/layout.ts` so node layouts carry explicit LOD metadata and edge layouts expose:
  - simplified routing state
  - route points for debug inspection
- Updated `packages/renderer-skia/src/editor.ts` to retain the previous render scene and feed frame timestamps into the scene builder, which enables:
  - incremental redraw diagnostics
  - FPS estimation
- Updated `packages/renderer-skia/src/hit-testing.ts` to share the same geometry helpers used by virtualization and diagnostics so hit regions stay aligned with rendered content.
- Updated `packages/examples/src/screen.ts` so the example harness carries the new renderer configuration surface without changing the editing workflow.

## Benchmark harness

- Added `packages/renderer-skia/src/benchmark.ts` with a deterministic Sprint 06 suite covering:
  - `10k-nodes`
  - `50k-edges`
  - `100k-edge-traversal`
  - `rapid-mutation-replay`
- Added `packages/renderer-skia/benchmarks/README.md` documenting the benchmark surface.
- Added benchmark scripts:
  - root `package.json`: `benchmark:renderer`
  - `packages/renderer-skia/package.json`: `benchmark`

## Tests added and updated

- Added `packages/renderer-skia/tests/performance.test.ts` for:
  - viewport bounds derivation
  - LOD rule selection
- Added `packages/renderer-skia/tests/performance-benchmark.test.ts` to verify the deterministic benchmark suite shape.
- Updated `packages/renderer-skia/tests/scene.test.ts` for:
  - culling behavior
  - edge simplification
  - diagnostics overlays
  - dirty redraw bounds
- Updated `packages/renderer-skia/tests/hit-testing.test.ts` to verify hit testing remains correct with virtualization enabled.
- Updated `packages/renderer-skia/tests/editor.test.ts` to cover redraw invalidation during rapid mutation replay.

## Verified checkpoints

The following validations pass from the repository root:

- `npx tsc -p packages/renderer-skia/tsconfig.json --noEmit --composite false --incremental false`
- `npx tsc -p packages/examples/tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false packages/renderer-skia/tests packages/examples/tests/smoke.test.ts`

## Verification note

- The benchmark test path is intentionally heavier than the unit suite because it executes the full fixed large-graph scenarios in-process. It passed in this environment but materially dominates total test runtime.

# Sprint 07 Changes Log

## Summary

This sprint added a deterministic MVP execution engine to `@kaiisuuwii/core`, replaced placeholder plugin seams with formal core and renderer plugin contracts, and shipped sample plugins plus example coverage proving executable graphs and renderer extensions work without patching the host packages.

## MVP execution policy

- Defined and exposed the initial execution policy in `packages/core/src/types.ts` and `packages/core/src/engine.ts`:
  - graph policy: DAG only
  - ordering policy: pull-based execution
  - async policy: awaitable node execution handlers
  - batching policy: topological levels
  - cache policy: node-output cache keyed by deterministic input and property signatures

## Core execution engine

- Added execution contracts in `packages/core/src/types.ts` for:
  - `ExecutionPolicy`
  - `ExecutionContext`
  - `ExecutionInputs`
  - `ExecutionOutputs`
  - `ExecutionBatch`
  - `ExecutionResult`
  - `ExecutionRunHandle`
  - execution cache and runtime error/result types
- Added `packages/core/src/execution.ts` with deterministic planner helpers for:
  - dependency closure from optional target nodes
  - topological sort
  - batch generation
  - invalid execution order detection
  - execution-time cycle detection
  - required-input validation
- Extended `NodeTypeDefinition` so node types can declare execution handlers and required input ports.
- Extended `createCoreEngine` and `CoreEngine` in `packages/core/src/engine.ts` and `packages/core/src/index.ts` with:
  - `validateExecution`
  - `execute`
  - `invalidateExecutionCache`
  - `getExecutionPolicy`
  - `getExecutionCacheSnapshot`
- Implemented runtime execution behavior for:
  - deterministic node ordering
  - topological batching
  - async coordination with awaited handlers
  - execution cancellation through run handles and `AbortSignal`
  - per-node output caching
  - downstream cache invalidation on node and edge mutations
  - surfaced runtime failures for missing outputs or unresolved dependencies
- Added execution lifecycle events:
  - `executionStarted`
  - `executionCompleted`

## Core plugin system

- Replaced the old option-level hook array with formal graph plugins in `packages/core/src/types.ts`:
  - `GraphPlugin`
  - `GraphPluginContext`
  - `GraphPluginState`
- Added engine plugin APIs in `packages/core/src/engine.ts`:
  - `registerPlugin`
  - `unregisterPlugin`
  - `getPlugins`
- Implemented plugin lifecycle and safety behavior:
  - plugin `initialize`
  - plugin `dispose`
  - duplicate-name rejection
  - cleanup during engine disposal
  - error isolation for failing plugin hooks and cleanup paths

## Renderer plugin scaffold

- Replaced `RendererPluginPlaceholder` in `packages/renderer-skia/src/types.ts` with a real renderer plugin surface:
  - `RendererPlugin`
  - `RendererPluginContext`
  - `RendererPluginDescriptor`
  - `RendererInteractionHandler`
  - plugin node and edge visual metadata types
  - plugin overlay types
- Extended `RenderNodeLayout` and `RenderEdgeLayout` to carry plugin visual annotations.
- Added `ScenePluginLayer` and integrated it in `packages/renderer-skia/src/scene.ts`.
- Applied renderer plugins during scene construction for:
  - custom node visuals
  - custom edge visuals
  - overlays
  - interaction handler descriptors
- Updated `packages/renderer-skia/src/editor.ts` so interaction events can be forwarded to renderer plugins with failure isolation.

## Sample plugins and example integration

- Replaced the placeholder `packages/plugins/src/index.ts` with two sample plugins:
  - `createExecutableNodePlugin`
  - `createExecutableRendererPlugin`
- The sample core plugin registers executable node types for:
  - `number`
  - `math`
  - `display`
- The sample renderer plugin demonstrates:
  - node badges and color overrides
  - edge label decorations
  - text overlays
  - interaction handler registration
- Updated `packages/examples/src/screen.ts` so the example harness:
  - boots with the sample core plugin
  - renders with the sample renderer plugin
  - executes the fixture graph immediately through the new execution engine

## Tests added and updated

- Expanded `packages/core/tests/core-engine.test.ts` with coverage for:
  - execution validation for cycles and missing inputs
  - deterministic DAG execution
  - cache reuse
  - downstream cache invalidation
  - cancellation behavior
  - execution lifecycle events
  - plugin registration, duplicate rejection, disposal, and error isolation
  - repeated execution determinism
- Updated `packages/renderer-skia/tests/scene.test.ts` to verify:
  - plugin layer ordering
  - plugin overlays
  - plugin node and edge visual annotations
- Updated `packages/examples/tests/smoke.test.ts` to verify:
  - plugin-backed render plans
  - successful initial execution in the example harness
- Replaced `packages/plugins/tests/smoke.test.ts` with integration coverage proving:
  - the sample plugin registry surface
  - executable sample node types
  - renderer plugin decorations in the generated render plan

## Verified checkpoints

The following validations pass from the repository root:

- `npx tsc -p tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false packages/core/tests/core-engine.test.ts packages/renderer-skia/tests/scene.test.ts packages/examples/tests/smoke.test.ts packages/plugins/tests/smoke.test.ts`

## Verification note

- Package-local build outputs and package-local `tsc -p <package>/tsconfig.json --noEmit` flows that rely on project-reference declaration outputs remain blocked by sandbox `EPERM` writes to package `dist` folders. Root no-emit typecheck succeeds and was used as the verification path for this sprint.

# Sprint 08 Changes Log

## Summary

This sprint finished the MVP release layer by adding renderer theme switching and accessibility state, expanding the example harness into a real documentation and validation surface, and preparing workspace packages plus CI metadata for npm publication.

## Theme system and accessibility

- Extended `@kaiisuuwii/renderer-skia` with a real theme surface in:
  - `packages/renderer-skia/src/types.ts`
  - `packages/renderer-skia/src/theme.ts`
  - `packages/renderer-skia/src/layout.ts`
  - `packages/renderer-skia/src/scene.ts`
  - `packages/renderer-skia/src/index.ts`
- Added light and dark theme presets with runtime switching through:
  - `LIGHT_RENDERER_THEME`
  - `DARK_RENDERER_THEME`
  - `createRendererThemeController`
  - `themeMode` and `themeScale` renderer props
- Added scalable UI behavior through theme scale factors that expand:
  - node header height
  - port radius
  - selection width
  - focus ring width
- Added renderer accessibility contracts and scene output for:
  - screen reader labels on nodes, ports, edges, and groups
  - deterministic focus order
  - focus target tracking
  - keyboard navigation policy text for host apps
  - announcement hooks for invalid or unavailable focus targets

## Examples and plugins

- Replaced the example placeholder fixture set in `packages/examples/src/fixtures.ts` with exported documents for:
  - `small-graph`
  - `medium-graph`
  - `large-graph`
  - `invalid-graph`
  - `custom-node`
  - `plugin-example`
- Reworked `packages/examples/src/screen.ts` into an example app model that supports:
  - developer validation overlays
  - debug overlay toggles
  - runtime theme switching
  - import and export actions
  - deterministic focus navigation
  - execution of valid example graphs
- Preserved the legacy `createRendererFoundationExampleScreen` export while backing it with the new example app model.
- Expanded `packages/plugins/src/index.ts` with annotation-focused sample plugins:
  - `createAnnotationNodePlugin`
  - `createAnnotationRendererPlugin`
- Updated the plugin registry and plugin smoke coverage to prove both executable and annotation plugin paths.

## Documentation and release hardening

- Replaced the docs placeholder package with structured release documentation in:
  - `packages/docs/src/content.ts`
  - `packages/docs/src/examples.ts`
  - `packages/docs/src/index.ts`
- Added documented sections for:
  - architecture overview
  - package boundaries
  - core API
  - renderer API
  - plugin authoring
  - serialization and migration policy
  - contributor guide
  - release guide
- Added executable documentation examples that validate against real package APIs for:
  - core engine flows
  - renderer plan generation
  - plugin authoring
  - serialization
- Added root release and CI hardening:
  - `.github/workflows/ci.yml`
  - root scripts for `test:integration`, `test:renderer-theme`, and `release:check`
  - publish metadata updates across workspace `package.json` files
  - package README stubs for publishable workspace packages
  - updated root `README.md` with publishing notes, including GitHub Packages scope and repository requirements
- Added package release assertions in `tests/architecture/package-boundaries.test.ts` so publish metadata regressions fail the test suite.

## Tests added and updated

- Added `packages/renderer-skia/tests/theme.test.ts` for:
  - light and dark theme resolution
  - runtime theme controller switching
  - accessibility option defaults
- Updated `packages/renderer-skia/tests/scene.test.ts` and `packages/renderer-skia/tests/hit-testing.test.ts` to cover scene accessibility state.
- Added `packages/examples/tests/integration.test.ts` for:
  - import and export flows
  - theme and focus toggles
  - invalid-graph validation overlays
  - plugin-backed execution
- Replaced `packages/examples/tests/smoke.test.ts` and `packages/docs/tests/smoke.test.ts` with Sprint 08 coverage for the new public APIs.
- Updated `packages/plugins/tests/smoke.test.ts` for the expanded plugin registry and annotation renderer coverage.

## Verified checkpoints

The following commands pass from the repository root in this sandbox-safe verification path:

- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false`
- `npx vitest run --configLoader runner --cache false packages/renderer-skia/tests/performance-benchmark.test.ts`
- `npm install --package-lock-only`

## Verification note

- `npm run typecheck` still uses TypeScript build mode and attempts to write declaration outputs into package `dist` folders, which remains blocked by sandbox `EPERM` restrictions in this Codex environment. The root no-emit typecheck path above passed and validates the updated source tree without requiring artifact writes.

# Sprint 09 Changes Log

## Summary

This sprint replaced the `renderer-svg` placeholder stub with a complete, production-ready SVG renderer. The package now produces a typed element-tree plan (`SvgRenderPlan`) from a `GraphSnapshot` that can be serialized to an SVG string for static export, SSR, and browser rendering. All 101 suite tests pass.

## SVG renderer types

- Defined all SVG-specific contracts in `packages/renderer-svg/src/types.ts`:
  - `SvgElement` — discriminated union of `SvgRect`, `SvgCircle`, `SvgPath`, `SvgText`, `SvgTspan`, `SvgImage`, `SvgGroup`, and `SvgClipPath`
  - `SvgLayer` — mirrors `SceneLayer` with a `kind` discriminant and an `elements` payload
  - `SvgRenderPlan` — top-level output with `viewBox`, `width`, `height`, `defs`, `layers`, `accessibility`, and `diagnostics`
  - `SvgAccessibilityState` — `focusOrder`, `labels`, and `titleById` map
  - `SvgDiagnostics` — `visibleNodeCount`, `culledNodeCount`, `buildDurationMs`
  - `SvgRendererProps` — entry-point props mirroring `NodeGraphRendererProps` from `renderer-skia`
  - `SvgTheme` — full color, font, and stroke token set for all scene elements
  - `SvgVirtualizationOptions` — culling controls with viewport padding factor
  - `SvgAccessibilityOptions` — aria label, title element, and role attribute toggles
  - `SvgRendererPlugin` — plugin surface with `decorateNodeLayout`, `decorateEdgeLayout`, and `createOverlays` hooks
  - `SvgCubicBezierCurve`, `SvgNodeLayout`, `SvgEdgeLayout`, `SvgGroupLayout`, `SvgPortLayout` — layout data contracts
  - `SvgPluginOverlay`, `SvgNodeVisual`, `SvgEdgeVisual`, `SvgNodeBadgeVisual`, `SvgEdgeLabelVisual` — plugin annotation types

## Theme system

- Implemented `packages/renderer-svg/src/theme.ts` with:
  - `LIGHT_SVG_THEME` — light color set matched to `LIGHT_RENDERER_THEME` from `renderer-skia`
  - `DARK_SVG_THEME` — dark color set
  - `DEFAULT_SVG_THEME` — alias for `LIGHT_SVG_THEME`
  - `resolveSvgTheme(theme?, mode?)` — merges a partial override with the base theme
  - `resolveSvgVirtualization` and `resolveSvgAccessibility` — defaults resolvers for options objects

## Camera and viewBox

- Implemented `packages/renderer-svg/src/camera.ts` with:
  - `createSvgCameraState` — constructs a `CameraState` from partial props with defaults
  - `computeSvgViewBox(camera, viewport)` — produces the `"minX minY width height"` viewBox string from camera position and zoom
  - `computeSvgTransform(camera)` — returns a CSS/SVG transform string for a `<g>` wrapper
  - `getSvgViewportBounds` — derives graph-space viewport bounds for culling

## Element factory helpers

- Implemented `packages/renderer-svg/src/elements.ts` with:
  - `svgRect`, `svgCircle`, `svgPath`, `svgText`, `svgImage`, `svgGroup`, `svgClipRect` — typed factory functions for each `SvgElement` kind
  - `svgMultilineText` — wraps a `<text>` with `<tspan>` children for multi-line text
  - `bezierPathD(curve)` — converts a `SvgCubicBezierCurve` to an SVG `d` string in `M x y C cx1 cy1 cx2 cy2 x y` form

## Layout builders

- Implemented `packages/renderer-svg/src/layout.ts` with locally-defined pure layout functions (not imported from `renderer-skia`) to keep the architecture boundary clean:
  - `buildNodeLayout` — derives `SvgNodeLayout` from a node snapshot including port positions and selection state
  - `buildEdgeLayout` — derives `SvgEdgeLayout` including the cubic bezier curve from source and target port anchors
  - `createSvgNodeElements` — emits body rect, header rect, label text, port circles, port labels, selection highlight, and optional accessibility `<title>` element
  - `createSvgEdgeElements` — emits bezier `<path>`, selection highlight path, and plugin edge label texts
  - `createSvgGroupElements` — emits background rect with low-opacity fill, dashed border rect, and group label text
  - `createSvgGridElements` — emits vertical and horizontal grid line paths; suppressed when `camera.zoom < 0.3`

## Scene builder

- Implemented `packages/renderer-svg/src/scene.ts` — the main `buildSvgRenderScene(options)` function:
  - Constructs eight ordered layers: `background`, `grid`, `group`, `edge`, `node`, `selection`, `plugin`, `debug`
  - Viewport culling: derives graph-space bounds from camera and viewport; skips nodes whose bounds do not intersect (with padding); skips edges where both endpoints are culled; always preserves selected nodes
  - Plugin decoration: calls `plugin.decorateNodeLayout` and `plugin.decorateEdgeLayout` before generating elements; calls `plugin.createOverlays` to populate the plugin layer
  - Accessibility: wraps each node group in a `<g role="img">` with `aria-label`; builds `focusOrder` by sorting nodes left-to-right then top-to-bottom; populates `titleById` when `addTitleElements` is enabled
  - Arrow marker def: emits one `<marker id="svg-arrowhead">` in the defs block for edge arrowheads
  - Diagnostics: records `visibleNodeCount`, `culledNodeCount`, and `buildDurationMs` using `performance.now()`

## Serializer

- Implemented `packages/renderer-svg/src/serialize.ts` with:
  - `serializeSvgElement(el)` — recursive element-to-string converter handling all `SvgElement` kinds with correct attribute escaping (`&`, `<`, `>`, `"`) in both attribute values and text content
  - `serializeSvgRenderPlan(plan)` — emits a complete SVG document: `<?xml?>` declaration, `<svg>` root with `xmlns`, `viewBox`, `width`, `height`, `role="img"`, and `aria-label="graph"`; `<defs>` block; each layer as `<g data-layer="kind">`

## Public API

- Updated `packages/renderer-svg/src/index.ts` to export the complete public surface:
  - `createSvgRenderPlan(props)` — entry-point that wires scene builder, theme resolver, and camera state
  - `serializeSvgRenderPlan(plan)` — XML string serializer
  - `LIGHT_SVG_THEME`, `DARK_SVG_THEME`, `DEFAULT_SVG_THEME`, `resolveSvgTheme`
  - `computeSvgViewBox`, `computeSvgTransform`, `bezierPathD`
  - All types from `types.ts`

## Examples and docs packages

- Added `SVG_STATIC_EXPORT_DOCUMENT` fixture to `packages/examples/src/fixtures.ts`
- Added `createSvgExportScreen` to `packages/examples/src/screen.ts` — loads the fixture, calls `createSvgRenderPlan` and `serializeSvgRenderPlan`, and returns the SVG string
- Exported `createSvgExportScreen` from `packages/examples/src/index.ts`
- Added `createSvgRendererExample` to `packages/docs/src/examples.ts` — 10-line demonstration of the `createSvgRenderPlan` + `serializeSvgRenderPlan` round-trip
- Added `svg-renderer` section to `packages/docs/src/content.ts`
- Updated `packages/docs/src/index.ts` to expose the new doc content and example

## Tests added

- Added `packages/renderer-svg/tests/svg-renderer.test.ts` with 27 tests:
  - Unit: `bezierPathD` produces the correct SVG path string for known and negative control points
  - Unit: `computeSvgViewBox` produces correct viewBox for identity, zoomed, and zoom-out cameras
  - Unit: `createSvgNodeElements` emits rect, header, label, port circles, and `aria-label`
  - Unit: `createSvgEdgeElements` emits a bezier `<path>` with a correct `d` attribute and selection highlight
  - Unit: `serializeSvgElement` escapes `&`, `<`, `>` in text content; serializes groups and `<clipPath>` recursively
  - Unit: `serializeSvgRenderPlan` opens and closes `<svg>` correctly; emits `<defs>` and `data-layer` attributes
  - Unit: culling — nodes at position `(50000, 50000)` are absent from the node layer; selected offscreen nodes are preserved
  - Unit: plugin overlays appear in the plugin layer
  - Unit: dark theme changes node colors relative to light theme
  - Unit: accessibility `titleById` is populated when `addTitleElements` is enabled; `focusOrder` is sorted left-to-right
  - Integration: `createSvgRenderPlan` + `serializeSvgRenderPlan` round-trip for small (3-node), medium (6-node), and large (10-node) fixtures
  - Integration: all eight layer kinds (`background`, `grid`, `group`, `edge`, `node`, `selection`, `plugin`, `debug`) are present in the plan
  - Architecture: `renderer-svg` source files contain no imports from `react`, `react-native`, or `@shopify/react-native-skia`
- Updated `packages/renderer-svg/tests/smoke.test.ts` to match the new public API surface
- Updated `packages/docs/tests/smoke.test.ts` and `packages/examples/tests/smoke.test.ts` for the SVG renderer additions

## Verified checkpoints

The following validations pass from the repository root:

- `npx tsc -p tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false`

---

# Sprint 10 Changes Log

## Summary

This sprint introduced the `@kaiisuuwii/layout` package — a standalone, renderer-agnostic graph layout engine providing four algorithms (layered, force-directed, tree, radial), an incremental force-directed engine for frame-by-frame animation, and utility helpers for bridging core snapshots to layout inputs. The package depends only on `@kaiisuuwii/shared` and is registered as a public workspace package.

## New package: `@kaiisuuwii/layout`

Created `packages/layout/` with the following structure:

- `package.json` — `@kaiisuuwii/layout` v0.2.0, public, single dependency on `@kaiisuuwii/shared: 0.1.0`
- `tsconfig.json` — extends `../../tsconfig.base.json`, `lib: ["ES2022"]` (no DOM), references `../shared`
- `tsconfig.build.json` — references `../shared/tsconfig.build.json`
- `src/types.ts` — all public contracts
- `src/utils.ts` — snapshot-to-layout-input bridge and helpers
- `src/layered.ts` — Sugiyama-style layered layout
- `src/force-directed.ts` — Fruchterman-Reingold force-directed layout
- `src/tree.ts` — Reingold-Tilford tree layout
- `src/radial.ts` — radial/ring layout
- `src/index.ts` — public entry point

## Public types (`src/types.ts`)

- `LayoutAlgorithm` — `"layered" | "force-directed" | "tree" | "radial"`
- `LayoutDirection` — `"top-bottom" | "bottom-top" | "left-right" | "right-left"`
- `EdgeRoutingStyle` — `"curved" | "orthogonal" | "straight"`
- `LayoutNodeInput` — `{ id, size, fixed?, initialPosition? }`
- `LayoutEdgeInput` — `{ id, sourceNodeId, targetNodeId }`
- `LayoutGraphInput` — `{ nodes, edges }`
- `LayoutNodeResult` — `{ id, position }`
- `LayoutResult` — `{ positions, algorithm, iterationsRun?, converged?, durationMs }`
- `LayeredLayoutOptions`, `ForceDirectedLayoutOptions`, `TreeLayoutOptions`, `RadialLayoutOptions`, `LayoutOptions` (discriminated union)
- `LayoutEngineState` — `{ positions, iteration, converged }`
- `IncrementalLayoutEngine` — `{ step(), run(), getState(), setPositions(Map) }`
- `LayoutError` — local `Error` subclass; does not depend on `core`

## Utilities (`src/utils.ts`)

- `graphInputFromSnapshot(snapshot)` — converts a `SnapshotLike` (structural duck type; no import from `@kaiisuuwii/core`) to `LayoutGraphInput` by mapping `node.dimensions` to `size` and `edge.source`/`edge.target` to `sourceNodeId`/`targetNodeId`
- `applyResultToEngine(result, engine)` — calls `engine.updateNode` for each position in a `LayoutResult`; uses local `EngineAdapter` interface with `id: string` to stay dependency-free
- `centerPositions(positions, viewport)` — translates all positions so the bounding box is centered in the viewport
- `detectRoots(nodes, edges)` — returns the subset of nodes with no incoming edges
- `buildAdjacency(nodes, edges)` — builds a `Map<string, string[]>` of outgoing neighbour lists

## Layered layout (`src/layered.ts`)

Simplified Sugiyama framework:

- `findBackEdges` — iterative DFS to detect cycles; back edges are reversed to make the graph acyclic
- `assignLayers` — longest-path rank assignment; nodes with no predecessors start at layer 0
- `insertDummies` — adds virtual dummy nodes for edges that span multiple ranks, enabling proper edge routing
- `groupByLayer` / `minimizeCrossings` — 4-pass barycentric crossing minimisation (top-down then bottom-up, repeated twice)
- X/Y coordinate assignment — uniform spacing with `nodePaddingX`/`nodePaddingY`; centres each layer horizontally by mean position when `centerGraph: true`
- `applyDirection` — transforms `(x, y)` coordinates for all four `LayoutDirection` values after the default `top-bottom` computation
- Uses `import { performance } from "node:perf_hooks"` (no DOM lib)

## Force-directed layout (`src/force-directed.ts`)

Fruchterman-Reingold algorithm:

- Pairwise repulsion scaled by `repulsionStrength / dist²`
- Edge attraction using Hooke's law with configurable `idealEdgeLength` and `attractionStrength`
- Centre-of-mass gravity with `gravity` coefficient
- Temperature cooling: multiplies by `cooling` each iteration; caps force magnitude at current temperature
- Fixed-node support: `LayoutNodeInput.fixed = true` nodes are skipped during force integration
- Convergence check: stops early when max force magnitude falls below `convergenceThreshold`
- `IncrementalForceLayout` class — implements `IncrementalLayoutEngine` with `step()` (one iteration), `run()` (full run to convergence or max iterations), `getState()`, and `setPositions(Map)`
- `runForceDirectedLayout` and `createIncrementalForceLayout` exported

## Tree layout (`src/tree.ts`)

Reingold-Tilford-style algorithm:

- `computeSubtreeWidths` — bottom-up pass computing the total width of each subtree for non-overlapping placement
- `assignPositions` — top-down pass; when `centerSubtrees: true` parents are centred over the mean of their children's centre-X values
- Forest handling: multiple roots laid side-by-side, separated by `nodePaddingX * 2`
- Disconnected nodes (no edges) placed in a row below the forest at `nodePaddingY * 3` offset
- Additional exports: `computeTreeDepth`, `getNodeDepths`

## Radial layout (`src/radial.ts`)

- `buildUndirectedAdj` — constructs an undirected adjacency map from directed edges
- `findHighestDegreeNode` — selects the centre node as the one with the most neighbours
- BFS ring assignment: centre node at ring 0, each subsequent BFS frontier is one ring further out
- Angular distribution: `angleStep = 2π / ringNodes.length` for uniform spacing per ring
- Position: `x = radius × cos(angle) − size.x / 2`, `y = radius × sin(angle) − size.y / 2`
- `radiusStep` controls ring separation; `startAngle` offsets the first node's angle

## Public entry point (`src/index.ts`)

- `applyLayout(input, options)` — dispatcher with exhaustive `switch` on `options.algorithm`; throws `LayoutError` for unknown values; TypeScript `never` check enforces compile-time exhaustiveness
- `createIncrementalLayout(input, options)` — creates an `IncrementalForceLayout` engine
- Re-exports: `runLayeredLayout`, `runForceDirectedLayout`, `createIncrementalForceLayout`, `runTreeLayout`, `runRadialLayout`
- Re-exports: `applyResultToEngine`, `buildAdjacency`, `centerPositions`, `detectRoots`, `graphInputFromSnapshot`
- Re-exports: `LayoutError` and all public types from `types.ts`

## Benchmarks (`benchmarks/layout-benchmark.ts`)

Added four benchmark scenarios:

- `1k-nodes-layered` — 1 000-node chain with layered algorithm
- `1k-nodes-force` — 1 000-node chain with force-directed (300 iterations)
- `5k-nodes-force` — 5 000-node chain with force-directed (100 iterations)
- `sparse-tree` — 511-node complete binary tree with tree algorithm

Benchmark script wired to root `package.json` as `"benchmark:layout": "vitest run packages/layout/benchmarks/layout-benchmark.ts"`.

## Workspace registration

- `tsconfig.json` (root) — added `{ "path": "./packages/layout" }` to references
- `tsconfig.build.json` (root) — added `{ "path": "./packages/layout/tsconfig.build.json" }` to references
- `tsconfig.base.json` — added `"@kaiisuuwii/layout": ["packages/layout/src/index.ts"]` to `paths`
- `vitest.config.ts` — added `"@kaiisuuwii/layout"` alias pointing to `packages/layout/src/index.ts`
- `package.json` (root) — added `benchmark:layout` script; added `@kaiisuuwii/layout` to `publish:dry-run`, `publish:public`, and `clean` scripts

## Examples package updates

- `packages/examples/package.json` — added `"@kaiisuuwii/layout": "0.2.0"` dependency
- `packages/examples/tsconfig.json` — added `{ "path": "../layout" }` to references
- `packages/examples/tsconfig.build.json` — added `{ "path": "../layout/tsconfig.build.json" }` to references
- `packages/examples/src/fixtures.ts` — added `LAYOUT_DEMO_DOCUMENT`: a 20-node pipeline fixture with all positions at `vec2(0, 0)` intended for auto-layout demonstrations; added to `EXAMPLE_FIXTURES` map
- `packages/examples/src/screen.ts` — added `createLayoutDemoScreen(algorithm)` function: imports the layout demo document into a core engine, calls `graphInputFromSnapshot`, dispatches `applyLayout` with algorithm-specific default options, applies positions via `beginTransaction`/`endTransaction`, and returns `{ id, algorithm, layoutResult, snapshot, renderPlan }`
- `packages/examples/src/index.ts` — exported `createLayoutDemoScreen` and `LAYOUT_DEMO_DOCUMENT`

## Tests added

Added `packages/layout/tests/layout.test.ts` with 25 tests:

- `graphInputFromSnapshot` — maps node dimensions to size, maps edge endpoints, handles empty graph
- `applyLayout / layered` — returns positions for all nodes, respects `centerGraph: true`, positions are finite numbers
- `applyLayout / force-directed` — positions all nodes, reports `iterationsRun` and `converged`, fixed nodes remain at initial position
- `applyLayout / tree` — positions all nodes, parent node is above children for `top-bottom` direction
- `applyLayout / radial` — positions all nodes, centre node is approximately centred at origin
- `detectRoots` — returns only nodes with no incoming edges; returns all nodes when no edges exist
- `buildAdjacency` — builds correct forward adjacency lists; handles multiple edges from a single source
- `centerPositions` — translates positions so the bounding box is centred in the given viewport
- `IncrementalLayoutEngine` — `step()` advances iteration count; `run()` reaches convergence; `setPositions` overrides state; `getState()` returns current positions
- `LayoutError` — is an instance of `Error`; carries the provided message
- Benchmark smoke — `runForceDirectedLayout` on a 200-node graph completes in under 5 000 ms

## Verified checkpoints

The following validations pass from the repository root:

- `npx tsc -p tsconfig.json --noEmit --composite false --incremental false`
- `npx vitest run --configLoader runner --cache false` — 126 tests across 20 files, all passing

All 101 suite tests green.

# Sprint 11 Changes Log

## Summary

This sprint completes the cyclic execution surface for `@kaiisuuwii/core`, wires the example and docs packages to the new behavior, and records the remaining public API additions introduced for fixed-point and stepped cycle handling.

## Core execution engine

- Extended the execution policy and result model for cyclic scheduling:
  - `allowCycles`
  - `maxIterations`
  - `convergenceThreshold`
  - `convergenceMode`
  - `cycleBehavior`
  - `iterationsRun`
  - `converged`
  - `cycleGroups`
- Added cycle-aware execution events:
  - `executionCycleIteration`
  - `executionConverged`
  - `executionDiverged`
- Added `SteppedExecutionHandle` support through `execute()` when `cycleBehavior: "stepped"` is enabled.
- Implemented strongly connected component discovery and condensation helpers in `packages/core/src/execution.ts`.
- Preserved the original DAG-only execution path when cyclic execution is not enabled.
- Added fixed-point execution for cyclic SCCs with:
  - warm-starting from cached outputs
  - per-iteration delta tracking
  - convergence and divergence reporting
  - deterministic super-node ordering for singleton and cyclic groups
- Updated validation to always surface `cycleSets`, emit `CYCLE_DETECTED` when cycles are forbidden, and emit `CYCLE_PRESENT` warnings when cycles are allowed.
- Re-exported the new cyclic execution types from `packages/core/src/index.ts`.

## Examples and docs

- Added the public `CYCLIC_GRAPH_EXAMPLE_DOCUMENT` fixture to the examples package and kept it registered under `cyclic-graph`.
- Added `createCyclicExecutionScreen()` to execute the cyclic fixture with the real core scheduler and expose:
  - `iterationsRun`
  - `converged`
  - `cycleGroups`
  - `status`
- Added `cyclic-graph` to the examples manifest and example definitions so it participates in the public package surface.
- Fixed the layout demo screen to use the current `updateNode(nodeId, input)` API and typed algorithm defaults against `applyLayout`.
- Added cyclic execution documentation content and a live docs example that runs the real example screen and reports convergence metadata.
- Updated `docsManifest` to reflect the Sprint 11 docs surface.

## Tests added and updated

- Added example integration coverage for `createCyclicExecutionScreen()` and the public cyclic fixture.
- Updated examples smoke coverage to include the `cyclic-graph` manifest entry.
- Added docs smoke coverage for the cyclic execution example and updated manifest expectations to Sprint 11.
- Existing core cyclic execution tests continue to cover:
  - SCC detection
  - fixed-point convergence
  - divergence at `maxIterations`
  - non-numeric `Infinity` deltas
  - deterministic repeated runs
  - stepped execution and cancellation
