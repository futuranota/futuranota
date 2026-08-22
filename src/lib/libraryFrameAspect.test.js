import { describe, expect, it } from "vitest";
import {
  LIBRARY_FRAME_ASPECTS,
  libraryFrameCssAspectRatio,
  libraryFramePixelSize,
  libraryFrameWidthOverHeight,
  moodboardCellCssAspectRatio,
  moodboardCellHeightOverWidth,
  normalizeLibraryFrameAspect,
} from "./libraryFrameAspect.js";
import { normalizeFolderLibraryItem } from "./folderLibraryNormalize.js";

describe("libraryFrameAspect", () => {
  it("normalizes known frames and rejects junk", () => {
    expect(normalizeLibraryFrameAspect("9:16")).toBe(LIBRARY_FRAME_ASPECTS.PORTRAIT_9_16);
    expect(normalizeLibraryFrameAspect("3:2")).toBe(LIBRARY_FRAME_ASPECTS.LANDSCAPE_3_2);
    expect(normalizeLibraryFrameAspect("")).toBeNull();
    expect(normalizeLibraryFrameAspect("4:5")).toBeNull();
  });

  it("exposes width/height ratios for bake sizing", () => {
    expect(libraryFrameWidthOverHeight("9:16")).toBeCloseTo(9 / 16);
    expect(libraryFrameWidthOverHeight("16:9")).toBeCloseTo(16 / 9);
    expect(libraryFrameWidthOverHeight("1:1")).toBe(1);
    expect(libraryFrameWidthOverHeight("3:2")).toBeCloseTo(3 / 2);
    expect(libraryFrameCssAspectRatio("9:16")).toBe("9:16");
  });

  it("sizes portrait and landscape frames from max edge", () => {
    const portrait = libraryFramePixelSize("9:16", 1600);
    expect(portrait).toEqual({ width: 900, height: 1600 });
    const landscape = libraryFramePixelSize("16:9", 1600);
    expect(landscape).toEqual({ width: 1600, height: 900 });
    const square = libraryFramePixelSize("1:1", 1080);
    expect(square).toEqual({ width: 1080, height: 1080 });
  });

  it("maps moodboard cells to publish frames", () => {
    expect(moodboardCellHeightOverWidth("thirds", "large")).toBeCloseTo(16 / 9);
    expect(moodboardCellHeightOverWidth("thirds", "medium")).toBeCloseTo(2 / 3);
    expect(moodboardCellHeightOverWidth("full", "large")).toBeCloseTo(9 / 16);
    expect(moodboardCellHeightOverWidth("halves", "large")).toBe(1);
    expect(moodboardCellHeightOverWidth("wide_narrow", "large", 0)).toBeCloseTo(2 / 3);
    expect(moodboardCellHeightOverWidth("wide_narrow", "large", 1)).toBeCloseTo(16 / 9);
    expect(moodboardCellCssAspectRatio("thirds", "large")).toBe("9 / 16");
    expect(moodboardCellCssAspectRatio("thirds", "medium")).toBe("3 / 2");
  });
});

describe("folder library frameAspect persistence", () => {
  it("round-trips frameAspect and sourceMediaUrl", () => {
    const item = normalizeFolderLibraryItem({
      id: "LIB1",
      tag: "hero",
      category: "image",
      mediaUrl: "https://example.com/framed.webp",
      sourceMediaUrl: "https://example.com/source.webp",
      frameAspect: "9:16",
      wallColor: "#fff",
    });
    expect(item?.frameAspect).toBe("9:16");
    expect(item?.sourceMediaUrl).toBe("https://example.com/source.webp");
    expect(item?.wallColor).toBe("#FFFFFF");
  });
});
