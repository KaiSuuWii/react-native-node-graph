# React Native Node Graph Implementation Plan

This file is now the master index. Detailed work has been split into sprint files with explicit checkpoints and test gates.

## Sprint index

- [x] Sprint 01: Foundation and architecture
  - File: [sprints/SPRINT_01_foundation_and_architecture.md](sprints/SPRINT_01_foundation_and_architecture.md)
- [x] Sprint 02: Core graph model and CRUD
  - File: [sprints/SPRINT_02_core_graph_model_and_crud.md](sprints/SPRINT_02_core_graph_model_and_crud.md)
- [x] Sprint 03: Validation, selection, history, and serialization
  - File: [sprints/SPRINT_03_validation_selection_history_serialization.md](sprints/SPRINT_03_validation_selection_history_serialization.md)
- [x] Sprint 04: Skia renderer foundation
  - File: [sprints/SPRINT_04_skia_renderer_foundation.md](sprints/SPRINT_04_skia_renderer_foundation.md)
- [x] Sprint 05: Interaction, hit testing, and graph editing UX
  - File: [sprints/SPRINT_05_interaction_hit_testing_editing_ux.md](sprints/SPRINT_05_interaction_hit_testing_editing_ux.md)
- [x] Sprint 06: Performance, virtualization, and diagnostics
  - File: [sprints/SPRINT_06_performance_virtualization_diagnostics.md](sprints/SPRINT_06_performance_virtualization_diagnostics.md)
- [ ] Sprint 07: Execution engine and plugin systems
  - File: [sprints/SPRINT_07_execution_engine_and_plugin_systems.md](sprints/SPRINT_07_execution_engine_and_plugin_systems.md)
- [ ] Sprint 08: Accessibility, documentation, examples, and release hardening
  - File: [sprints/SPRINT_08_accessibility_docs_examples_release.md](sprints/SPRINT_08_accessibility_docs_examples_release.md)

## Delivery rules across all sprints

- [ ] No sprint is complete until its automated tests are green
- [ ] No sprint is complete until its checkpoints are demoable in the example app or test harness
- [ ] Core changes must preserve deterministic state transitions
- [ ] Renderer changes must preserve the separation between graph logic and rendering logic
- [ ] Performance-sensitive paths must include at least one benchmark or measurement harness before being considered done

## MVP outcome

- [x] Graphs can be created, mutated, serialized, deserialized, validated, and rendered
- [ ] Nodes and edges can be added, moved, selected, connected, and deleted
- [x] Undo and redo work for primary editing operations
- [ ] Pan, zoom, drag, and selection are smooth in the Skia renderer
- [ ] The architecture remains cleanly split between core and renderer packages
- [ ] Public APIs, extension points, and constraints are documented
