import {
  createFallbackTextMeasurer,
  type TextMeasureOptions,
  type TextMeasureResult,
  type TextMeasurer
} from "@kaiisuuwii/shared";

const MAX_CACHE_ENTRIES = 500;

const toCacheKey = (options: TextMeasureOptions): string =>
  [
    options.text,
    options.fontSize,
    options.fontWeight,
    options.fontStyle,
    options.maxWidth,
    options.lineHeight,
    options.maxLines ?? 0
  ].join("|");

const cloneMeasureResult = (result: TextMeasureResult): TextMeasureResult => ({
  lines: [...result.lines],
  totalHeight: result.totalHeight,
  lineHeightPx: result.lineHeightPx,
  truncated: result.truncated
});

export const createSkiaTextMeasurer = (_ParagraphBuilder?: unknown): TextMeasurer => {
  const fallback = createFallbackTextMeasurer();
  const cache = new Map<string, TextMeasureResult>();

  return {
    measure: (options) => {
      const key = toCacheKey(options);
      const cached = cache.get(key);

      if (cached !== undefined) {
        cache.delete(key);
        cache.set(key, cached);
        return cloneMeasureResult(cached);
      }

      const result = fallback.measure(options);
      cache.set(key, cloneMeasureResult(result));

      if (cache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value as string | undefined;

        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      return result;
    }
  };
};
