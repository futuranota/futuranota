import { describe, expect, it } from "vitest";
import { getAssetGridLayout } from "./libraryAssetGridLayout.js";

describe("getAssetGridLayout", () => {
  it("returns four empty placeholders when count is zero", () => {
    expect(getAssetGridLayout(0)).toEqual({
      cols: 2,
      slotMinHeight: 88,
      scroll: false,
      emptySlots: 4,
      showPlaceholders: true,
    });
  });

  it("uses 2x2 large slots for up to four items", () => {
    expect(getAssetGridLayout(3).cols).toBe(2);
    expect(getAssetGridLayout(3).emptySlots).toBe(1);
    expect(getAssetGridLayout(4).emptySlots).toBe(0);
  });

  it("switches to three columns for five to nine items", () => {
    expect(getAssetGridLayout(5).cols).toBe(3);
    expect(getAssetGridLayout(5).slotMinHeight).toBe(64);
    expect(getAssetGridLayout(8).slotMinHeight).toBe(56);
  });

  it("uses four columns with scroll for ten or more items", () => {
    const layout = getAssetGridLayout(12);
    expect(layout.cols).toBe(4);
    expect(layout.scroll).toBe(true);
    expect(layout.slotMinHeight).toBe(48);
  });
});
