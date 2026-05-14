import type {
  RendererAccessibilityOptions,
  RendererDebugOptions,
  RendererInteractionOptions,
  RendererTheme,
  RendererThemeController,
  RendererThemeControllerState,
  RendererThemeMode,
  RendererThemeScale,
  RendererTheme as RendererThemeInput,
  RendererVirtualizationOptions
} from "./types.js";

const THEME_SCALE_FACTORS: Readonly<Record<RendererThemeScale, number>> = {
  comfortable: 1,
  large: 1.2
};

export const LIGHT_RENDERER_THEME: RendererTheme = {
  mode: "light",
  scale: "comfortable",
  fontScale: 1,
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
  },
  focus: {
    color: "#c2410c",
    width: 3
  },
  text: {
    defaultFontSize: 13,
    defaultFontFamily: "System",
    defaultLineHeight: 1.4,
    bodyTextColor: "#1e293b",
    editingBackgroundColor: "#ecfccb",
    editingBorderColor: "#65a30d",
    editingCursorColor: "#365314",
    placeholderColor: "#94a3b8"
  },
  image: {
    placeholderColor: "#e2e8f0",
    errorColor: "#fca5a5",
    loadingIndicatorColor: "#94a3b8",
    defaultImageHeight: 80
  }
};

export const DARK_RENDERER_THEME: RendererTheme = {
  mode: "dark",
  scale: "comfortable",
  fontScale: 1,
  backgroundColor: "#121a1d",
  groupColor: "rgba(106, 161, 148, 0.16)",
  debugColor: "#f3c58b",
  grid: {
    visible: true,
    spacing: 24,
    majorSpacingMultiplier: 4,
    color: "rgba(170, 195, 191, 0.12)",
    majorColor: "rgba(170, 195, 191, 0.24)"
  },
  node: {
    cornerRadius: 16,
    headerHeight: 28,
    bodyColor: "#1e2b2f",
    headerColor: "#284148",
    borderColor: "#87b3ad",
    borderWidth: 1.5,
    labelColor: "#f3fbf9",
    subLabelColor: "#b7d0cb",
    portRadius: 5,
    portColor: "#9ad4cb"
  },
  edge: {
    width: 2,
    color: "#83b7b0",
    selectedColor: "#4fd1c5",
    invalidColor: "#f97373"
  },
  selection: {
    color: "#4fd1c5",
    width: 2
  },
  focus: {
    color: "#f59e0b",
    width: 3
  },
  text: {
    defaultFontSize: 13,
    defaultFontFamily: "System",
    defaultLineHeight: 1.4,
    bodyTextColor: "#e2e8f0",
    editingBackgroundColor: "#20362f",
    editingBorderColor: "#4fd1c5",
    editingCursorColor: "#ccfbf1",
    placeholderColor: "#94a3b8"
  },
  image: {
    placeholderColor: "#334155",
    errorColor: "#fca5a5",
    loadingIndicatorColor: "#94a3b8",
    defaultImageHeight: 80
  }
};

export const DEFAULT_RENDERER_THEME: RendererTheme = LIGHT_RENDERER_THEME;

export const DEFAULT_INTERACTION_OPTIONS: RendererInteractionOptions = {
  panEnabled: true,
  zoomEnabled: true,
  minZoom: 0.25,
  maxZoom: 2.5,
  hitSlop: 8,
  edgeHitWidth: 12,
  longPressMarqueeEnabled: true
};

export const DEFAULT_VIRTUALIZATION_OPTIONS: RendererVirtualizationOptions = {
  enabled: true,
  cullingPadding: 160,
  suppressOffscreenNodes: true,
  suppressOffscreenEdges: true,
  preserveSelectedElements: true,
  incrementalRedrawEnabled: true,
  levelOfDetail: {
    labels: 0.45,
    ports: 0.7,
    decorations: 1,
    edgeSimplification: 0.55
  }
};

export const DEFAULT_DEBUG_OPTIONS: RendererDebugOptions = {
  enabled: false,
  showFpsOverlay: false,
  showRenderBounds: false,
  showHitRegions: false,
  showEdgeRouting: false
};

