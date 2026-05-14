import type { GraphEdgeSnapshot, GraphNodeSnapshot, GraphSnapshot } from "@kaiisuuwii/core";
import { addVec2, vec2, type Bounds } from "@kaiisuuwii/shared";

import { createEdgeLayout, createGroupLayout, createNodeLayout } from "./layout.js";
import {
  estimateFrameMetrics,
  expandBounds,
  getCurveBounds,
  getGroupItemBounds,
  getNodeSnapshotBounds,
  getViewportBounds,
  resolveNodeLevelOfDetail,
  unionBounds,
  boundsIntersect
} from "./performance.js";
import type {
  AccessibilityDescriptor,
  BuildSceneOptions,
  DebugOverlay,
  PresenceCursor,
  PresenceSelectionRing,
  RenderConnectionPreview,
  RenderEdgeLayout,
  RenderNodeLayout,
  RendererPlugin,
  RendererPluginContext,
  RendererPluginOverlay,
  RendererScenePluginContext,
  SceneAccessibilityState,
  ScenePluginLayer,
  SceneDiagnostics,
  SceneGroupItem,
  SceneGridLayer,
  SceneInteractionLayer,
  SceneLayer,
  ScenePresenceLayer,
  SceneSelectionLayer,
  SelectionHighlight,
  SkiaRenderScene
} from "./types.js";

const createGridLayer = ({
  viewport,
  camera,
  theme
}: Pick<BuildSceneOptions, "viewport" | "camera" | "theme">): SceneGridLayer => {
  if (!theme.grid.visible) {
    return {
      kind: "grid",
      lines: [],
      color: theme.grid.color,
      majorColor: theme.grid.majorColor
    };
  }

  const spacing = theme.grid.spacing;
  const majorSpacing = spacing * theme.grid.majorSpacingMultiplier;
  const graphMinX = camera.position.x;
  const graphMinY = camera.position.y;
  const graphMaxX = camera.position.x + viewport.width / camera.zoom;
  const graphMaxY = camera.position.y + viewport.height / camera.zoom;
  const startX = Math.floor(graphMinX / spacing) * spacing;
  const startY = Math.floor(graphMinY / spacing) * spacing;
  const lines: Array<SceneGridLayer["lines"][number]> = [];

  for (let x = startX; x <= graphMaxX; x += spacing) {
    const major = Math.round(x / majorSpacing) * majorSpacing === x;
    lines.push({
      from: vec2(x, graphMinY),
      to: vec2(x, graphMaxY),
      major
    });
  }

  for (let y = startY; y <= graphMaxY; y += spacing) {
    const major = Math.round(y / majorSpacing) * majorSpacing === y;
    lines.push({
      from: vec2(graphMinX, y),
      to: vec2(graphMaxX, y),
      major
    });
  }

  return {
    kind: "grid",
    lines,
    color: theme.grid.color,
    majorColor: theme.grid.majorColor
  };
};

const createSelectionLayer = (
  snapshot: GraphSnapshot,
  edgeLayouts: readonly RenderEdgeLayout[],
  nodeLayouts: readonly RenderNodeLayout[],
  groupItems: readonly SceneGroupItem[],
  selectionColor: string,
  selectionWidth: number
): SceneSelectionLayer => ({
  kind: "selection",
  items: [
    ...nodeLayouts.flatMap((layout) =>
      snapshot.selection.nodeIds.includes(layout.id)
        ? [
            {
              targetId: layout.id,
              position: addVec2(layout.position, vec2(-6, -6)),
              size: vec2(layout.size.x + 12, layout.size.y + 12),
              color: selectionColor,
              width: selectionWidth
            }
          ]
        : []
    ),
    ...edgeLayouts.flatMap((layout) =>
      snapshot.selection.edgeIds.includes(layout.id)
        ? [
            {
              targetId: layout.id,
              position: vec2(
                Math.min(layout.curve.start.x, layout.curve.end.x) - 6,
                Math.min(layout.curve.start.y, layout.curve.end.y) - 6
              ),
              size: vec2(
                Math.abs(layout.curve.end.x - layout.curve.start.x) + 12,
                Math.abs(layout.curve.end.y - layout.curve.start.y) + 12
              ),
              color: selectionColor,
              width: selectionWidth
            }
          ]
        : []
    ),
    ...groupItems.flatMap((group) =>
      snapshot.selection.groupIds.includes(group.id)
        ? [
            {
              targetId: group.id,
              position: addVec2(group.position, vec2(-8, -8)),
              size: vec2(group.size.x + 16, group.size.y + 16),
              color: selectionColor,
              width: selectionWidth
            }
          ]
        : []
    )
  ] satisfies SelectionHighlight[]
});

