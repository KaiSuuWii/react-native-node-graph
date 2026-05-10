# Sprint 01: Foundation and architecture

## Goal

Establish the monorepo, toolchain, package boundaries, and shared primitives so later sprints can build on a stable base.

## Scope

- [ ] Create workspace layout:
  - [ ] `packages/core`
  - [ ] `packages/renderer-skia`
  - [ ] `packages/renderer-svg`
  - [ ] `packages/renderer-web`
  - [ ] `packages/shared`
  - [ ] `packages/examples`
  - [ ] `packages/plugins`
  - [ ] `packages/docs`
- [ ] Set up package manager workspaces and root scripts
- [ ] Set up TypeScript project references and package build configs
- [ ] Set up linting, formatting, and test runner
- [ ] Define repository conventions:
  - [ ] source layout
  - [ ] test layout
  - [ ] benchmark layout
  - [ ] fixture layout
- [ ] Lock package boundaries:
  - [ ] `core` cannot depend on React Native
  - [ ] `core` cannot depend on Skia or DOM APIs
  - [ ] `renderer-skia` consumes graph snapshots and interaction contracts only
  - [ ] `shared` holds common types and math only
- [ ] Define public API entry points for `core`, `shared`, and `renderer-skia`
- [ ] Create initial shared primitives:
  - [ ] IDs
  - [ ] `Vec2`
  - [ ] graph metadata types
  - [ ] event payload types
  - [ ] default constants

## Checkpoints

- [ ] Checkpoint 1: repository installs, builds, and typechecks from root
- [ ] Checkpoint 2: each package exposes a minimal public entry point
- [ ] Checkpoint 3: import boundary rules prevent renderer dependencies from leaking into `core`
- [ ] Checkpoint 4: shared geometry and ID utilities are consumable from tests

## Test gate

- [ ] Root `typecheck` passes
- [ ] Root `lint` passes
- [ ] Root `test` passes with baseline package smoke tests
- [ ] Shared utility unit tests cover:
  - [ ] ID generation shape and uniqueness assumptions
  - [ ] vector math correctness
  - [ ] bounds helper correctness
- [ ] Import boundary test or lint rule verifies forbidden dependencies are blocked

## Exit criteria

- [ ] New contributors can clone, install, build, and run tests with one documented workflow
- [ ] Package boundaries are clear enough that Sprint 02 can begin without repo restructuring

