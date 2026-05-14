import { createRendererImageCache } from "@kaiisuuwii/renderer-skia";
import { describe, expect, it } from "vitest";

describe("renderer-skia image cache", () => {
  it("evicts the least recently used entry when maxSize is exceeded", () => {
    const cache = createRendererImageCache({ maxSize: 2 });

    cache.set("a", { uri: "a", state: "loaded", retryCount: 0 });
    cache.set("b", { uri: "b", state: "loaded", retryCount: 0 });
    expect(cache.get("a")?.uri).toBe("a");

    cache.set("c", { uri: "c", state: "loaded", retryCount: 0 });

    expect(cache.get("a")?.uri).toBe("a");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")?.uri).toBe("c");
  });

  it("does not evict entries while size stays under the limit", () => {
    const cache = createRendererImageCache({ maxSize: 3 });

    cache.set("a", { uri: "a", state: "loaded", retryCount: 0 });
    cache.set("b", { uri: "b", state: "loaded", retryCount: 0 });

    expect(cache.size()).toBe(2);
    expect(cache.get("a")?.uri).toBe("a");
    expect(cache.get("b")?.uri).toBe("b");
  });
});