const createInteractionLayer = (options: BuildSceneOptions): SceneInteractionLayer => {
  const connectionPreview = options.interactionState?.connectionPreview;
  const marqueeSelection = options.interactionState?.marqueeSelection;

  const renderedPreview: RenderConnectionPreview | undefined =
    connectionPreview === undefined
      ? undefined
      : {
          sourceNodeId: connectionPreview.sourceNodeId,
          sourcePortId: connectionPreview.sourcePortId,
          sourcePosition: connectionPreview.sourcePosition,
          targetPosition: connectionPreview.currentPosition,
          ...(connectionPreview.targetNodeId !== undefined
            ? { targetNodeId: connectionPreview.targetNodeId }
            : {}),
          ...(connectionPreview.targetPortId !== undefined
            ? { targetPortId: connectionPreview.targetPortId }
            : {}),
          valid: connectionPreview.valid
        };

  return {
    kind: "interaction",
    ...(renderedPreview !== undefined ? { connectionPreview: renderedPreview } : {}),
    ...(marqueeSelection !== undefined
      ? {
          marqueeSelection: {
            bounds: {
              min: vec2(
                Math.min(marqueeSelection.start.x, marqueeSelection.current.x),
                Math.min(marqueeSelection.start.y, marqueeSelection.current.y)
              ),
              max: vec2(
                Math.max(marqueeSelection.start.x, marqueeSelection.current.x),
                Math.max(marqueeSelection.start.y, marqueeSelection.current.y)
              )
            },
            mode: marqueeSelection.mode
          }
        }
      : {})
  };
};

const toInitials = (displayName: string): string =>
  displayName
    .split(/\s+/)
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

const createPresenceLayer = (
  options: BuildSceneOptions,
  nodeLayouts: readonly RenderNodeLayout[]
): ScenePresenceLayer => {
  const presenceOverlays = options.presenceOverlays ?? [];
  const cursors: PresenceCursor[] = [];
  const selections: PresenceSelectionRing[] = [];

  presenceOverlays.forEach((overlay) => {
    if (overlay.cursorPosition !== undefined) {
      cursors.push({
        userId: overlay.userId,
        displayName: overlay.displayName,
        color: overlay.color,
        position: overlay.cursorPosition,
        initials: toInitials(overlay.displayName),
        tooltipPosition: vec2(overlay.cursorPosition.x, overlay.cursorPosition.y - 18)
      });
    }

    overlay.selectedNodeIds.forEach((nodeId) => {
      const nodeLayout = nodeLayouts.find((layout) => layout.id === nodeId);

      if (nodeLayout === undefined) {
        return;
      }

      selections.push({
        userId: overlay.userId,
        targetId: nodeId,
        position: addVec2(nodeLayout.position, vec2(-4, -4)),
        size: vec2(nodeLayout.size.x + 8, nodeLayout.size.y + 8),
        color: overlay.color,
        width: Math.max(1, options.theme.selection.width - 1),
        dashed: true
      });
    });
  });

  return {
    kind: "presence",
    cursors,
    selections
  };
};

