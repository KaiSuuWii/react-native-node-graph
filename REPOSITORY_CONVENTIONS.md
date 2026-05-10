# Repository conventions

## Workspace layout

- Each package lives under `packages/<name>`.
- Source files live in `packages/<name>/src`.
- Package-local tests live in `packages/<name>/tests`.
- Benchmarks live in `packages/<name>/benchmarks`.
- Fixtures live in `packages/<name>/fixtures`.
- Cross-package architecture tests live in `tests/architecture`.

## Boundary rules

- `shared` is limited to common types, ID utilities, and math primitives.
- `core` is renderer-agnostic and may depend on `shared` only.
- `core` may not use React Native, Skia, or DOM APIs.
- `renderer-skia` consumes `core` snapshots and shared interaction payloads.
- Renderer packages are the only place where platform-specific rendering adapters should exist.

## Public API rules

- Every package exposes a single public entry at `src/index.ts`.
- Internal modules should be re-exported through the package entry point before cross-package use.
- Tests should import through package entry points when validating public behavior.