export const DEFAULT_RENDERER_ACCESSIBILITY: RendererAccessibilityOptions = {
  enabled: true,
  keyboardNavigationEnabled: true,
  screenReaderEnabled: true,
  scalableUiEnabled: true,
  announceValidationErrors: true
};

const withThemeScale = (
  theme: RendererTheme,
  scale: RendererThemeScale
): RendererTheme => {
  const factor = THEME_SCALE_FACTORS[scale];

  return {
    ...theme,
    scale,
    fontScale: factor,
    node: {
      ...theme.node,
      cornerRadius: Number((theme.node.cornerRadius * factor).toFixed(2)),
      headerHeight: Number((theme.node.headerHeight * factor).toFixed(2)),
      borderWidth: Number((theme.node.borderWidth * factor).toFixed(2)),
      portRadius: Number((theme.node.portRadius * factor).toFixed(2))
    },
    selection: {
      ...theme.selection,
      width: Number((theme.selection.width * factor).toFixed(2))
    },
    focus: {
      ...theme.focus,
      width: Number((theme.focus.width * factor).toFixed(2))
    },
    text: {
      ...theme.text,
      defaultFontSize: Number((theme.text.defaultFontSize * factor).toFixed(2))
    }
  };
};

const getThemeBase = (mode: RendererThemeMode): RendererTheme =>
  mode === "dark" ? DARK_RENDERER_THEME : LIGHT_RENDERER_THEME;

export const resolveRendererAccessibilityOptions = (
  options?: Partial<RendererAccessibilityOptions>
): RendererAccessibilityOptions => ({
  ...DEFAULT_RENDERER_ACCESSIBILITY,
  ...options
});

export const resolveRendererTheme = (
  theme?: Partial<RendererThemeInput>,
  mode: RendererThemeMode = "light",
  scale: RendererThemeScale = "comfortable"
): RendererTheme => {
  const baseTheme = withThemeScale(getThemeBase(mode), scale);

  return {
    ...baseTheme,
    ...theme,
    mode,
    scale,
    fontScale: theme?.fontScale ?? baseTheme.fontScale,
    grid: {
      ...baseTheme.grid,
      ...theme?.grid
    },
    node: {
      ...baseTheme.node,
      ...theme?.node
    },
    edge: {
      ...baseTheme.edge,
      ...theme?.edge
    },
    selection: {
      ...baseTheme.selection,
      ...theme?.selection
    },
    focus: {
      ...baseTheme.focus,
      ...theme?.focus
    },
    text: {
      ...baseTheme.text,
      ...theme?.text
    },
    image: {
      ...baseTheme.image,
      ...theme?.image
    }
  };
};

export const createRendererThemeController = (
  initialState: Partial<RendererThemeControllerState> = {},
  themeOverride?: Partial<RendererThemeInput>
): RendererThemeController => {
  let state: RendererThemeControllerState = {
    mode: initialState.mode ?? "light",
    scale: initialState.scale ?? "comfortable"
  };

  const getTheme = (): RendererTheme =>
    resolveRendererTheme(themeOverride, state.mode, state.scale);

  return {
    getState: () => ({ ...state }),
    getTheme,
    setMode: (mode) => {
      state = {
        ...state,
        mode
      };
      return getTheme();
    },
    setScale: (scale) => {
      state = {
        ...state,
        scale
      };
      return getTheme();
    },
    toggleMode: () => {
      state = {
        ...state,
        mode: state.mode === "light" ? "dark" : "light"
      };
      return getTheme();
    }
  };
};

export const resolveInteractionOptions = (
  options?: Partial<RendererInteractionOptions>
): RendererInteractionOptions => ({
  ...DEFAULT_INTERACTION_OPTIONS,
  ...options
});

export const resolveVirtualizationOptions = (
  options?: Partial<RendererVirtualizationOptions>
): RendererVirtualizationOptions => ({
  ...DEFAULT_VIRTUALIZATION_OPTIONS,
  ...options,
  levelOfDetail: {
    ...DEFAULT_VIRTUALIZATION_OPTIONS.levelOfDetail,
    ...options?.levelOfDetail
  }
});

export const resolveDebugOptions = (
  options?: Partial<RendererDebugOptions>
): RendererDebugOptions => ({
  ...DEFAULT_DEBUG_OPTIONS,
  ...options
});