const DEFAULT_KEYBOARD_NAVIGATION_POLICY = [
  "Tab moves focus across visible nodes, groups, and edges in deterministic layout order.",
  "Shift+Tab reverses focus order.",
  "Enter activates the currently focused target in the hosting app.",
  "Arrow keys pan the canvas when focus is on the graph surface."
] as const;

const shouldPreserveNode = (snapshot: GraphSnapshot, nodeId: string, options: BuildSceneOptions): boolean =>
  options.virtualization.preserveSelectedElements && snapshot.selection.nodeIds.includes(nodeId as never);

const shouldPreserveEdge = (snapshot: GraphSnapshot, edgeId: string, options: BuildSceneOptions): boolean =>
  options.virtualization.preserveSelectedElements && snapshot.selection.edgeIds.includes(edgeId as never);

const shouldPreserveGroup = (snapshot: GraphSnapshot, groupId: string, options: BuildSceneOptions): boolean =>
  options.virtualization.preserveSelectedElements && snapshot.selection.groupIds.includes(groupId as never);

const createRendererPluginContext = (
  options: BuildSceneOptions
): RendererPluginContext => ({
  snapshot: options.snapshot,
  viewport: options.viewport,
  camera: options.camera,
  theme: options.theme,
  ...(options.interactionState !== undefined ? { interactionState: options.interactionState } : {})
});

const applyNodePlugins = (
  layout: RenderNodeLayout,
  node: GraphNodeSnapshot,
  plugins: readonly RendererPlugin[],
  context: RendererPluginContext
): RenderNodeLayout =>
  plugins.reduce((currentLayout, plugin) => {
    try {
      return plugin.decorateNodeLayout?.(currentLayout, node, context) ?? currentLayout;
    } catch {
      return currentLayout;
    }
  }, layout);

const applyEdgePlugins = (
  layout: RenderEdgeLayout,
  edge: GraphEdgeSnapshot,
  plugins: readonly RendererPlugin[],
  context: RendererPluginContext
): RenderEdgeLayout =>
  plugins.reduce((currentLayout, plugin) => {
    try {
      return plugin.decorateEdgeLayout?.(currentLayout, edge, context) ?? currentLayout;
    } catch {
      return currentLayout;
    }
  }, layout);

const createPluginLayer = (
  options: BuildSceneOptions,
  nodeLayouts: readonly RenderNodeLayout[],
  edgeLayouts: readonly RenderEdgeLayout[]
): ScenePluginLayer => {
  const baseContext = createRendererPluginContext(options);
  const context: RendererScenePluginContext = {
    ...baseContext,
    nodes: nodeLayouts,
    edges: edgeLayouts
  };
  const overlays: RendererPluginOverlay[] = [];

  options.plugins.forEach((plugin) => {
    try {
      overlays.push(...(plugin.createOverlays?.(context) ?? []));
    } catch {
      // Plugin overlay errors are isolated from scene construction.
    }
  });

  return {
    kind: "plugin",
    overlays,
    interactions: options.plugins.flatMap((plugin) => plugin.interactionHandlers ?? [])
  };
};

