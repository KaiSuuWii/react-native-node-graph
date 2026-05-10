# Sprint 02: Core graph model and CRUD

## Goal

Build the first usable platform-agnostic core engine with graph creation, node CRUD, edge CRUD, registries, events, and disposal.

## Scope

- [x] Implement data models:
  - [x] `Graph`
  - [x] `Node`
  - [x] `Port`
  - [x] `Edge`
  - [x] `Group`
- [x] Implement graph factory functions:
  - [x] create empty graph
  - [x] initialize node, edge, and group registries
  - [x] initialize empty selection and history state or clearly separate them into engine state
- [x] Implement normalized internal storage:
  - [x] node map
  - [x] edge map
  - [x] group map
  - [x] port lookup indices
  - [x] adjacency indices
- [x] Implement `CoreEngine` shell:
  - [x] read-only graph snapshot access
  - [x] mutation API
  - [x] lifecycle and disposal
- [x] Implement event bus:
  - [x] `nodeAdded`
  - [x] `nodeRemoved`
  - [x] `edgeCreated`
  - [x] `edgeDeleted`
  - [x] `graphLoaded`
- [x] Implement node type registry
- [x] Implement node creation:
  - [x] type lookup
  - [x] schema validation hook point
  - [x] port validation
  - [x] plugin hook point stubs for `beforeNodeCreate` and `afterNodeCreate`
- [x] Implement node mutation:
  - [x] position
  - [x] dimensions
  - [x] properties
  - [x] ports
  - [x] metadata
- [x] Implement node deletion:
  - [x] remove connected edges
  - [x] clean selection references
  - [x] clean group membership
- [x] Implement edge creation and deletion:
  - [x] source and target existence
  - [x] source and target port existence
  - [x] direction validity
  - [x] data type compatibility
  - [x] self-loop policy
  - [x] cyclic graph policy flag

## Checkpoints

- [x] Checkpoint 1: empty graph can be created and disposed safely
- [x] Checkpoint 2: nodes can be added, mutated, and deleted with deterministic snapshots
- [x] Checkpoint 3: edges can be added and removed with adjacency indices staying correct
- [x] Checkpoint 4: core events fire with stable payloads during CRUD operations

## Test gate

- [x] Unit tests for graph factory initialization
- [x] Unit tests for node registry registration and lookup
- [x] Unit tests for node creation validation failures
- [x] Unit tests for node deletion cascading edge cleanup
- [x] Unit tests for edge validation rules
- [x] Unit tests for adjacency index updates
- [x] Unit tests for engine disposal and listener cleanup
- [x] Determinism test:
  - [x] same operation sequence yields structurally identical graph snapshots

## Exit criteria

- [x] `core` can serve as a non-UI editing engine for basic graph manipulation
- [x] Sprint 03 can extend this engine without changing core storage shape
