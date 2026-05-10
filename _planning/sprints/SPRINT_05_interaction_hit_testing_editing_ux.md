# Sprint 05: Interaction, hit testing, and graph editing UX

## Goal

Turn the renderer into an editor by adding gestures, hit testing, selection integration, and direct graph editing interactions.

## Scope

- [ ] Implement hit testing:
  - [ ] point hit testing
  - [ ] bounds hit testing
  - [ ] edge hit testing
- [ ] Choose and integrate a spatial index for interaction queries
- [ ] Implement gesture handling:
  - [ ] tap
  - [ ] double tap
  - [ ] long press
  - [ ] drag
  - [ ] pinch
  - [ ] lasso or marquee select
- [ ] Enforce interaction priority:
  - [ ] port
  - [ ] node
  - [ ] group
  - [ ] canvas
- [ ] Connect renderer interactions to core commands:
  - [ ] select node
  - [ ] select edge
  - [ ] drag node
  - [ ] pan canvas
  - [ ] zoom camera
  - [ ] create preview connection
- [ ] Implement group interactions enough for selection and dragging policy
- [ ] Implement edge preview and invalid connection feedback
- [ ] Extend example app into an actual editing harness

## Checkpoints

- [ ] Checkpoint 1: tapping selects nodes and edges reliably
- [ ] Checkpoint 2: dragging a node updates core state and rerenders correctly
- [ ] Checkpoint 3: lasso or marquee selection selects multiple nodes deterministically
- [ ] Checkpoint 4: connection preview and invalid connection feedback work end to end

## Test gate

- [ ] Unit tests for hit testing math
- [ ] Unit tests for spatial index inserts, updates, and queries
- [ ] Integration tests for selection gesture to core state update flow
- [ ] Integration tests for node drag updating graph snapshots
- [ ] Integration tests for edge preview and edge creation validation
- [ ] Manual verification:
  - [ ] pan and zoom do not interfere with node drag
  - [ ] interaction priority resolves correctly near overlapping elements
  - [ ] selection state matches visual state

## Exit criteria

- [ ] The app supports the MVP editing loop: select, drag, connect, delete, undo
- [ ] Renderer interactions remain mapped through core commands rather than bypassing core rules