const createAccessibilityState = (
  options: BuildSceneOptions,
  groupItems: readonly SceneGroupItem[],
  nodeLayouts: readonly RenderNodeLayout[],
  edgeLayouts: readonly RenderEdgeLayout[]
): SceneAccessibilityState => {
  const visibleDescriptors = [
    ...nodeLayouts
      .map((node) => ({
        id: node.id,
        role: "node" as const,
        label: node.accessibilityLabel,
        hint: node.accessibilityHint,
        x: node.position.x,
        y: node.position.y
      }))
      .sort((left, right) =>
        left.y === right.y ? left.x - right.x : left.y - right.y
      ),
    ...groupItems
      .map((group) => ({
        id: group.id,
        role: "group" as const,
        label: group.accessibilityLabel,
        hint: "Use group selection to move or inspect grouped nodes together.",
        x: group.position.x,
        y: group.position.y
      }))
      .sort((left, right) =>
        left.y === right.y ? left.x - right.x : left.y - right.y
      ),
    ...edgeLayouts.map((edge) => ({
      id: edge.id,
      role: "edge" as const,
      label: edge.accessibilityLabel,
      hint: edge.accessibilityHint,
      x: edge.curve.start.x,
      y: edge.curve.start.y
    }))
  ];
  const focusOrder = visibleDescriptors.map((descriptor) => descriptor.id);
  const fallbackFocusTargetId =
    options.accessibility.focusTargetId ??
    options.snapshot.selection.nodeIds[0] ??
    options.snapshot.selection.groupIds[0] ??
    options.snapshot.selection.edgeIds[0] ??
    focusOrder[0];
  const isResolvedFocusTarget =
    fallbackFocusTargetId === undefined
      ? false
      : fallbackFocusTargetId === "canvas" ||
        visibleDescriptors.some((descriptor) => descriptor.id === fallbackFocusTargetId);
  const descriptors: Record<string, AccessibilityDescriptor> = {
    canvas: {
      id: "canvas",
      role: "canvas",
      label: `${options.snapshot.metadata.name} graph canvas`,
      hint: "Pan, zoom, and use focus navigation to inspect graph elements.",
      focused: !isResolvedFocusTarget
    }
  };

  visibleDescriptors.forEach((descriptor) => {
    descriptors[descriptor.id] = {
      id: descriptor.id,
      role: descriptor.role,
      label: descriptor.label,
      hint: descriptor.hint,
      focused: descriptor.id === fallbackFocusTargetId && isResolvedFocusTarget
    };
  });

  const announcements =
    options.accessibility.announceValidationErrors && !isResolvedFocusTarget
      ? ["Focused graph element is unavailable. Validation overlay should report the mismatch."]
      : [];

  return {
    enabled: options.accessibility.enabled,
    screenReaderEnabled: options.accessibility.screenReaderEnabled,
    scalableUiEnabled: options.accessibility.scalableUiEnabled,
    keyboardNavigationEnabled: options.accessibility.keyboardNavigationEnabled,
    ...(fallbackFocusTargetId !== undefined ? { focusTargetId: fallbackFocusTargetId } : {}),
    focusOrder,
    descriptors,
    keyboardNavigationPolicy: DEFAULT_KEYBOARD_NAVIGATION_POLICY,
    announcements
  };
};

const createVisibleNodes = (
  options: BuildSceneOptions,
  viewportBounds: Bounds
): { readonly visibleNodes: readonly GraphNodeSnapshot[]; readonly nodeLayouts: readonly RenderNodeLayout[] } => {
  const lod = resolveNodeLevelOfDetail(options.camera.zoom, options.virtualization);
  const pluginContext = createRendererPluginContext(options);
  const visibleNodes = options.snapshot.nodes.filter((node) => {
    if (!options.virtualization.enabled || !options.virtualization.suppressOffscreenNodes) {
      return true;
    }

    return (
      shouldPreserveNode(options.snapshot, node.id, options) ||
      boundsIntersect(getNodeSnapshotBounds(node), viewportBounds)
    );
  });

  return {
    visibleNodes,
    nodeLayouts: visibleNodes.map((node) =>
      applyNodePlugins(
        createNodeLayout(node, options.theme, {
          lod,
          ...(options.interactionState !== undefined
            ? { interactionState: options.interactionState }
            : {}),
          ...(options.resolveNodeType !== undefined
            ? { resolveNodeType: options.resolveNodeType }
            : {}),
          ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
          ...(options.imageCache !== undefined ? { imageCache: options.imageCache } : {})
        }),
        node,
        options.plugins,
        pluginContext
      )
    )
  };
};

