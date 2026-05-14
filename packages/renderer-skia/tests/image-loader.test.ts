import { createImageLoader, createRendererImageCache } from "@kaiisuuwii/renderer-skia";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("renderer-skia image loader", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits loading immediately and loaded on success", async () => {
    const cache = createRendererImageCache();
    const loader = createImageLoader(cache, {
      fetchFn: vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
      } as Response)),
      decodeBytes: () => ({ skiaImage: "decoded", width: 32, height: 24 })
    });
    const states: string[] = [];

    loader.load("https://example.com/image.png", (state) => {
      states.push(state.state);
    });

    for (let index = 0; index < 5 && states.length < 2; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(states).toEqual(["loading", "loaded"]);
    expect(cache.get("https://example.com/image.png")?.width).toBe(32);
  });

  it("does not start a second fetch for an image that is already loading", async () => {
    let release: (() => void) | undefined;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve({
              ok: true,
              status: 200,
              arrayBuffer: async () => new Uint8Array([1]).buffer
            } as Response);
        })
    );
    const cache = createRendererImageCache();
    const loader = createImageLoader(cache, {
      fetchFn,
      decodeBytes: () => ({ skiaImage: "decoded", width: 1, height: 1 })
    });

    loader.load("https://example.com/loading.png", () => undefined);
    loader.load("https://example.com/loading.png", () => undefined);

    expect(fetchFn).toHaveBeenCalledTimes(1);

    release?.();
    await Promise.resolve();
    await Promise.resolve();
  });

  it("retries on failure and eventually emits error", async () => {
    vi.useFakeTimers();
    const cache = createRendererImageCache();
    const loader = createImageLoader(cache, {
      maxRetries: 2,
      retryDelayMs: 10,
      fetchFn: vi.fn(async () => {
        throw new Error("boom");
      })
    });
    const terminalStates: string[] = [];

    loader.load("https://example.com/error.png", (state) => {
      if (state.state !== "loading") {
        terminalStates.push(state.state);
      }
    });

    await vi.runAllTimersAsync();

    expect(cache.get("https://example.com/error.png")?.state).toBe("error");
    expect(terminalStates).toEqual(["error"]);
  });
});
