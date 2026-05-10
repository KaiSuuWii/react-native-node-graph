# Sprint 04: Skia renderer foundation

## Goal

Stand up the first renderer that can draw a graph snapshot with pan and zoom, while remaining cleanly separated from graph logic.

## Scope

- [x] Create `renderer-skia` package and wire dependencies:
  - [x] React Native Skia
  - [x] React Native Reanimated
  - [x] React Native Gesture Handler
- [x] Define renderer public API:
  - [x] `NodeGraphRendererProps`
  - [x] theme input
  - [x] plugin input placeholder
  - [x] interaction options
- [x] Implement camera model:
  - [x] position
  - [x] zoom
  - [x] optional velocity scaffold
- [x] Implement transforms:
  - [x] graph space to screen space
  - [x] screen space to graph space
- [x] Implement scene graph and render layers:
  - [x] background
  - [x] grid
  - [x] group
  - [x] edge
  - [x] node
  - [x] selection
  - [x] debug placeholder
- [x] Implement node rendering MVP:
  - [x] body
  - [x] header
  - [x] labels
  - [x] ports
- [x] Implement edge rendering MVP:
  - [x] bezier edges
  - [x] selected state styling hook
  - [x] invalid state styling hook
- [x] Build first example screen that renders a static serialized graph

## Checkpoints

- [x] Checkpoint 1: renderer can display a static graph with nodes and edges
- [x] Checkpoint 2: camera transforms keep node placement stable under pan and zoom
- [x] Checkpoint 3: render layer ordering is correct for grid, groups, edges, and nodes
- [x] Checkpoint 4: example app can load fixture graphs without involving core mutation logic

## Test gate

- [x] Unit tests for camera transform math
- [x] Unit tests for node and edge layout helper calculations
- [x] Renderer snapshot or structural tests for basic scene graph composition
- [x] Example screen smoke test for graph load and first render
- [ ] Manual verification:
  - [ ] graph remains visually stable while panning
  - [ ] zoom origin behavior is acceptable
  - [ ] layer ordering matches expectations

## Exit criteria

- [x] The project has a visible renderer baseline that later interaction work can build on
- [x] Renderer input remains a graph snapshot, not direct mutable core internals
