# Renderer Benchmark Harness

Sprint 06 benchmark scenarios are exposed through `runRendererBenchmarkSuite` from `packages/renderer-skia/src/benchmark.ts`.

Covered scenarios:

- `10k-nodes`
- `50k-edges`
- `100k-edge-traversal`
- `rapid-mutation-replay`

The suite uses deterministic fixtures so successive runs compare like-for-like scene construction and mutation costs.
