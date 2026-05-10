# Sprint 03: Validation, selection, history, and serialization

## Goal

Make the core engine usable for real editing workflows by adding validation, selection state, undo/redo, and JSON serialization.

## Scope

- [x] Implement validation result types:
  - [x] `ValidationResult`
  - [x] `ValidationError`
  - [x] `ValidationWarning`
- [x] Implement structural validation:
  - [x] dangling edges
  - [x] duplicate IDs
  - [x] invalid references
  - [x] malformed groups
- [x] Implement type validation:
  - [x] port compatibility
  - [x] property schema integration point
  - [x] execution signature validation hook point
- [x] Implement selection state:
  - [x] selected nodes
  - [x] selected edges
  - [x] selected groups
  - [x] active selection mode
- [x] Implement selection operations:
  - [x] single select
  - [x] multi-select
  - [x] toggle select
  - [x] clear selection
- [x] Emit `selectionChanged`
- [x] Implement history command pattern:
  - [x] create command interface
  - [x] node create/update/delete commands
  - [x] edge create/delete commands
  - [x] optional selection commands if undoable
- [x] Implement undo and redo stacks
- [x] Implement transaction batching
- [x] Implement history compression for drag-like repetitive mutations
- [x] Implement JSON serialization:
  - [x] version envelope
  - [x] graph export
  - [x] graph import
  - [x] partial graph export
- [x] Define migration registry scaffold for future versions

## Checkpoints

- [x] Checkpoint 1: validation API reports meaningful errors and warnings on invalid fixture graphs
- [x] Checkpoint 2: selection changes are reflected in immutable snapshots and events
- [x] Checkpoint 3: undo and redo correctly revert node and edge operations
- [x] Checkpoint 4: graphs can round-trip through JSON without losing required data

## Test gate

- [x] Unit tests for structural validation coverage
- [x] Unit tests for type compatibility validation
- [x] Unit tests for selection operations and event emission
- [x] Unit tests for undo and redo stacks
- [x] Unit tests for transaction batching behavior
- [x] Unit tests for history compression behavior
- [x] Serialization round-trip tests with fixture graphs
- [x] Version-envelope tests for import and export
- [x] Determinism tests for replaying command history

## Exit criteria

- [x] Core editing workflows are stable enough to connect to the renderer
- [x] Serialized fixtures can be used in later renderer and performance tests
