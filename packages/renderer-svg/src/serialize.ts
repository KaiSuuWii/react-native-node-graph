import type { SvgElement, SvgRenderPlan, SvgText, SvgTspan } from "./types.js";

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeContent = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const attr = (name: string, value: string | number | undefined): string => {
  if (value === undefined) {
    return "";
  }

  return ` ${name}="${escapeXml(String(value))}"`;
};

const optionalAttr = (name: string, value: string | number | undefined): string =>
  value !== undefined ? attr(name, value) : "";

const serializeTspan = (tspan: SvgTspan): string =>
  `<tspan${optionalAttr("dx", tspan.dx)}${optionalAttr("dy", tspan.dy)}>${escapeContent(tspan.content)}</tspan>`;

const serializeText = (el: SvgText): string => {
  const children = el.children?.map(serializeTspan).join("") ?? "";
  const attrs = [
    attr("x", el.x),
    attr("y", el.y),
    optionalAttr("font-size", el.fontSize),
    optionalAttr("font-family", el.fontFamily),
    optionalAttr("font-weight", el.fontWeight),
    optionalAttr("font-style", el.fontStyle),
    optionalAttr("fill", el.fill),
    optionalAttr("text-anchor", el.textAnchor),
    optionalAttr("dominant-baseline", el.dominantBaseline)
  ].join("");

  if (children.length > 0) {
    return `<text${attrs}>${escapeContent(el.content)}${children}</text>`;
  }

  return `<text${attrs}>${escapeContent(el.content)}</text>`;
};

export const serializeSvgElement = (el: SvgElement): string => {
  switch (el.kind) {
    case "rect": {
      const attrs = [
        attr("x", el.x),
        attr("y", el.y),
        attr("width", el.width),
        attr("height", el.height),
        optionalAttr("rx", el.rx),
        optionalAttr("ry", el.ry),
        optionalAttr("fill", el.fill),
        optionalAttr("stroke", el.stroke),
        optionalAttr("stroke-width", el.strokeWidth),
        optionalAttr("stroke-dasharray", el.strokeDasharray),
        optionalAttr("opacity", el.opacity),
        optionalAttr("id", el.id)
      ].join("");

      return `<rect${attrs}/>`;
    }

    case "circle": {
      const attrs = [
        attr("cx", el.cx),
        attr("cy", el.cy),
        attr("r", el.r),
        optionalAttr("fill", el.fill),
        optionalAttr("stroke", el.stroke),
        optionalAttr("stroke-width", el.strokeWidth),
        optionalAttr("opacity", el.opacity)
      ].join("");

      return `<circle${attrs}/>`;
    }

    case "path": {
      const attrs = [
        attr("d", el.d),
        optionalAttr("fill", el.fill),
        optionalAttr("stroke", el.stroke),
        optionalAttr("stroke-width", el.strokeWidth),
        optionalAttr("stroke-linecap", el.strokeLinecap),
        optionalAttr("stroke-linejoin", el.strokeLinejoin),
        optionalAttr("marker-end", el.markerEnd),
        optionalAttr("opacity", el.opacity)
      ].join("");

      return `<path${attrs}/>`;
    }

    case "text":
      return serializeText(el);

    case "title":
      return `<title>${escapeContent(el.content)}</title>`;

    case "image": {
      const attrs = [
        attr("x", el.x),
        attr("y", el.y),
        attr("width", el.width),
        attr("height", el.height),
        attr("href", el.href),
        optionalAttr("preserveAspectRatio", el.preserveAspectRatio),
        optionalAttr("clip-path", el.clipPathId !== undefined ? `url(#${el.clipPathId})` : undefined),
        optionalAttr("opacity", el.opacity)
      ].join("");

      return `<image${attrs}/>`;
    }

    case "group": {
      const attrs = [
        optionalAttr("id", el.id),
        optionalAttr("transform", el.transform),
        optionalAttr("clip-path", el.clipPathId !== undefined ? `url(#${el.clipPathId})` : undefined),
        optionalAttr("opacity", el.opacity),
        optionalAttr("role", el.role),
        optionalAttr("aria-label", el.ariaLabel)
      ].join("");

      const inner = el.children.map(serializeSvgElement).join("");

      return `<g${attrs}>${inner}</g>`;
    }

    case "clipPath": {
      const inner = el.children.map(serializeSvgElement).join("");

      return `<clipPath id="${escapeXml(el.id)}">${inner}</clipPath>`;
    }
  }
};

const serializeArrowMarker = (edgeColor: string): string =>
  `<marker id="svg-arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(edgeColor)}"/></marker>`;

export const serializeSvgRenderPlan = (plan: SvgRenderPlan, edgeColor = "#466b67"): string => {
  const defsContent = [
    serializeArrowMarker(edgeColor),
    ...plan.defs
      .filter((d) => d.kind === "clipPath")
      .map(serializeSvgElement)
  ].join("");

  const layersContent = plan.layers
    .map((layer) => {
      if (layer.elements.length === 0) {
        return "";
      }

      const inner = layer.elements.map(serializeSvgElement).join("");

      return `<g data-layer="${layer.kind}">${inner}</g>`;
    })
    .join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` viewBox="${escapeXml(plan.viewBox)}"`,
    ` width="${plan.width}"`,
    ` height="${plan.height}"`,
    ` role="img"`,
    ` aria-label="graph"`,
    `>`,
    `<defs>${defsContent}</defs>`,
    layersContent,
    `</svg>`
  ].join("");
};
