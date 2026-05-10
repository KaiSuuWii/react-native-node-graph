import { pluginRegistry } from "@react-native-node-graph/plugins";
import { describe, expect, it } from "vitest";

describe("plugins public api", () => {
  it("exposes a minimal registry", () => {
    expect(pluginRegistry).toEqual([]);
  });
});
