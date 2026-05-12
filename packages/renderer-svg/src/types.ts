import type { GraphSnapshot } from "@kaiisuuwii/core";
import type { Bounds, EdgeId, NodeId, Vec2 } from "@kaiisuuwii/shared";

export interface CameraState {
  readonly position: Vec2;
  readonly zoom: number;
}

export interface RendererViewport {
  readonly width: number;
  readonly height: number;
}

export interface SvgRect {
  readonly kind: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rx?: number;
  readonly ry?: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly strokeDasharray?: string;
  readonly id?: string;
}

export interface SvgCircle {
  readonly kind: "circle";
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export interface SvgPath {
  readonly kind: "path";
  readonly d: string;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeLinecap?: "butt" | "round" | "square";
  readonly strokeLinejoin?: "miter" | "round" | "bevel";
  readonly opacity?: number;
  readonly markerEnd?: string;
}

export interface SvgTspan {
  readonly kind: "tspan";
  readonly dx?: number;
  readonly dy?: number;
  readonly content: string;
}

export interface SvgText {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly content: string;
  readonly fontSize?: number;
  readonly fontFamily?: string;
  readonly fontWeight?: string;
  readonly fill?: string;
  readonly textAnchor?: "start" | "middle" | "end";
  readonly dominantBaseline?: string;
  readonly children?: readonly SvgTspan[];
}

export interface SvgImage {
  readonly kind: "image";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly href: string;
  readonly preserveAspectRatio?: string;
  readonly clipPathId?: string;
}

export interface SvgGroup {
  readonly kind: "group";
  readonly id?: string;
  readonly transform?: string;
  readonly children: readonly SvgElement[];
  readonly clipPathId?: string;
  readonly opacity?: number;
  readonly role?: string;
  readonly ariaLabel?: string;
}

export interface SvgClipPath {
  readonly kind: "clipPath";
  readonly id: string;
  readonly children: readonly SvgElement[];
}

export type SvgElement =
  | SvgRect
  | SvgCircle
  | SvgPath
  | SvgText
  | SvgImage
  | SvgGroup
  | SvgClipPath;

export interface SvgLayer {
  readonly kind:
    | "background"
    | "grid"
    | "group"
    | "edge"
    | "node"
    | "selection"
    | "plugin"
    | "debug";
  readonly elements: readonly SvgElement[];
}

export interface SvgAccessibilityState {
  readonly focusOrder: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly titleById: Readonly<Record<string, string>>;
}

export interface SvgDiagnostics {
  readonly visibleNodeCount: number;
  readonly culledNodeCount: number;
  readonly buildDurationMs: number;
}

export interface SvgRenderPlan {
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
  readonly defs: readonly SvgElement[];
  readonly layers: readonly SvgLayer[];
  readonly accessibility: SvgAccessibilityState;
  readonly diagnostics: SvgDiagnostics;
}

export interface SvgTheme {
  readonly backgroundColor: string;
  readonly gridColor: string;
  readonly gridSpacing: number;
  readonly nodeHeaderColor: string;
  readonly nodeBodyColor: string;
  readonly nodeBorderColor: string;
  readonly nodeBorderWidth: number;
  readonly nodeHeaderTextColor: string;
  readonly nodeLabelFontSize: number;
  readonly nodeFontFamily: string;
  readonly portColor: string;
  readonly portRadius: number;
  readonly portLabelFontSize: number;
  readonly edgeColor: string;
  readonly edgeWidth: number;
  readonly edgeSelectedColor: string;
  readonly selectionColor: string;
  readonly selectionWidth: number;
  readonly groupFillColor: string;
  readonly groupBorderColor: string;
  readonly groupBorderWidth: number;
  readonly mode: "light" | "dark";
}

export interface SvgVirtualizationOptions {
  readonly enabled: boolean;
  readonly cullOffscreenNodes: boolean;
  readonly cullOffscreenEdges: boolean;
  readonly viewportPaddingFactor: number;
}

export interface SvgAccessibilityOptions {
  readonly enabled: boolean;
  readonly addAriaLabels: boolean;
  readonly addTitleElements: boolean;
  readonly addRoleAttributes: boolean;
}

export interface SvgCubicBezierCurve {
  readonly start: Vec2;
  readonly control1: Vec2;
  readonly control2: Vec2;
  readonly end: Vec2;
}

export interface SvgPortLayout {
  readonly id: string;
  readonly name: string;
  readonly direction: "input" | "output";
  readonly position: Vec2;
  readonly radius: number;
  readonly color: string;
}

export interface SvgNodeBadgeVisual {
  readonly kind: "badge";
  readonly label: string;
  readonly color: string;
}

export type SvgNodeVisual = SvgNodeBadgeVisual;

export interface SvgEdgeLabelVisual {
  readonly kind: "label";
  readonly label: string;
  readonly color: string;
  readonly position: Vec2;
}

export type SvgEdgeVisual = SvgEdgeLabelVisual;

export interface SvgNodeLayout {
  readonly id: NodeId;
  readonly label: string;
  readonly type: string;
  readonly position: Vec2;
  readonly size: Vec2;
  readonly headerHeight: number;
  readonly cornerRadius: number;
  readonly bodyColor: string;
  readonly headerColor: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly labelColor: string;
  readonly ports: readonly SvgPortLayout[];
  readonly selected: boolean;
  readonly invalid: boolean;
  readonly pluginVisuals: readonly SvgNodeVisual[];
  readonly accessibilityLabel: string;
}

export interface SvgEdgeLayout {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly curve: SvgCubicBezierCurve;
  readonly width: number;
  readonly color: string;
  readonly selected: boolean;
  readonly invalid: boolean;
  readonly pluginVisuals: readonly SvgEdgeVisual[];
  readonly accessibilityLabel: string;
}

export interface SvgGroupLayout {
  readonly id: string;
  readonly label: string;
  readonly position: Vec2;
  readonly size: Vec2;
  readonly color: string;
}

export interface SvgPluginOverlay {
  readonly id: string;
  readonly kind: "bounds" | "path" | "text";
  readonly label: string;
  readonly color: string;
  readonly bounds?: Bounds;
  readonly points?: readonly Vec2[];
  readonly position?: Vec2;
  readonly text?: string;
}

export interface SvgPluginContext {
  readonly snapshot: GraphSnapshot;
  readonly viewport: RendererViewport;
  readonly camera: CameraState;
  readonly theme: SvgTheme;
}

export interface SvgScenePluginContext extends SvgPluginContext {
  readonly nodes: readonly SvgNodeLayout[];
  readonly edges: readonly SvgEdgeLayout[];
}

export interface SvgRendererPlugin {
  readonly name: string;
  readonly decorateNodeLayout?: (
    layout: SvgNodeLayout,
    context: SvgPluginContext
  ) => SvgNodeLayout;
  readonly decorateEdgeLayout?: (
    layout: SvgEdgeLayout,
    context: SvgPluginContext
  ) => SvgEdgeLayout;
  readonly createOverlays?: (
    context: SvgScenePluginContext
  ) => readonly SvgPluginOverlay[];
}

export interface SvgRendererProps {
  readonly snapshot: GraphSnapshot;
  readonly viewport: RendererViewport;
  readonly camera?: Partial<CameraState>;
  readonly theme?: Partial<SvgTheme>;
  readonly themeMode?: "light" | "dark";
  readonly plugins?: readonly SvgRendererPlugin[];
  readonly virtualization?: Partial<SvgVirtualizationOptions>;
  readonly accessibility?: Partial<SvgAccessibilityOptions>;
}

export interface SvgBuildSceneOptions {
  readonly snapshot: GraphSnapshot;
  readonly viewport: RendererViewport;
  readonly camera: CameraState;
  readonly theme: SvgTheme;
  readonly plugins: readonly SvgRendererPlugin[];
  readonly virtualization: SvgVirtualizationOptions;
  readonly accessibility: SvgAccessibilityOptions;
}
