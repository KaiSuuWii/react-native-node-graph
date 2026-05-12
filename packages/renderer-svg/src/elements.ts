import type {
  SvgCircle,
  SvgClipPath,
  SvgCubicBezierCurve,
  SvgElement,
  SvgGroup,
  SvgImage,
  SvgPath,
  SvgRect,
  SvgText,
  SvgTspan
} from "./types.js";

export const svgRect = (props: Omit<SvgRect, "kind">): SvgRect => ({
  kind: "rect",
  ...props
});

export const svgCircle = (props: Omit<SvgCircle, "kind">): SvgCircle => ({
  kind: "circle",
  ...props
});

export const svgPath = (props: Omit<SvgPath, "kind">): SvgPath => ({
  kind: "path",
  ...props
});

export const svgText = (
  x: number,
  y: number,
  content: string,
  props?: Partial<Omit<SvgText, "kind" | "x" | "y" | "content">>
): SvgText => ({
  kind: "text",
  x,
  y,
  content,
  ...props
});

export const svgTspan = (content: string, dy?: number): SvgTspan => ({
  kind: "tspan",
  content,
  ...(dy !== undefined ? { dy, dx: 0 } : {})
});

export const svgMultilineText = (
  x: number,
  y: number,
  lines: readonly string[],
  lineHeight: number,
  props?: Partial<Omit<SvgText, "kind" | "x" | "y" | "content" | "children">>
): SvgGroup => {
  const [first, ...rest] = lines;

  return {
    kind: "group",
    children: [
      {
        kind: "text",
        x,
        y,
        content: first ?? "",
        ...props,
        children: rest.map((line) => svgTspan(line, lineHeight))
      }
    ]
  };
};

export const svgImage = (props: Omit<SvgImage, "kind">): SvgImage => ({
  kind: "image",
  ...props
});

export const svgGroup = (
  children: readonly SvgElement[],
  props?: Partial<Omit<SvgGroup, "kind" | "children">>
): SvgGroup => ({
  kind: "group",
  children,
  ...props
});

export const svgClipRect = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): SvgClipPath => ({
  kind: "clipPath",
  id,
  children: [{ kind: "rect", x, y, width, height }]
});

export const bezierPathD = (curve: SvgCubicBezierCurve): string =>
  `M ${curve.start.x} ${curve.start.y} C ${curve.control1.x} ${curve.control1.y} ${curve.control2.x} ${curve.control2.y} ${curve.end.x} ${curve.end.y}`;
