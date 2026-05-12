import type { SvgAccessibilityOptions, SvgTheme, SvgVirtualizationOptions } from "./types.js";

export const LIGHT_SVG_THEME: SvgTheme = {
  backgroundColor: "#f3f1ea",
  gridColor: "rgba(72, 88, 99, 0.12)",
  gridSpacing: 24,
  nodeHeaderColor: "#d7e7df",
  nodeBodyColor: "#fffdf8",
  nodeBorderColor: "#2f4f4f",
  nodeBorderWidth: 1.5,
  nodeHeaderTextColor: "#17322f",
  nodeLabelFontSize: 13,
  nodeFontFamily: "system-ui, -apple-system, sans-serif",
  portColor: "#224b47",
  portRadius: 5,
  portLabelFontSize: 11,
  edgeColor: "#466b67",
  edgeWidth: 2,
  edgeSelectedColor: "#0f7b6c",
  selectionColor: "#0f7b6c",
  selectionWidth: 2,
  groupFillColor: "rgba(63, 94, 88, 0.10)",
  groupBorderColor: "#3f5e58",
  groupBorderWidth: 1.5,
  mode: "light"
};

export const DARK_SVG_THEME: SvgTheme = {
  backgroundColor: "#121a1d",
  gridColor: "rgba(170, 195, 191, 0.12)",
  gridSpacing: 24,
  nodeHeaderColor: "#284148",
  nodeBodyColor: "#1e2b2f",
  nodeBorderColor: "#87b3ad",
  nodeBorderWidth: 1.5,
  nodeHeaderTextColor: "#f3fbf9",
  nodeLabelFontSize: 13,
  nodeFontFamily: "system-ui, -apple-system, sans-serif",
  portColor: "#9ad4cb",
  portRadius: 5,
  portLabelFontSize: 11,
  edgeColor: "#83b7b0",
  edgeWidth: 2,
  edgeSelectedColor: "#4fd1c5",
  selectionColor: "#4fd1c5",
  selectionWidth: 2,
  groupFillColor: "rgba(106, 161, 148, 0.16)",
  groupBorderColor: "#6aa194",
  groupBorderWidth: 1.5,
  mode: "dark"
};

export const DEFAULT_SVG_THEME: SvgTheme = LIGHT_SVG_THEME;

export const DEFAULT_SVG_VIRTUALIZATION: SvgVirtualizationOptions = {
  enabled: true,
  cullOffscreenNodes: true,
  cullOffscreenEdges: true,
  viewportPaddingFactor: 1.2
};

export const DEFAULT_SVG_ACCESSIBILITY: SvgAccessibilityOptions = {
  enabled: true,
  addAriaLabels: true,
  addTitleElements: true,
  addRoleAttributes: true
};

export const resolveSvgTheme = (
  override?: Partial<SvgTheme>,
  mode?: "light" | "dark"
): SvgTheme => {
  const base = mode === "dark" ? DARK_SVG_THEME : LIGHT_SVG_THEME;

  if (override === undefined) {
    return base;
  }

  return { ...base, ...override, mode: mode ?? base.mode };
};

export const resolveSvgVirtualization = (
  override?: Partial<SvgVirtualizationOptions>
): SvgVirtualizationOptions => ({
  ...DEFAULT_SVG_VIRTUALIZATION,
  ...override
});

export const resolveSvgAccessibility = (
  override?: Partial<SvgAccessibilityOptions>
): SvgAccessibilityOptions => ({
  ...DEFAULT_SVG_ACCESSIBILITY,
  ...override
});
