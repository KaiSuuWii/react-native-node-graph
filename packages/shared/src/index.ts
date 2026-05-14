export type GraphId = `graph_${string}`;
export type NodeId = `node_${string}`;
export type EdgeId = `edge_${string}`;

const DEFAULT_ID_SEED = "seed";
let idCounter = 0;

const nextId = (prefix: "graph" | "node" | "edge", seed = DEFAULT_ID_SEED): string => {
  idCounter += 1;
  return `${prefix}_${seed}_${idCounter.toString(36).padStart(4, "0")}`;
};

export const createGraphId = (seed?: string): GraphId => nextId("graph", seed) as GraphId;

export const createNodeId = (seed?: string): NodeId => nextId("node", seed) as NodeId;

export const createEdgeId = (seed?: string): EdgeId => nextId("edge", seed) as EdgeId;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly min: Vec2;
  readonly max: Vec2;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const addVec2 = (left: Vec2, right: Vec2): Vec2 =>
  vec2(left.x + right.x, left.y + right.y);

export const subtractVec2 = (left: Vec2, right: Vec2): Vec2 =>
  vec2(left.x - right.x, left.y - right.y);

export const scaleVec2 = (input: Vec2, factor: number): Vec2 =>
  vec2(input.x * factor, input.y * factor);

export const boundsFromPoints = (points: readonly Vec2[]): Bounds => {
  const first = points[0];

  if (first === undefined) {
    return {
      min: vec2(0, 0),
      max: vec2(0, 0)
    };
  }

  const rest = points.slice(1);

  return rest.reduce<Bounds>(
    (current, point) => ({
      min: vec2(Math.min(current.min.x, point.x), Math.min(current.min.y, point.y)),
      max: vec2(Math.max(current.max.x, point.x), Math.max(current.max.y, point.y))
    }),
    { min: first, max: first }
  );
};

export interface GraphMetadata {
  readonly name: string;
  readonly version: string;
  readonly tags: readonly string[];
  readonly createdAtIso: string;
  readonly savedAt?: string;
  readonly [key: string]: unknown;
}

export type GraphInteractionPhase = "start" | "move" | "end" | "cancel";

export interface GraphInteractionEventPayload {
  readonly pointerId: string;
  readonly phase: GraphInteractionPhase;
  readonly position: Vec2;
  readonly timestampMs: number;
  readonly targetId?: NodeId | EdgeId;
}

export interface TextContent {
  readonly kind: "text";
  readonly value: string;
  readonly fontSize?: number;
  readonly fontWeight?: "normal" | "bold" | "semibold";
  readonly fontStyle?: "normal" | "italic";
  readonly textAlign?: "left" | "center" | "right";
  readonly color?: string;
  readonly maxLines?: number;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly selectable?: boolean;
}

export interface ImageContent {
  readonly kind: "image";
  readonly uri: string;
  readonly fit?: "cover" | "contain" | "fill" | "none";
  readonly borderRadius?: number;
  readonly alt?: string;
  readonly placeholder?: string;
  readonly width?: number;
  readonly height?: number;
  readonly tintColor?: string;
  readonly opacity?: number;
}

export type ImageLoadState = "idle" | "loading" | "loaded" | "error";

export interface TextMeasureOptions {
  readonly text: string;
  readonly fontSize: number;
  readonly fontWeight: "normal" | "bold" | "semibold";
  readonly fontStyle: "normal" | "italic";
  readonly maxWidth: number;
  readonly lineHeight: number;
  readonly maxLines?: number;
}

export interface TextMeasureResult {
  readonly lines: readonly string[];
  readonly totalHeight: number;
  readonly lineHeightPx: number;
  readonly truncated: boolean;
}

export interface TextMeasurer {
  readonly measure: (options: TextMeasureOptions) => TextMeasureResult;
}

const DEFAULT_TEXT_LINE = "";

const splitParagraphWords = (paragraph: string): readonly string[] => {
  const normalized = paragraph.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(" ");
};

const splitLongWord = (
  word: string,
  maxCharsPerLine: number
): readonly string[] => {
  if (maxCharsPerLine <= 0 || word.length <= maxCharsPerLine) {
    return [word];
  }

  const segments: string[] = [];

  for (let index = 0; index < word.length; index += maxCharsPerLine) {
    segments.push(word.slice(index, index + maxCharsPerLine));
  }

  return segments;
};

export const createFallbackTextMeasurer = (): TextMeasurer => ({
  measure: (options) => {
    const charWidth = Math.max(1, options.fontSize * 0.6);
    const maxCharsPerLine = Math.max(1, Math.floor(options.maxWidth / charWidth));
    const lineHeightPx = options.fontSize * options.lineHeight;
    const limit = options.maxLines === undefined || options.maxLines === 0 ? Number.POSITIVE_INFINITY : options.maxLines;
    const lines: string[] = [];
    let truncated = false;

    const pushLine = (line: string): boolean => {
      if (lines.length >= limit) {
        truncated = true;
        return false;
      }

      lines.push(line);
      return true;
    };

    const paragraphs = options.text.length === 0 ? [DEFAULT_TEXT_LINE] : options.text.split(/\r?\n/);

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) {
        if (!pushLine(DEFAULT_TEXT_LINE)) {
          break;
        }

        continue;
      }

      const words = splitParagraphWords(paragraph);

      if (words.length === 0) {
        if (!pushLine(DEFAULT_TEXT_LINE)) {
          break;
        }

        continue;
      }

      let currentLine = "";

      for (const word of words) {
        const segments = splitLongWord(word, maxCharsPerLine);

        for (const segment of segments) {
          const nextLine = currentLine.length === 0 ? segment : `${currentLine} ${segment}`;

          if (nextLine.length <= maxCharsPerLine) {
            currentLine = nextLine;
            continue;
          }

          if (!pushLine(currentLine)) {
            currentLine = "";
            break;
          }

          currentLine = segment;
        }

        if (truncated) {
          break;
        }
      }

      if (truncated) {
        break;
      }

      if (!pushLine(currentLine.length > 0 ? currentLine : DEFAULT_TEXT_LINE)) {
        break;
      }
    }

    const resolvedLines = lines.length > 0 ? lines : [DEFAULT_TEXT_LINE];

    return {
      lines: resolvedLines,
      totalHeight: resolvedLines.length * lineHeightPx,
      lineHeightPx,
      truncated
    };
  }
});

export const isTextContent = (value: unknown): value is TextContent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TextContent>;

  return candidate.kind === "text" && typeof candidate.value === "string";
};

export const isImageContent = (value: unknown): value is ImageContent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ImageContent>;

  return candidate.kind === "image" && typeof candidate.uri === "string";
};

export const DEFAULT_NODE_SIZE = vec2(160, 64);
export const DEFAULT_EDGE_WIDTH = 2;
export const DEFAULT_VIEWPORT_PADDING = 24;