const createVisibleGroups = (
  options: BuildSceneOptions,
  visibleNodeIds: readonly string[],
  viewportBounds: Bounds
): readonly SceneGroupItem[] => {
  const visibleNodeIdSet = new Set(visibleNodeIds);

  return createGroupLayout(options.snapshot, options.theme).filter((group) => {
    if (!options.virtualization.enabled) {
      return true;
    }

    const hasVisibleMember = options.snapshot.groups
      .find((candidate) => candidate.id === group.id)
      ?.nodeIds.some((nodeId) => visibleNodeIdSet.has(nodeId));

    return (
      shouldPreserveGroup(options.snapshot, group.id, options) ||
      hasVisibleMember === true ||
      boundsIntersect(getGroupItemBounds(group), viewportBounds)
    );
  });
};

const createVisibleEdges = (
  options: BuildSceneOptions,
  visibleNodeIds: readonly string[],
  viewportBounds: Bounds
): readonly RenderEdgeLayout[] => {
  const visibleNodeIdSet = new Set(visibleNodeIds);
  const pluginContext = createRendererPluginContext(options);
  const simplifyEdges =
    options.virtualization.enabled &&
    options.camera.zoom < options.virtualization.levelOfDetail.edgeSimplification;

  return options.snapshot.edges.flatMap((edge) => {
    const isSelected = options.snapshot.selection.edgeIds.includes(edge.id);
    const isInvalid = edge.source === edge.target;
    const layout = createEdgeLayout(edge, options.snapshot, options.theme, {
      selected: isSelected,
      invalid: isInvalid
    }, {
      simplified: simplifyEdges
    });

    if (layout === undefined) {
      return [];
    }

    const decoratedLayout = applyEdgePlugins(layout, edge, options.plugins, pluginContext);

    if (!options.virtualization.enabled || !options.virtualization.suppressOffscreenEdges) {
      return [decoratedLayout];
    }

    const isVisibleByNode = visibleNodeIdSet.has(edge.source) || visibleNodeIdSet.has(edge.target);
    const isVisibleByBounds = boundsIntersect(
      getCurveBounds(layout.curve, options.interactionOptions.edgeHitWidth),
      viewportBounds
    );

    return isVisibleByNode || isVisibleByBounds || shouldPreserveEdge(options.snapshot, edge.id, options)
      ? [decoratedLayout]
      : [];
  });
};

const createBoundsRecord = (
  groupItems: readonly SceneGroupItem[],
  nodeLayouts: readonly RenderNodeLayout[],
  edgeLayouts: readonly RenderEdgeLayout[],
  edgeHitWidth: number,
  viewportBounds?: Bounds
): Readonly<Record<string, Bounds>> => ({
  ...(viewportBounds !== undefined ? { viewport: viewportBounds } : {}),
  ...Object.fromEntries(groupItems.map((group) => [`group:${group.id}`, getGroupItemBounds(group)])),
  ...Object.fromEntries(
    nodeLayouts.map((layout) => [
      `node:${layout.id}`,
      {
        min: layout.position,
        max: vec2(layout.position.x + layout.size.x, layout.position.y + layout.size.y)
      }
    ])
  ),
  ...Object.fromEntries(
    edgeLayouts.map((layout) => [
      `edge:${layout.id}`,
      getCurveBounds(layout.curve, edgeHitWidth)
    ])
  )
});

