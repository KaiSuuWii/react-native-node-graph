import type {
  EdgeId,
  GraphId,
  GraphInteractionEventPayload,
  GraphMetadata,
  NodeId,
  Vec2
} from "@react-native-node-graph/shared";

export type PortId = `port_${string}`;
export type GroupId = `group_${string}`;
export type PortDirection = "input" | "output";
export type SelectionChangeMode = "replace" | "add" | "toggle";
export type ActiveSelectionMode = "none" | "node" | "edge" | "group" | "mixed";

export interface Port {
  readonly id: PortId;
  readonly name: string;
  readonly direction: PortDirection;
  readonly dataType?: string;
  readonly accepts?: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Node {
  readonly id: NodeId;
  readonly type: string;
  readonly position: Vec2;
  readonly dimensions: Vec2;
  readonly label: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly ports: readonly Port[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly groupId?: GroupId;
}

export interface Edge {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly sourcePortId?: PortId;
  readonly targetPortId?: PortId;
  readonly dataType?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Group {
  readonly id: GroupId;
  readonly name: string;
  readonly nodeIds: readonly NodeId[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface SelectionSnapshot {
  readonly nodeIds: readonly NodeId[];
  readonly edgeIds: readonly EdgeId[];
  readonly groupIds: readonly GroupId[];
  readonly activeSelectionMode: ActiveSelectionMode;
}

export interface Graph {
  readonly id: GraphId;
  readonly metadata: GraphMetadata;
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly groups: readonly Group[];
  readonly selection: SelectionSnapshot;
}

export type GraphNodeSnapshot = Node;
export type GraphEdgeSnapshot = Edge;
export type GraphSnapshot = Graph;

export interface GraphInteractionContract {
  readonly onEvent: (event: GraphInteractionEventPayload) => void;
}

export interface PortInput {
  readonly id?: PortId;
  readonly name: string;
  readonly direction: PortDirection;
  readonly dataType?: string;
  readonly accepts?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GroupInput {
  readonly id?: GroupId;
  readonly name: string;
  readonly nodeIds?: readonly NodeId[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NodeInput {
  readonly id?: NodeId;
  readonly type: string;
  readonly position: Vec2;
  readonly dimensions?: Vec2;
  readonly label?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly ports?: readonly PortInput[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly groupId?: GroupId;
}

export interface EdgeInput {
  readonly id?: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly sourcePortId?: PortId;
  readonly targetPortId?: PortId;
  readonly dataType?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GraphInput {
  readonly id?: GraphId;
  readonly metadata?: Partial<GraphMetadata>;
  readonly nodes?: readonly NodeInput[];
  readonly edges?: readonly EdgeInput[];
  readonly groups?: readonly GroupInput[];
  readonly selection?: Partial<SelectionSnapshot>;
}

export interface ValidationIssueBase {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly entityId?: string;
}

export interface ValidationError extends ValidationIssueBase {
  readonly severity: "error";
}

export interface ValidationWarning extends ValidationIssueBase {
  readonly severity: "warning";
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface NodeTypeDefinition {
  readonly type: string;
  readonly defaultLabel?: string;
  readonly defaultDimensions?: Vec2;
  readonly ports?: readonly PortInput[];
  readonly validateProperties?: (
    properties: Readonly<Record<string, unknown>>
  ) => readonly string[] | void;
}

export interface EdgeValidationContext {
  readonly edge: Edge;
  readonly sourceNode: Node;
  readonly targetNode: Node;
  readonly sourcePort: Port;
  readonly targetPort: Port;
}

export interface CorePluginHooks {
  readonly beforeNodeCreate?: (input: NodeInput, engine: CoreEngine) => void;
  readonly afterNodeCreate?: (node: Node, engine: CoreEngine) => void;
}

export interface CoreValidationPolicies {
  readonly allowSelfLoops?: boolean;
  readonly allowCycles?: boolean;
}

export interface CreateCoreEngineOptions extends CoreValidationPolicies {
  readonly graph?: GraphInput;
  readonly nodeTypes?: readonly NodeTypeDefinition[];
  readonly plugins?: readonly CorePluginHooks[];
  readonly schemaValidator?: (
    input: NodeInput,
    definition: NodeTypeDefinition
  ) => readonly string[] | void;
  readonly propertySchemaValidator?: (
    input: NodeInput,
    definition: NodeTypeDefinition
  ) => ValidationResult | void;
  readonly executionSignatureValidator?: (
    context: EdgeValidationContext
  ) => ValidationResult | void;
  readonly idSeed?: string;
}

export interface UpdateNodeInput {
  readonly position?: Vec2;
  readonly dimensions?: Vec2;
  readonly label?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly ports?: readonly PortInput[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly groupId?: GroupId | null;
}

export interface PartialGraphExportOptions {
  readonly nodeIds?: readonly NodeId[];
  readonly edgeIds?: readonly EdgeId[];
  readonly groupIds?: readonly GroupId[];
  readonly includeConnectedEdges?: boolean;
}

export interface GraphDocumentEnvelope {
  readonly version: number;
  readonly graph: GraphSnapshot;
}

export type GraphDocument = GraphDocumentEnvelope | GraphInput;

export interface GraphMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (document: GraphDocumentEnvelope) => GraphDocumentEnvelope;
}

export interface GraphMigrationRegistry {
  readonly getLatestVersion: () => number;
  readonly registerMigration: (migration: GraphMigration) => void;
  readonly migrate: (document: GraphDocumentEnvelope) => GraphDocumentEnvelope;
}

export interface HistoryCommand {
  readonly label: string;
  readonly execute: () => void;
  readonly undo: () => void;
  readonly merge?: (next: HistoryCommand) => HistoryCommand | undefined;
}

export interface CoreEventMap {
  readonly nodeAdded: {
    readonly node: Node;
    readonly graph: GraphSnapshot;
  };
  readonly nodeRemoved: {
    readonly node: Node;
    readonly removedEdges: readonly Edge[];
    readonly graph: GraphSnapshot;
  };
  readonly edgeCreated: {
    readonly edge: Edge;
    readonly graph: GraphSnapshot;
  };
  readonly edgeDeleted: {
    readonly edge: Edge;
    readonly graph: GraphSnapshot;
  };
  readonly graphLoaded: {
    readonly graph: GraphSnapshot;
  };
  readonly selectionChanged: {
    readonly selection: SelectionSnapshot;
    readonly graph: GraphSnapshot;
  };
}

export type CoreEventName = keyof CoreEventMap;
export type CoreEventListener<K extends CoreEventName> = (payload: CoreEventMap[K]) => void;

export interface CoreEngineStateSnapshot {
  readonly selection: SelectionSnapshot;
  readonly history: {
    readonly undoDepth: number;
    readonly redoDepth: number;
    readonly transactionDepth: number;
  };
  readonly nodeIds: readonly NodeId[];
  readonly edgeIds: readonly EdgeId[];
  readonly groupIds: readonly GroupId[];
  readonly portLookup: Readonly<Record<string, NodeId>>;
  readonly adjacency: Readonly<
    Record<
      string,
      {
        readonly incoming: readonly EdgeId[];
        readonly outgoing: readonly EdgeId[];
      }
    >
  >;
}

export interface CoreEngine {
  readonly getSnapshot: () => GraphSnapshot;
  readonly getStateSnapshot: () => CoreEngineStateSnapshot;
  readonly registerNodeType: (definition: NodeTypeDefinition) => void;
  readonly unregisterNodeType: (type: string) => boolean;
  readonly getNodeType: (type: string) => NodeTypeDefinition | undefined;
  readonly on: <K extends CoreEventName>(
    eventName: K,
    listener: CoreEventListener<K>
  ) => () => void;
  readonly validateGraph: (graph?: GraphInput | GraphSnapshot) => ValidationResult;
  readonly loadGraph: (graph: GraphInput) => GraphSnapshot;
  readonly importGraph: (
    document: GraphDocument,
    migrationRegistry?: GraphMigrationRegistry
  ) => GraphSnapshot;
  readonly exportGraph: () => GraphDocumentEnvelope;
  readonly exportPartialGraph: (options?: PartialGraphExportOptions) => GraphDocumentEnvelope;
  readonly createNode: (input: NodeInput) => Node;
  readonly updateNode: (nodeId: NodeId, input: UpdateNodeInput) => Node;
  readonly deleteNode: (nodeId: NodeId) => boolean;
  readonly validateEdge: (input: EdgeInput) => ValidationResult;
  readonly createEdge: (input: EdgeInput) => Edge;
  readonly deleteEdge: (edgeId: EdgeId) => boolean;
  readonly selectNode: (nodeId: NodeId, mode?: SelectionChangeMode) => SelectionSnapshot;
  readonly selectEdge: (edgeId: EdgeId, mode?: SelectionChangeMode) => SelectionSnapshot;
  readonly selectGroup: (groupId: GroupId, mode?: SelectionChangeMode) => SelectionSnapshot;
  readonly clearSelection: () => SelectionSnapshot;
  readonly beginTransaction: (label?: string) => void;
  readonly endTransaction: () => boolean;
  readonly undo: () => boolean;
  readonly redo: () => boolean;
  readonly dispose: () => void;
  readonly isDisposed: () => boolean;
}

export class CoreGraphError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CoreGraphError";
  }
}
