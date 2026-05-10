# Sprint 06: Performance, virtualization, and diagnostics

## Goal

Stabilize the editor under realistic graph sizes by reducing render cost, introducing virtualization, and adding diagnostics.

## Scope

- [ ] Measure current renderer and core performance with representative graphs
- [ ] Implement viewport culling
- [ ] Implement offscreen node suppression
- [ ] Implement edge simplification for distant zoom levels
- [ ] Implement level-of-detail rules for:
  - [ ] labels
  - [ ] ports
  - [ ] decorations
- [ ] Optimize draw pipeline:
  - [ ] batched rendering where possible
  - [ ] lower allocation paths
  - [ ] incremental redraw strategy
- [ ] Optimize core data access paths if benchmarks expose regressions
- [ ] Add debug tooling:
  - [ ] FPS overlay
  - [ ] render bounds overlay
  - [ ] hit region overlay
  - [ ] edge routing debug hooks
- [ ] Add benchmark suite for:
  - [ ] 10,000 nodes
  - [ ] 50,000 edges
  - [ ] 100,000 edge traversal
  - [ ] rapid mutation replay

## Checkpoints

- [ ] Checkpoint 1: baseline performance metrics are recorded before optimization
- [ ] Checkpoint 2: virtualization hides offscreen content without breaking interactions
- [ ] Checkpoint 3: debug overlays make render and hit-testing problems observable
- [ ] Checkpoint 4: representative large-graph scenarios meet the defined performance target or have a documented gap list

## Test gate

- [ ] Benchmark harness runs repeatably against fixed fixtures
- [ ] Unit tests for viewport culling correctness
- [ ] Unit tests for LOD rule selection
- [ ] Integration tests verifying hit testing still works with virtualization enabled
- [ ] Stress tests for rapid mutations and redraw invalidation
- [ ] Manual verification:
  - [ ] debug overlays align with rendered content
  - [ ] panning through large graphs does not show obvious culling artifacts

## Exit criteria

- [ ] The renderer remains workable on large graphs
- [ ] Performance decisions are backed by measurements rather than guesses

