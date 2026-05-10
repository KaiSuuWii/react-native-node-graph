# Sprint 08: Accessibility, documentation, examples, and release hardening

## Goal

Finish the project to a releasable MVP by improving accessibility, documenting the APIs, expanding examples, and hardening tests.

## Scope

- [ ] Implement theme system:
  - [ ] light theme
  - [ ] dark theme
  - [ ] runtime theme switching
- [ ] Implement accessibility support:
  - [ ] screen reader labels
  - [ ] focus management
  - [ ] scalable UI strategy
  - [ ] keyboard navigation policy where applicable
- [ ] Expand example app:
  - [ ] small graph fixture
  - [ ] medium graph fixture
  - [ ] large graph fixture
  - [ ] invalid graph fixture
  - [ ] custom node example
  - [ ] plugin example
- [ ] Add developer toggles:
  - [ ] validation overlay
  - [ ] debug overlay
  - [ ] theme switcher
  - [ ] import and export actions
- [ ] Write documentation:
  - [ ] architecture overview
  - [ ] package boundaries
  - [ ] core API
  - [ ] renderer API
  - [ ] plugin authoring
  - [ ] serialization and migration policy
  - [ ] contributor guide
- [ ] Harden CI:
  - [ ] typecheck
  - [ ] lint
  - [ ] unit tests
  - [ ] integration tests
  - [ ] benchmark or performance smoke checks where practical

## Checkpoints

- [ ] Checkpoint 1: example app demonstrates all core MVP workflows
- [ ] Checkpoint 2: public APIs are documented well enough for outside use
- [ ] Checkpoint 3: accessibility and theme behavior are verified on supported targets
- [ ] Checkpoint 4: CI gates reflect the actual quality bar for release

## Test gate

- [ ] Unit tests for theme switching logic
- [ ] Integration tests for import and export flow in the example app
- [ ] Accessibility verification checklist is completed
- [ ] Documentation examples are validated against real package APIs
- [ ] End-to-end smoke pass covers:
  - [ ] create graph
  - [ ] add nodes
  - [ ] connect nodes
  - [ ] pan and zoom
  - [ ] select and drag
  - [ ] undo and redo
  - [ ] serialize and deserialize

## Exit criteria

- [ ] MVP definition is satisfied across core, renderer, examples, and docs
- [ ] The repository is ready for external evaluation or the next feature phase
