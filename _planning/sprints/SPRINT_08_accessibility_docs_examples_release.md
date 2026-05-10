# Sprint 08: Accessibility, documentation, examples, and release hardening

## Goal

Finish the project to a releasable MVP by improving accessibility, documenting the APIs, expanding examples, and hardening tests.

## Scope

- [x] Implement theme system:
  - [x] light theme
  - [x] dark theme
  - [x] runtime theme switching
- [x] Implement accessibility support:
  - [x] screen reader labels
  - [x] focus management
  - [x] scalable UI strategy
  - [x] keyboard navigation policy where applicable
- [x] Expand example app:
  - [x] small graph fixture
  - [x] medium graph fixture
  - [x] large graph fixture
  - [x] invalid graph fixture
  - [x] custom node example
  - [x] plugin example
- [x] Add developer toggles:
  - [x] validation overlay
  - [x] debug overlay
  - [x] theme switcher
  - [x] import and export actions
- [x] Write documentation:
  - [x] architecture overview
  - [x] package boundaries
  - [x] core API
  - [x] renderer API
  - [x] plugin authoring
  - [x] serialization and migration policy
  - [x] contributor guide
- [x] Harden CI:
  - [x] typecheck
  - [x] lint
  - [x] unit tests
  - [x] integration tests
  - [x] benchmark or performance smoke checks where practical

## Checkpoints

- [x] Checkpoint 1: example app demonstrates all core MVP workflows
- [x] Checkpoint 2: public APIs are documented well enough for outside use
- [x] Checkpoint 3: accessibility and theme behavior are verified on supported targets
- [x] Checkpoint 4: CI gates reflect the actual quality bar for release

## Test gate

- [x] Unit tests for theme switching logic
- [x] Integration tests for import and export flow in the example app
- [x] Accessibility verification checklist is completed
- [x] Documentation examples are validated against real package APIs
- [x] End-to-end smoke pass covers:
  - [x] create graph
  - [x] add nodes
  - [x] connect nodes
  - [x] pan and zoom
  - [x] select and drag
  - [x] undo and redo
  - [x] serialize and deserialize

## Exit criteria

- [x] MVP definition is satisfied across core, renderer, examples, and docs
- [x] The repository is ready for external evaluation or the next feature phase