const createRedrawBounds = (
  previousScene: SkiaRenderScene | undefined,
  currentBounds: Readonly<Record<string, Bounds>>,
  incrementalRedrawEnabled: boolean,
  edgeHitWidth: number
): Bounds | undefined => {
  if (!incrementalRedrawEnabled) {
    return undefined;
  }

  if (previousScene === undefined) {
    return unionBounds(Object.values(currentBounds));
  }

  const previousGroupItems =
    previousScene.layers.find((layer) => layer.kind === "group")?.kind === "group"
      ? previousScene.layers.find((layer) => layer.kind === "group")!.items
      : [];
  const previousNodeItems =
    previousScene.layers.find((layer) => layer.kind === "node")?.kind === "node"
      ? previousScene.layers.find((layer) => layer.kind === "node")!.items
      : [];
  const previousEdgeItems =
    previousScene.layers.find((layer) => layer.kind === "edge")?.kind === "edge"
      ? previousScene.layers.find((layer) => layer.kind === "edge")!.items
      : [];
  const previousBounds = createBoundsRecord(
    previousGroupItems,
    previousNodeItems,
    previousEdgeItems,
    edgeHitWidth,
    previousScene.diagnostics.viewportBounds
  );
  const keys = new Set([...Object.keys(previousBounds), ...Object.keys(currentBounds)]);
  const changed: Bounds[] = [];

  keys.forEach((key) => {
    const previous = previousBounds[key];
    const current = currentBounds[key];

    if (previous === undefined && current !== undefined) {
      changed.push(current);
      return;
    }

    if (current === undefined && previous !== undefined) {
      changed.push(previous);
      return;
    }

    if (
      previous !== undefined &&
      current !== undefined &&
      (previous.min.x !== current.min.x ||
        previous.min.y !== current.min.y ||
        previous.max.x !== current.max.x ||
        previous.max.y !== current.max.y)
    ) {
      changed.push(previous, current);
    }
  });

  return unionBounds(changed.length > 0 ? changed : Object.values(currentBounds));
};

const createDebugOverlays = (
  options: BuildSceneOptions,
  diagnostics: SceneDiagnostics,
  groupItems: readonly SceneGroupItem[],
  nodeLayouts: readonly RenderNodeLayout[],
  edgeLayouts: readonly RenderEdgeLayout[]
): readonly DebugOverlay[] => {
  if (!options.debug.enabled) {
    return [];
  }

  const overlays: DebugOverlay[] = [];

  if (options.debug.showRenderBounds) {
    overlays.push({
      kind: "bounds",
      label: "viewport",
      bounds: diagnostics.viewportBounds,
      color: options.theme.debugColor
    });

    if (diagnostics.redrawBounds !== undefined) {
      overlays.push({
        kind: "bounds",
        label: "redraw",
        bounds: diagnostics.redrawBounds,
        color: options.theme.selection.color
      });
    }
  }

  if (options.debug.showHitRegions) {
    nodeLayouts.forEach((node) => {
      overlays.push({
        kind: "bounds",
        label: `node:${node.id}`,
        bounds: {
          min: node.position,
          max: vec2(node.position.x + node.size.x, node.position.y + node.size.y)
        },
        color: options.theme.debugColor
      });

      node.ports.forEach((port) => {
        overlays.push({
          kind: "bounds",
          label: `port:${port.id}`,
          bounds: {
            min: vec2(port.position.x - port.radius, port.position.y - port.radius),
            max: vec2(port.position.x + port.radius, port.position.y + port.radius)
          },
          color: options.theme.edge.selectedColor
        });
      });
    });

    edgeLayouts.forEach((edge) => {
      overlays.push({
        kind: "bounds",
        label: `edge:${edge.id}`,
        bounds: getCurveBounds(edge.curve, options.interactionOptions.edgeHitWidth),
        color: options.theme.edge.color
      });
    });

    groupItems.forEach((group) => {
      overlays.push({
        kind: "bounds",
        label: `group:${group.id}`,
        bounds: getGroupItemBounds(group),
        color: options.theme.groupColor
      });
    });
  }

  if (options.debug.showEdgeRouting) {
    edgeLayouts.forEach((edge) => {
      overlays.push({
        kind: "path",
        label: `route:${edge.id}`,
        points: edge.routePoints,
        color: options.theme.edge.selectedColor
      });
    });
  }

  if (options.debug.showFpsOverlay && diagnostics.fps !== undefined) {
    overlays.push({
      kind: "text",
      label: "fps",
      position: diagnostics.viewportBounds.min,
      text: `${diagnostics.fps.toFixed(1)} fps`,
      color: options.theme.debugColor
    });
  }

  return overlays;
};

