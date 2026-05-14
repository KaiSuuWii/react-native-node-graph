import type {
  CoreEngine,
  GraphSnapshot
} from "@kaiisuuwii/core";
import type {
  CameraState,
  CubicBezierCurve,
  GraphEditor,
  ImageLoader,
  RendererAccessibilityOptions,
  RendererDebugOptions,
  RendererImageCache,
  RendererPlugin,
  RendererTheme,
  RendererThemeMode,
  RendererThemeScale,
  RendererVirtualizationOptions,
  SkiaRenderPlan,
  TextEditCommitEvent
} from "@kaiisuuwii/renderer-skia";
import type { EdgeId, NodeId, Vec2 } from "@kaiisuuwii/shared";

import type { SharedValue, StyleProp, ViewStyle } from "./runtime.js";

export interface SpringConfig {
  readonly damping?: number;
  readonly stiffness?: number;
  readonly mass?: number;
  readonly overshootClamping?: boolean;
  readonly restDisplacementThreshold?: number;
  readonly restSpeedThreshold?: number;
}

export interface AnimatedCameraState {
  readonly offsetX: SharedValue<number>;
  readonly offsetY: SharedValue<number>;
  readonly zoom: SharedValue<number>;
  readonly toPlain: () => CameraState;
  readonly animatePanTo: (target: Vec2, config?: SpringConfig) => void;
  readonly animateZoomTo: (targetZoom: number, originScreen: Vec2, config?: SpringConfig) => void;
  readonly applyMomentum: (velocity: Vec2) => void;
}

export interface GraphEditorAnimationState {
  readonly camera: AnimatedCameraState;
  readonly draggingNodeId: SharedValue<string | undefined>;
  readonly draggingNodeOffset: SharedValue<Vec2>;
  readonly connectionWireEnd: SharedValue<Vec2 | undefined>;
  readonly marqueeStart: SharedValue<Vec2 | undefined>;
  readonly marqueeEnd: SharedValue<Vec2 | undefined>;
  readonly selectionPulse: SharedValue<number>;
}

export interface NodeGraphCanvasProps {
  readonly engine: CoreEngine;
  readonly rendererPlugins?: readonly RendererPlugin[];
  readonly imageCache?: RendererImageCache;
  readonly imageLoader?: ImageLoader;
  readonly initialCamera?: Partial<CameraState>;
  readonly theme?: Partial<RendererTheme>;
  readonly themeMode?: RendererThemeMode;
  readonly themeScale?: RendererThemeScale;
  readonly panEnabled?: boolean;
  readonly zoomEnabled?: boolean;
  readonly dragEnabled?: boolean;
  readonly selectionEnabled?: boolean;
  readonly connectionEnabled?: boolean;
  readonly marqueeEnabled?: boolean;
  readonly zoomMin?: number;
  readonly zoomMax?: number;
  readonly panDecelerationRate?: number;
  readonly zoomDecelerationRate?: number;
  readonly nodeDragSpringConfig?: SpringConfig;
  readonly panSpringConfig?: SpringConfig;
  readonly zoomSpringConfig?: SpringConfig;
  readonly accessibility?: RendererAccessibilityOptions;
  readonly virtualization?: RendererVirtualizationOptions;
  readonly debug?: RendererDebugOptions;
  readonly onNodeSelected?: (nodeId: NodeId | undefined) => void;
  readonly onEdgeSelected?: (edgeId: EdgeId | undefined) => void;
  readonly onNodeDoubleTap?: (nodeId: NodeId) => void;
  readonly onConnectionCreated?: (edgeId: EdgeId) => void;
  readonly onTextEditBegin?: (nodeId: NodeId, propertyKey: string) => void;
  readonly onTextEditCommit?: (event: TextEditCommitEvent) => void;
  readonly style?: StyleProp<ViewStyle>;
}

