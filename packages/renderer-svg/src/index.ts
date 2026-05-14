import { createSvgCameraState } from "./camera.js";
import { buildSvgRenderScene } from "./scene.js";
import {
  resolveSvgAccessibility,
  resolveSvgTheme,
  resolveSvgVirtualization
} from "./theme.js";
import type { SvgRenderPlan, SvgRendererProps } from "./types.js";

export const createSvgRenderPlan = (props: SvgRendererProps): SvgRenderPlan =>
  buildSvgRenderScene({
    snapshot: props.snapshot,
    viewport: props.viewport ?? { width: 1280, height: 720 },
    camera: createSvgCameraState(props.camera),
    theme: resolveSvgTheme(props.theme, props.themeMode),
    plugins: props.plugins ?? [],
    virtualization: resolveSvgVirtualization(props.virtualization),
    accessibility: resolveSvgAccessibility(props.accessibility),
    ...(props.resolveNodeType !== undefined ? { resolveNodeType: props.resolveNodeType } : {}),
    ...(props.measurer !== undefined ? { measurer: props.measurer } : {}),
    ...(props.resolveImageState !== undefined ? { resolveImageState: props.resolveImageState } : {})
  });

export { serializeSvgRenderPlan } from "./serialize.js";

export { LIGHT_SVG_THEME, DARK_SVG_THEME, DEFAULT_SVG_THEME, resolveSvgTheme } from "./theme.js";

export { computeSvgViewBox, computeSvgTransform } from "./camera.js";

export { bezierPathD } from "./elements.js";

export type {
  CameraState,
  RendererViewport,
  SvgAccessibilityOptions,
  SvgAccessibilityState,
  SvgBuildSceneOptions,
  SvgCircle,
  SvgClipPath,
  SvgCubicBezierCurve,
  SvgDiagnostics,
  SvgEdgeLayout,
  SvgEdgeLabelVisual,
  SvgEdgeVisual,
  SvgElement,
  SvgGroup,
  SvgGroupLayout,
  SvgImage,
  SvgLayer,
  SvgNodeBadgeVisual,
  SvgNodeLayout,
  SvgNodeVisual,
  SvgPath,
  SvgPluginContext,
  SvgPluginOverlay,
  SvgPortLayout,
  SvgRect,
  SvgRenderPlan,
  SvgRendererPlugin,
  SvgRendererProps,
  SvgScenePluginContext,
  SvgText,
  SvgTheme,
  SvgTspan,
  SvgVirtualizationOptions
} from "./types.js";
