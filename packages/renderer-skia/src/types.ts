import type {
  CoreEngine,
  Edge,
  GraphEdgeSnapshot,
  GraphInteractionContract,
  GraphSnapshot,
  GraphNodeSnapshot,
  GroupId,
  PortId,
  SelectionChangeMode,
  SelectionSnapshot
} from "@react-native-node-graph/core";
import type { Bounds, EdgeId, NodeId, Vec2 } from "@react-native-node-graph/shared";

export interface CameraVelocity {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface CameraState {
  readonly position: Vec2;
  readonly zoom: number;
  readonly velocity?: CameraVelocity;
}

export interface RendererViewport {
  readonly width: number;
  readonly height: number;
}

export interface RendererGridTheme {
  readonly visible: boolean;
  readonly spacing: number;
  readonly majorSpacingMultiplier: number;
  readonly color: string;
  readonly majorColor: string;
}

export interface RendererNodeTheme {
  readonly cornerRadius: number;
  readonly headerHeight: number;
  readonly bodyColor: string;
  readonly headerColor: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly labelColor: string;
  readonly subLabelColor: string;
  readonly portRadius: number;
  readonly portColor: string;
}

export interface RendererEdgeTheme {
  readonly width: number;
  readonly color: string;
  readonly selectedColor: string;
  readonly invalidColor: string;
}

export interface RendererSelectionTheme {
  readonly color: string;
  readonly width: number;
}

export interface RendererTheme {
  readonly backgroundColor: string;
  readonly groupColor: string;
  readonly debugColor: string;
  readonly grid: RendererGridTheme;
  readonly node: RendererNodeTheme;
  readonly edge: RendererEdgeTheme;
  readonly selection: RendererSelectionTheme;
}

export interface RendererPluginPlaceholder {
  readonly id: string;
  readonly kind?: string;
}

export interface RendererInteractionOptions {
  readonly panEnabled: boolean;
  readonly zoomEnabled: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly hitSlop: number;
  readonly edgeHitWidth: number;
  readonly longPressMarqueeEnabled: boolean;
}

export interface ConnectionPreviewState {
  readonly sourceNodeId: NodeId;
  readonly sourcePortId: PortId;
  readonly sourcePosition: Vec2;
  readonly currentPosition: Vec2;
  readonly targetNodeId?: NodeId;
  readonly targetPortId?: PortId;
  readonly valid: boolean;
}

export interface MarqueeSelectionState {
  readonly start: Vec2;
  readonly current: Vec2;
  readonly mode: SelectionChangeMode;
}

export interface RendererInteractionState {
  readonly connectionPreview?: ConnectionPreviewState;
  readonly marqueeSelection?: MarqueeSelectionState;
}

export interface NodeGraphRendererProps {
  readonly snapshot: GraphSnapshot;
  readonly interaction: GraphInteractionContract;
  readonly viewport: RendererViewport;
  readonly theme?: Partial<RendererTheme>;
  readonly plugins?: readonly RendererPluginPlaceholder[];
  readonly interactionOptions?: Partial<RendererInteractionOptions>;
  readonly camera?: Partial<CameraState>;
  readonly interactionState?: RendererInteractionState;
}

export type SceneLayerKind =
  | "background"
  | "grid"
  | "group"
  | "edge"
  | "node"
  | "selection"
  | "interaction"
  | "debug";

export interface SceneBackgroundLayer {
  readonly kind: "background";
  readonly color: string;
}

export interface SceneGridLine {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly major: boolean;
}

export interface SceneGridLayer {
  readonly kind: "grid";
  readonly lines: readonly SceneGridLine[];
  readonly color: string;
  readonly majorColor: string;
}

export interface SceneGroupItem {
  readonly id: string;
  readonly position: Vec2;
  readonly size: Vec2;
  readonly color: string;
  readonly label: string;
}

export interface SceneGroupLayer {
  readonly kind: "group";
  readonly items: readonly SceneGroupItem[];
}

export interface RenderPortLayout {
  readonly id: string;
  readonly name: string;
  readonly direction: "input" | "output";
  readonly position: Vec2;
  readonly radius: number;
  readonly color: string;
}

export interface RenderNodeLayout {
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
  readonly subLabelColor: string;
  readonly ports: readonly RenderPortLayout[];
}

export interface SceneNodeLayer {
  readonly kind: "node";
  readonly items: readonly RenderNodeLayout[];
}

export interface CubicBezierCurve {
  readonly start: Vec2;
  readonly control1: Vec2;
  readonly control2: Vec2;
  readonly end: Vec2;
}

export interface RenderEdgeLayout {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly curve: CubicBezierCurve;
  readonly width: number;
  readonly color: string;
  readonly selected: boolean;
  readonly invalid: boolean;
}

export interface SceneEdgeLayer {
  readonly kind: "edge";
  readonly items: readonly RenderEdgeLayout[];
}

export interface SelectionHighlight {
  readonly targetId: string;
  readonly position: Vec2;
  readonly size: Vec2;
  readonly color: string;
  readonly width: number;
}

export interface SceneSelectionLayer {
  readonly kind: "selection";
  readonly items: readonly SelectionHighlight[];
}

export interface RenderConnectionPreview {
  readonly sourceNodeId: NodeId;
  readonly sourcePortId: PortId;
  readonly sourcePosition: Vec2;
  readonly targetPosition: Vec2;
  readonly targetNodeId?: NodeId;
  readonly targetPortId?: PortId;
  readonly valid: boolean;
}

export interface RenderMarqueeSelection {
  readonly bounds: Bounds;
  readonly mode: SelectionChangeMode;
}

export interface SceneInteractionLayer {
  readonly kind: "interaction";
  readonly connectionPreview?: RenderConnectionPreview;
  readonly marqueeSelection?: RenderMarqueeSelection;
}

export interface SceneDebugLayer {
  readonly kind: "debug";
  readonly enabled: boolean;
  readonly messages: readonly string[];
  readonly color: string;
}

export type SceneLayer =
  | SceneBackgroundLayer
  | SceneGridLayer
  | SceneGroupLayer
  | SceneEdgeLayer
  | SceneNodeLayer
  | SceneSelectionLayer
  | SceneInteractionLayer
  | SceneDebugLayer;

export interface SkiaRenderScene {
  readonly snapshot: GraphSnapshot;
  readonly camera: CameraState;
  readonly viewport: RendererViewport;
  readonly layers: readonly SceneLayer[];
  readonly interaction: GraphInteractionContract;
  readonly theme: RendererTheme;
  readonly plugins: readonly RendererPluginPlaceholder[];
  readonly interactionOptions: RendererInteractionOptions;
}

export interface SkiaRenderPlan {
  readonly scene: SkiaRenderScene;
  readonly nodes: readonly RenderNodeLayout[];
  readonly edges: readonly RenderEdgeLayout[];
  readonly interaction: GraphInteractionContract;
}

export interface BuildSceneOptions {
  readonly snapshot: GraphSnapshot;
  readonly viewport: RendererViewport;
  readonly camera: CameraState;
  readonly theme: RendererTheme;
  readonly plugins: readonly RendererPluginPlaceholder[];
  readonly interaction: GraphInteractionContract;
  readonly interactionOptions: RendererInteractionOptions;
  readonly interactionState?: RendererInteractionState;
}

export interface EdgeRenderState {
  readonly selected: boolean;
  readonly invalid: boolean;
}

export interface StaticGraphExampleScreen {
  readonly id: string;
  readonly title: string;
  readonly snapshot: GraphSnapshot;
  readonly rendererProps: NodeGraphRendererProps;
}

export type SpatialIndexEntryKind = "port" | "node" | "edge" | "group";

export interface PortSpatialIndexEntry {
  readonly kind: "port";
  readonly id: string;
  readonly bounds: Bounds;
  readonly nodeId: NodeId;
  readonly portId: PortId;
}

export interface NodeSpatialIndexEntry {
  readonly kind: "node";
  readonly id: NodeId;
  readonly bounds: Bounds;
}

export interface EdgeSpatialIndexEntry {
  readonly kind: "edge";
  readonly id: EdgeId;
  readonly bounds: Bounds;
}

export interface GroupSpatialIndexEntry {
  readonly kind: "group";
  readonly id: GroupId;
  readonly bounds: Bounds;
}

export type SpatialIndexEntry =
  | PortSpatialIndexEntry
  | NodeSpatialIndexEntry
  | EdgeSpatialIndexEntry
  | GroupSpatialIndexEntry;

export interface SpatialIndex {
  readonly cellSize: number;
  readonly getEntries: () => readonly SpatialIndexEntry[];
  readonly insert: (entry: SpatialIndexEntry) => void;
  readonly update: (entry: SpatialIndexEntry) => void;
  readonly remove: (kind: SpatialIndexEntryKind, id: string) => boolean;
  readonly queryPoint: (point: Vec2) => readonly SpatialIndexEntry[];
  readonly queryBounds: (bounds: Bounds) => readonly SpatialIndexEntry[];
}

export type HitTestTarget =
  | {
      readonly kind: "port";
      readonly nodeId: NodeId;
      readonly portId: PortId;
    }
  | {
      readonly kind: "node";
      readonly nodeId: NodeId;
    }
  | {
      readonly kind: "edge";
      readonly edgeId: EdgeId;
    }
  | {
      readonly kind: "group";
      readonly groupId: GroupId;
    }
  | {
      readonly kind: "canvas";
    };

export interface HitTestResult {
  readonly target: HitTestTarget;
  readonly point: Vec2;
  readonly distance: number;
}

export interface CreateGraphEditorOptions {
  readonly engine: CoreEngine;
  readonly viewport: RendererViewport;
  readonly interaction?: GraphInteractionContract;
  readonly theme?: Partial<RendererTheme>;
  readonly plugins?: readonly RendererPluginPlaceholder[];
  readonly interactionOptions?: Partial<RendererInteractionOptions>;
  readonly camera?: Partial<CameraState>;
}

export interface GraphEditor {
  readonly getSnapshot: () => GraphSnapshot;
  readonly getCamera: () => CameraState;
  readonly getRenderPlan: () => SkiaRenderPlan;
  readonly getSpatialIndex: () => SpatialIndex;
  readonly getInteractionState: () => RendererInteractionState;
  readonly tapAt: (screenPoint: Vec2, mode?: SelectionChangeMode) => HitTestResult;
  readonly doubleTapAt: (screenPoint: Vec2) => HitTestResult;
  readonly longPressAt: (screenPoint: Vec2, mode?: SelectionChangeMode) => HitTestResult;
  readonly beginDragAt: (screenPoint: Vec2, mode?: SelectionChangeMode) => HitTestResult;
  readonly dragTo: (screenPoint: Vec2) => GraphSnapshot;
  readonly endDrag: () => GraphSnapshot;
  readonly pinchAt: (screenPoint: Vec2, zoomFactor: number) => CameraState;
  readonly beginMarquee: (screenPoint: Vec2, mode?: SelectionChangeMode) => void;
  readonly updateMarquee: (screenPoint: Vec2) => SelectionSnapshot;
  readonly endMarquee: () => SelectionSnapshot;
  readonly startConnectionPreview: (screenPoint: Vec2) => HitTestResult;
  readonly updateConnectionPreview: (screenPoint: Vec2) => ConnectionPreviewState | undefined;
  readonly commitConnectionPreview: () => Edge | undefined;
  readonly cancelConnectionPreview: () => void;
}

export type RendererNodeSnapshot = GraphNodeSnapshot;
export type RendererEdgeSnapshot = GraphEdgeSnapshot;
