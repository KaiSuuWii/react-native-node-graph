# Sprint 07: Execution engine and plugin systems

## Goal

Add deterministic graph execution and formalize extension points for core and renderer plugins.

## Scope

- [ ] Define MVP execution policy:
  - [ ] DAG execution first
  - [ ] async execution support policy
  - [ ] pull, push, or reactive ordering for initial release
- [ ] Implement `ExecutionContext`
- [ ] Implement scheduler:
  - [ ] topological sort
  - [ ] dependency resolution
  - [ ] batching
  - [ ] async coordination
  - [ ] cancellation
- [ ] Implement execution cache and invalidation
- [ ] Implement execution lifecycle events:
  - [ ] `executionStarted`
  - [ ] `executionCompleted`
- [ ] Add execution validation:
  - [ ] cycle detection
  - [ ] missing inputs
  - [ ] invalid execution order
- [ ] Implement `GraphPlugin` lifecycle:
  - [ ] initialize
  - [ ] dispose
- [ ] Implement plugin registration safety:
  - [ ] duplicate name handling
  - [ ] engine cleanup
  - [ ] error isolation
- [ ] Implement renderer plugin interface scaffold:
  - [ ] custom node visuals
  - [ ] custom edge visuals
  - [ ] overlays
  - [ ] custom interactions
- [ ] Add one sample core plugin and one sample renderer plugin

## Checkpoints

- [ ] Checkpoint 1: simple DAG graphs execute deterministically
- [ ] Checkpoint 2: execution errors are surfaced through validation and runtime results
- [ ] Checkpoint 3: plugins can register custom nodes or visuals without patching core packages
- [ ] Checkpoint 4: plugin failures are contained and do not corrupt engine state

## Test gate

- [ ] Unit tests for topological sorting
- [ ] Unit tests for execution cache invalidation
- [ ] Unit tests for cancellation behavior
- [ ] Unit tests for cycle and missing-input validation
- [ ] Integration tests for simple executable graphs
- [ ] Determinism tests for repeated executions of the same graph
- [ ] Unit tests for plugin registration, duplicate rejection, and disposal
- [ ] Integration tests proving sample plugins execute or render correctly

## Exit criteria

- [ ] The system supports executable node graphs within the defined MVP constraints
- [ ] Extension points are credible enough for future node packs and renderer features

