import type { ImageLoadState } from "@kaiisuuwii/shared";

export interface CachedImage {
  readonly uri: string;
  readonly state: ImageLoadState;
  readonly skiaImage?: unknown;
  readonly width?: number;
  readonly height?: number;
  readonly loadedAt?: number;
  readonly error?: string;
  readonly retryCount: number;
}

export interface RendererImageCache {
  readonly get: (uri: string) => CachedImage | undefined;
  readonly set: (uri: string, image: CachedImage) => void;
  readonly delete: (uri: string) => void;
  readonly clear: () => void;
  readonly size: () => number;
}

export interface ImageCacheOptions {
  readonly maxSize?: number;
  readonly maxMemoryMb?: number;
}

interface CacheEntry {
  readonly image: CachedImage;
  readonly memoryBytes: number;
}

const DEFAULT_MAX_SIZE = 100;
const BYTES_PER_PIXEL = 4;

const estimateImageBytes = (image: CachedImage): number =>
  image.width !== undefined && image.height !== undefined
    ? image.width * image.height * BYTES_PER_PIXEL
    : 0;

export const createRendererImageCache = (
  options: ImageCacheOptions = {}
): RendererImageCache => {
  const maxSize = Math.max(1, options.maxSize ?? DEFAULT_MAX_SIZE);
  const maxMemoryBytes =
    options.maxMemoryMb !== undefined && options.maxMemoryMb > 0
      ? options.maxMemoryMb * 1024 * 1024
      : undefined;
  const entries = new Map<string, CacheEntry>();

  const touch = (uri: string, entry: CacheEntry): void => {
    entries.delete(uri);
    entries.set(uri, entry);
  };

  const totalBytes = (): number =>
    Array.from(entries.values()).reduce((sum, entry) => sum + entry.memoryBytes, 0);

  const evictLeastRecentlyUsed = (): void => {
    const first = entries.keys().next().value as string | undefined;

    if (first !== undefined) {
      entries.delete(first);
    }
  };

  const evictLargestUntilWithinLimit = (): void => {
    if (maxMemoryBytes === undefined) {
      return;
    }

    while (entries.size > 0 && totalBytes() > maxMemoryBytes) {
      let largestUri: string | undefined;
      let largestBytes = -1;

      entries.forEach((entry, uri) => {
        if (entry.memoryBytes > largestBytes) {
          largestBytes = entry.memoryBytes;
          largestUri = uri;
        }
      });

      if (largestUri === undefined) {
        break;
      }

      entries.delete(largestUri);
    }
  };

  return {
    get: (uri) => {
      const entry = entries.get(uri);

      if (entry === undefined) {
        return undefined;
      }

      touch(uri, entry);
      return entry.image;
    },
    set: (uri, image) => {
      const entry: CacheEntry = {
        image,
        memoryBytes: estimateImageBytes(image)
      };

      if (entries.has(uri)) {
        entries.delete(uri);
      }

      entries.set(uri, entry);

      while (entries.size > maxSize) {
        evictLeastRecentlyUsed();
      }

      evictLargestUntilWithinLimit();
    },
    delete: (uri) => {
      entries.delete(uri);
    },
    clear: () => {
      entries.clear();
    },
    size: () => entries.size
  };
};
