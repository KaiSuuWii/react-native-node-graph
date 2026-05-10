import {
  createRendererThemeController,
  resolveRendererAccessibilityOptions,
  resolveRendererTheme
} from "@kaiisuuwii/renderer-skia";
import { describe, expect, it } from "vitest";

describe("renderer-skia theme system", () => {
  it("resolves light and dark themes with scalable UI settings", () => {
    const lightTheme = resolveRendererTheme(undefined, "light", "comfortable");
    const darkTheme = resolveRendererTheme(undefined, "dark", "large");

    expect(lightTheme.mode).toBe("light");
    expect(darkTheme.mode).toBe("dark");
    expect(darkTheme.scale).toBe("large");
    expect(darkTheme.fontScale).toBeGreaterThan(lightTheme.fontScale);
    expect(darkTheme.node.headerHeight).toBeGreaterThan(lightTheme.node.headerHeight);
  });

  it("supports runtime theme switching through the shared controller", () => {
    const controller = createRendererThemeController({
      mode: "light",
      scale: "comfortable"
    });

    expect(controller.getTheme().mode).toBe("light");
    controller.toggleMode();
    expect(controller.getTheme().mode).toBe("dark");
    controller.setScale("large");
    expect(controller.getTheme().scale).toBe("large");
  });

  it("merges accessibility defaults for keyboard and screen reader support", () => {
    expect(
      resolveRendererAccessibilityOptions({
        focusTargetId: "node_example"
      })
    ).toEqual({
      enabled: true,
      keyboardNavigationEnabled: true,
      screenReaderEnabled: true,
      scalableUiEnabled: true,
      announceValidationErrors: true,
      focusTargetId: "node_example"
    });
  });
});
