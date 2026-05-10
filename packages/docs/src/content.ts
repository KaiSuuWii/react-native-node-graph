export interface DocumentationSection {
  readonly id:
    | "architecture-overview"
    | "package-boundaries"
    | "core-api"
    | "renderer-api"
    | "plugin-authoring"
    | "serialization-policy"
    | "contributor-guide"
    | "release-guide";
  readonly title: string;
  readonly summary: string;
  readonly content: string;
}

export const documentationSections: readonly DocumentationSection[] = [
  {
    id: "architecture-overview",
    title: "Architecture Overview",
    summary:
      "The repository is split into renderer-agnostic graph state, renderer adapters, examples, plugins, and documentation.",
    content:
      "The shared package owns identifiers and geometry primitives. The core package owns immutable graph snapshots, validation, history, serialization, and execution. Renderer packages consume snapshots and emit render plans. Plugins extend core or renderer behavior without patching the host packages. Examples and docs sit on top of published entry points to keep package boundaries honest."
  },
  {
    id: "package-boundaries",
    title: "Package Boundaries",
    summary:
      "Core depends only on shared. Renderer packages depend on shared and core. Platform code stays in renderer packages.",
    content:
      "Keep graph mutations and execution policy inside core. Shared is limited to types, IDs, and math helpers. Renderer packages are responsible for platform-specific scene translation, theme state, accessibility descriptors, hit testing, and editor affordances. Tests should prefer public entry points to avoid leaking private module dependencies across packages."
  },
  {
    id: "core-api",
    title: "Core API",
    summary:
      "Core exposes graph creation, CRUD, validation, history, execution, plugin registration, and serialization entry points.",
    content:
      "Use createCoreEngine to build a deterministic editing runtime. Register node types and plugins before creating graph-specific workflows. Call validateGraph and validateExecution before shipping imported content. Use execute for pull-based DAG execution, and exportGraph or exportPartialGraph for serialization boundaries."
  },
  {
    id: "renderer-api",
    title: "Renderer API",
    summary:
      "Renderer packages consume graph snapshots and return scene plans with theme, debug, virtualization, and accessibility state.",
    content:
      "The renderer-skia package resolves light and dark themes, runtime scale changes, hit testing, and deterministic scene diagnostics. The accessibility surface lives in scene.accessibility so host apps can drive focus and screen reader behavior without reimplementing graph traversal. Developer overlays are additive renderer plugins instead of core mutations."
  },
  {
    id: "plugin-authoring",
    title: "Plugin Authoring",
    summary:
      "Plugins register node types, decorate render output, and contribute overlays or interaction hooks.",
    content:
      "Core plugins should register node types and keep cleanup symmetric through the initialize return function or dispose hook. Renderer plugins should decorate node or edge layouts without mutating upstream snapshots. Prefer deterministic metadata and avoid hidden global state so plugin output stays replayable in tests."
  },
  {
    id: "serialization-policy",
    title: "Serialization and Migration Policy",
    summary:
      "Graph documents export as versioned envelopes and should migrate forward through explicit registry entries.",
    content:
      "Versioned envelopes protect import flows from silent shape drift. New schema changes should add migrations instead of mutating old payloads in place. Partial export should remain selection-aware and deterministic, including implied nodes, edges, and groups that are necessary for a coherent subgraph."
  },
  {
    id: "contributor-guide",
    title: "Contributor Guide",
    summary:
      "Contributors should preserve package boundaries, keep tests public-API oriented, and validate changes through the root quality gates.",
    content:
      "New public APIs should be re-exported through src/index.ts in the owning package before cross-package use. Documentation examples should compile against real package exports. Accessibility and debug behavior should be covered through render-plan assertions so regressions are caught without platform-specific UI tests."
  },
  {
    id: "release-guide",
    title: "Release Guide",
    summary:
      "Release checks cover typecheck, lint, tests, and benchmark smoke. Package metadata is aligned for npm publication.",
    content:
      "Each publishable package should include a repository URL, license, exports, and publishConfig access metadata. For GitHub Packages, package scopes must match the publishing user or organization, package names must remain lowercase, and repository links should point at the hosting repository. This repo also keeps the root package private so workspaces publish package artifacts rather than the monorepo shell."
  }
] as const;

export const accessibilityVerificationChecklist = [
  "Render plans expose deterministic screen reader labels for nodes, edges, and groups.",
  "Focus order is deterministic and can be driven by host keyboard handling.",
  "Theme scaling increases interactive chrome without mutating graph state.",
  "Validation overlays can be announced separately from normal graph content."
] as const;

export const releaseHardeningChecklist = [
  "Run npm run typecheck.",
  "Run npm run lint.",
  "Run npm run test.",
  "Run npm run benchmark:renderer.",
  "Verify package metadata before publishing workspace packages."
] as const;