export const buildSkiaRenderScene = (options: BuildSceneOptions): SkiaRenderScene => {
  const viewportBounds = getViewportBounds(
    options.viewport,
    options.camera,
    options.virtualization.enabled ? options.virtualization.cullingPadding : 0
  );
  const lod = resolveNodeLevelOfDetail(options.camera.zoom, options.virtualization);
  const { visibleNodes, nodeLayouts } = createVisibleNodes(options, viewportBounds);
  const groupItems = createVisibleGroups(
    options,
    visibleNodes.map((node) => node.id),
    viewportBounds
  );
  const edgeLayouts = createVisibleEdges(
    options,
    visibleNodes.map((node) => node.id),
    viewportBounds
  );
  const pluginLayer = createPluginLayer(options, nodeLayouts, edgeLayouts);
  const presenceLayer = createPresenceLayer(options, nodeLayouts);
  const currentBounds = createBoundsRecord(
    groupItems,
    nodeLayouts,
    edgeLayouts,
    options.interactionOptions.edgeHitWidth,
    viewportBounds
  );
  const redrawBounds = createRedrawBounds(
    options.previousScene,
    currentBounds,
    options.virtualization.incrementalRedrawEnabled,
    options.interactionOptions.edgeHitWidth
  );
  const frameMetrics = estimateFrameMetrics(
    options.previousScene?.diagnostics.frameTimestampMs,
    options.frameTimestampMs,
    options.debug
  );
  const diagnostics: SceneDiagnostics = {
    viewportBounds,
    ...(redrawBounds !== undefined ? { redrawBounds: expandBounds(redrawBounds, 8) } : {}),
    lod,
    totalNodeCount: options.snapshot.nodes.length,
    visibleNodeCount: nodeLayouts.length,
    culledNodeCount: options.snapshot.nodes.length - nodeLayouts.length,
    totalEdgeCount: options.snapshot.edges.length,
    visibleEdgeCount: edgeLayouts.length,
    culledEdgeCount: options.snapshot.edges.length - edgeLayouts.length,
    totalGroupCount: options.snapshot.groups.length,
    visibleGroupCount: groupItems.length,
    ...(options.frameTimestampMs !== undefined ? { frameTimestampMs: options.frameTimestampMs } : {}),
    ...frameMetrics
  };
  const accessibility = createAccessibilityState(
    options,
    groupItems,
    nodeLayouts,
    edgeLayouts
  );
  const layers: SceneLayer[] = [
    {
      kind: "background",
      color: options.theme.backgroundColor
    },
    createGridLayer(options),
    {
      kind: "group",
      items: groupItems
    },
    {
      kind: "edge",
      items: edgeLayouts
    },
    {
      kind: "node",
      items: nodeLayouts
    },
    createSelectionLayer(
      options.snapshot,
      edgeLayouts,
      nodeLayouts,
      groupItems,
      options.theme.selection.color,
      options.theme.selection.width
    ),
    createInteractionLayer(options),
    pluginLayer,
    presenceLayer,
    {
      kind: "debug",
      enabled: options.debug.enabled,
      ...(diagnostics.fps !== undefined ? { fps: diagnostics.fps } : {}),
      messages: [
        `plugins:${options.plugins.length}`,
        `interactions:${pluginLayer.interactions.length}`,
        `zoom:${options.camera.zoom.toFixed(2)}`,
        `nodes:${diagnostics.visibleNodeCount}/${diagnostics.totalNodeCount}`,
        `edges:${diagnostics.visibleEdgeCount}/${diagnostics.totalEdgeCount}`
      ],
      overlays: createDebugOverlays(options, diagnostics, groupItems, nodeLayouts, edgeLayouts),
      color: options.theme.debugColor
    }
  ];

  return {
    snapshot: options.snapshot,
    camera: options.camera,
    viewport: options.viewport,
    diagnostics,
    accessibility,
    layers,
    interaction: options.interaction,
    theme: options.theme,
    plugins: options.plugins.map((plugin) => ({
      name: plugin.name,
      interactionHandlerIds: (plugin.interactionHandlers ?? []).map((handler) => handler.id)
    })),
    interactionOptions: options.interactionOptions
  };
};
