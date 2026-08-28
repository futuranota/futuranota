import { describe, expect, it } from "vitest";
import { resolveFloatingMenuAnchor } from "./textareaSelectionRect.js";

describe("resolveFloatingMenuAnchor", () => {
  const caretNearBottom = { top: 520, bottom: 538, left: 120, right: 128 };
  const caretNearTop = { top: 40, bottom: 58, left: 120, right: 128 };

  it("opens below when there is room under the caret", () => {
    const anchor = resolveFloatingMenuAnchor(caretNearTop, {
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(anchor.placement).toBe("below");
    expect(anchor.top).toBe(caretNearTop.bottom + 6);
    expect(anchor.transform).toBeUndefined();
  });

  it("opens above when the caret is near the bottom of the viewport", () => {
    const anchor = resolveFloatingMenuAnchor(caretNearBottom, {
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(anchor.placement).toBe("above");
    expect(anchor.transform).toBe("translateY(-100%)");
    expect(anchor.top).toBe(caretNearBottom.top - 6);
  });

  it("clamps horizontal position inside the viewport", () => {
    const anchor = resolveFloatingMenuAnchor(
      { top: 200, bottom: 218, left: 760, right: 768 },
      { viewportWidth: 800, viewportHeight: 600, width: 320 },
    );
    expect(anchor.left).toBeLessThanOrEqual(800 - 12 - 320);
    expect(anchor.left).toBeGreaterThanOrEqual(12);
  });
});