export interface UseCameraOptions {
  readonly initial?: Partial<CameraState>;
  readonly zoomMin?: number;
  readonly zoomMax?: number;
  readonly panDecelerationRate?: number;
  readonly zoomDecelerationRate?: number;
  readonly panSpringConfig?: SpringConfig;
  readonly zoomSpringConfig?: SpringConfig;
}

export interface DragOptions {
  readonly springConfig?: SpringConfig;
  readonly snapToGrid?: number;
}

export interface DragController {
  readonly draggingNodeId: SharedValue<string | undefined>;
  readonly dragOffset: SharedValue<Vec2>;
  readonly onDragStart: (nodeId: string, screenPosition: Vec2) => void;
  readonly onDragMove: (screenPosition: Vec2) => void;
  readonly onDragEnd: () => void;
}

export interface ConnectionWireController {
  readonly connectionWireEnd: SharedValue<Vec2 | undefined>;
  readonly getCurve: () => CubicBezierCurve | undefined;
  readonly onConnectionStart: (sourcePortPosition: Vec2) => void;
  readonly onConnectionMove: (screenPosition: Vec2) => void;
  readonly onConnectionEnd: () => void;
}

export interface GestureEvent {
  readonly x: number;
  readonly y: number;
}

export interface PanGestureEvent extends GestureEvent {
  readonly translationX?: number;
  readonly translationY?: number;
  readonly velocityX?: number;
  readonly velocityY?: number;
}

export interface PinchGestureEvent extends GestureEvent {
  readonly scale: number;
  readonly velocity?: number;
}

export interface TapGestureDescriptor {
  readonly kind: "tap";
  readonly taps: number;
  readonly onEnd: (event: GestureEvent) => void;
}

export interface LongPressGestureDescriptor {
  readonly kind: "long-press";
  readonly minDurationMs: number;
  readonly onStart: (event: GestureEvent) => void;
}

export interface PanGestureDescriptor {
  readonly kind: "pan";
  readonly minDistance: number;
  readonly onStart: (event: PanGestureEvent) => void;
  readonly onUpdate: (event: PanGestureEvent) => void;
  readonly onEnd: (event: PanGestureEvent) => void;
}

export interface PinchGestureDescriptor {
  readonly kind: "pinch";
  readonly onStart: (event: PinchGestureEvent) => void;
  readonly onUpdate: (event: PinchGestureEvent) => void;
  readonly onEnd: (event: PinchGestureEvent) => void;
}

export interface ComposedGesture {
  readonly kind: "composed";
  readonly singleTap: TapGestureDescriptor;
  readonly doubleTap: TapGestureDescriptor;
  readonly longPress: LongPressGestureDescriptor;
  readonly pan: PanGestureDescriptor;
  readonly pinch: PinchGestureDescriptor;
}

export interface GestureParams {
  readonly editor: GraphEditor;
  readonly camera: AnimatedCameraState;
  readonly dragController: DragController;
  readonly options: NodeGraphCanvasProps;
}

export interface GraphEditorHookResult {
  readonly cameraState: AnimatedCameraState;
  readonly animationState: GraphEditorAnimationState;
  readonly buildRenderPlan: () => SkiaRenderPlan;
  readonly editor: GraphEditor;
  readonly dragController: DragController;
  readonly connectionWire: ConnectionWireController;
  readonly syncSnapshot: (snapshot?: GraphSnapshot) => SkiaRenderPlan;
  readonly dispose: () => void;
}

export interface NodeGraphCanvasHandle {
  readonly type: "NodeGraphCanvas";
  readonly props: NodeGraphCanvasProps;
  readonly editor: GraphEditor;
  readonly gestures: ComposedGesture;
  readonly animationState: GraphEditorAnimationState;
  readonly getRenderPlan: () => SkiaRenderPlan;
  readonly getRenderCount: () => number;
  readonly commitTextEdit: () => TextEditCommitEvent | undefined;
  readonly dispose: () => void;
}
