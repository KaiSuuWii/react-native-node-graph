import type {
  RendererInteractionOptions,
  RendererTheme,
  RendererTheme as RendererThemeInput
} from "./types.js";

export const DEFAULT_RENDERER_THEME: RendererTheme = {
  backgroundColor: "#f3f1ea",
  groupColor: "rgba(63, 94, 88, 0.10)",
  debugColor: "#6b4f3b",
  grid: {
    visible: true,
    spacing: 24,
    majorSpacingMultiplier: 4,
    color: "rgba(72, 88, 99, 0.12)",
    majorColor: "rgba(72, 88, 99, 0.20)"
  },
  node: {
    cornerRadius: 16,
    headerHeight: 28,
    bodyColor: "#fffdf8",
    headerColor: "#d7e7df",
    borderColor: "#2f4f4f",
    borderWidth: 1.5,
    labelColor: "#17322f",
    subLabelColor: "#486663",
    portRadius: 5,
    portColor: "#224b47"
  },
  edge: {
    width: 2,
    color: "#466b67",
    selectedColor: "#0f7b6c",
    invalidColor: "#b4493f"
  },
  selection: {
    color: "#0f7b6c",
    width: 2
  }
};

export const DEFAULT_INTERACTION_OPTIONS: RendererInteractionOptions = {
  panEnabled: true,
  zoomEnabled: true,
  minZoom: 0.25,
  maxZoom: 2.5
};

export const resolveRendererTheme = (
  theme?: Partial<RendererThemeInput>
): RendererTheme => ({
  ...DEFAULT_RENDERER_THEME,
  ...theme,
  grid: {
    ...DEFAULT_RENDERER_THEME.grid,
    ...theme?.grid
  },
  node: {
    ...DEFAULT_RENDERER_THEME.node,
    ...theme?.node
  },
  edge: {
    ...DEFAULT_RENDERER_THEME.edge,
    ...theme?.edge
  },
  selection: {
    ...DEFAULT_RENDERER_THEME.selection,
    ...theme?.selection
  }
});

export const resolveInteractionOptions = (
  options?: Partial<RendererInteractionOptions>
): RendererInteractionOptions => ({
  ...DEFAULT_INTERACTION_OPTIONS,
  ...options
});
