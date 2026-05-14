import type { ImageLoadState } from "@kaiisuuwii/shared";

import type { CachedImage, RendererImageCache } from "./image-cache.js";

export interface ImageLoader {
  readonly load: (uri: string, onStateChange: (state: CachedImage) => void) => () => void;
  readonly preload: (uris: readonly string[]) => void;
  readonly dispose: () => void;
}

export interface DecodedImageResult {
  readonly skiaImage?: unknown;
  readonly width?: number;
  readonly height?: number;
}

export interface ImageLoaderOptions {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly concurrency?: number;
  readonly fetchFn?: typeof globalThis.fetch;
  readonly decodeDataUri?: (uri: string) => DecodedImageResult;
  readonly decodeBytes?: (bytes: Uint8Array, uri: string) => Promise<DecodedImageResult> | DecodedImageResult;
  readonly resolveAssetUri?: (uri: string) => Promise<string> | string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_CONCURRENCY = 4;

const isDataUri = (uri: string): boolean => uri.startsWith("data:image/");
const isAssetUri = (uri: string): boolean => uri.startsWith("asset://");
const isHttpUri = (uri: string): boolean => uri.startsWith("http://") || uri.startsWith("https://");

const createState = (
  uri: string,
  state: ImageLoadState,
  retryCount: number,
  details: Partial<CachedImage> = {}
): CachedImage => ({
  uri,
  state,
  retryCount,
  ...details
});

const createAbortError = (uri: string, timeoutMs: number): Error =>
  new Error(`Timed out loading image '${uri}' after ${timeoutMs}ms.`);

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  uri: string
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(createAbortError(uri, timeoutMs));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
};

const fallbackDecodeDataUri = (uri: string): DecodedImageResult => ({
  skiaImage: uri,
  width: 1,
  height: 1
});

const fallbackDecodeBytes = (bytes: Uint8Array): DecodedImageResult => ({
  skiaImage: bytes,
  width: 1,
  height: 1
});

export const createImageLoader = (
  cache: RendererImageCache,
  options: ImageLoaderOptions = {}
): ImageLoader => {
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const fetchFn = options.fetchFn ?? globalThis.fetch?.bind(globalThis);
  const decodeDataUri = options.decodeDataUri ?? fallbackDecodeDataUri;
  const decodeBytes = options.decodeBytes ?? fallbackDecodeBytes;
  const listeners = new Map<string, Set<(state: CachedImage) => void>>();
  const queued = new Set<string>();
  const queue: string[] = [];
  const disposedHandles = new Set<ReturnType<typeof setTimeout>>();
  const activeLoads = new Set<string>();
  let disposed = false;
  let activeCount = 0;

  const emit = (state: CachedImage): void => {
    cache.set(state.uri, state);
    listeners.get(state.uri)?.forEach((listener) => {
      listener(state);
    });
  };

  const cleanup = (uri: string): void => {
    activeLoads.delete(uri);
    activeCount = Math.max(0, activeCount - 1);
    runNext();
  };

  const decodeUri = async (uri: string): Promise<DecodedImageResult> => {
    if (isDataUri(uri)) {
      return decodeDataUri(uri);
    }

    if (isAssetUri(uri)) {
      const resolved = await Promise.resolve(options.resolveAssetUri?.(uri) ?? uri.slice("asset://".length));

      if (isDataUri(resolved)) {
        return decodeDataUri(resolved);
      }

      if (!isHttpUri(resolved)) {
        return {
          skiaImage: resolved,
          width: 1,
          height: 1
        };
      }

      if (fetchFn === undefined) {
        throw new Error(`No fetch implementation available for asset URI '${uri}'.`);
      }

      const response = await fetchFn(resolved);

      if (!response.ok) {
        throw new Error(`Image request failed for '${resolved}' with status ${response.status}.`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      return decodeBytes(bytes, uri);
    }

    if (isHttpUri(uri)) {
      if (fetchFn === undefined) {
        throw new Error(`No fetch implementation available for URI '${uri}'.`);
      }

      const response = await fetchFn(uri);

      if (!response.ok) {
        throw new Error(`Image request failed for '${uri}' with status ${response.status}.`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      return decodeBytes(bytes, uri);
    }

    return {
      skiaImage: uri,
      width: 1,
      height: 1
    };
  };

  const scheduleRetry = (uri: string, retryCount: number): void => {
    if (disposed) {
      return;
    }

    const handle = setTimeout(() => {
      disposedHandles.delete(handle);
      enqueue(uri);
    }, retryDelayMs * 2 ** retryCount);

    disposedHandles.add(handle);
  };

  const attemptLoad = async (uri: string): Promise<void> => {
    const cached = cache.get(uri);
    const retryCount = cached?.retryCount ?? 0;

    emit(createState(uri, "loading", retryCount, cached ?? {}));

    try {
      const decoded = await withTimeout(Promise.resolve(decodeUri(uri)), timeoutMs, uri);

      if (disposed) {
        return;
      }

      emit(
        createState(uri, "loaded", retryCount, {
          ...decoded,
          loadedAt: Date.now()
        })
      );
    } catch (error) {
      if (disposed) {
        return;
      }

      const nextRetryCount = retryCount + 1;

      if (nextRetryCount <= maxRetries) {
        emit(
          createState(uri, "loading", nextRetryCount, {
            error: error instanceof Error ? error.message : String(error)
          })
        );
        scheduleRetry(uri, retryCount);
        return;
      }

      emit(
        createState(uri, "error", retryCount, {
          error: error instanceof Error ? error.message : String(error)
        })
      );
    } finally {
      cleanup(uri);
    }
  };

  function runNext(): void {
    if (disposed) {
      return;
    }

    while (activeCount < concurrency && queue.length > 0) {
      const uri = queue.shift();

      if (uri === undefined) {
        return;
      }

      queued.delete(uri);

      if (activeLoads.has(uri)) {
        continue;
      }

      activeLoads.add(uri);
      activeCount += 1;
      void attemptLoad(uri);
    }
  }

  function enqueue(uri: string): void {
    if (disposed || activeLoads.has(uri) || queued.has(uri)) {
      return;
    }

    queued.add(uri);
    queue.push(uri);
    runNext();
  }

  const startLoad = (uri: string): void => {
    const cached = cache.get(uri);

    if (cached?.state === "loaded" || cached?.state === "loading") {
      return;
    }

    enqueue(uri);
  };

  return {
    load: (uri, onStateChange) => {
      if (disposed) {
        return () => undefined;
      }

      const existing = cache.get(uri);

      if (existing?.state === "loaded") {
        onStateChange(existing);
      }

      let uriListeners = listeners.get(uri);

      if (uriListeners === undefined) {
        uriListeners = new Set();
        listeners.set(uri, uriListeners);
      }

      uriListeners.add(onStateChange);

      if (existing?.state === "loading") {
        onStateChange(existing);
      } else {
        startLoad(uri);
      }

      return () => {
        const current = listeners.get(uri);

        if (current === undefined) {
          return;
        }

        current.delete(onStateChange);

        if (current.size === 0) {
          listeners.delete(uri);
        }
      };
    },
    preload: (uris) => {
      uris.forEach((uri) => {
        startLoad(uri);
      });
    },
    dispose: () => {
      disposed = true;
      listeners.clear();
      queued.clear();
      queue.length = 0;
      activeLoads.clear();
      activeCount = 0;
      disposedHandles.forEach((handle) => clearTimeout(handle));
      disposedHandles.clear();
    }
  };
};
