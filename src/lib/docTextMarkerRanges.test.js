import { describe, expect, it } from "vitest";
import {
  applyTextEditToMarkerRanges,
  markerRangesToSegments,
  mergeBlockMarkerRanges,
  normalizeMarkerRanges,
  setMarkerRange,
  splitMarkerRangesAt,
  toggleMarkerRange,
} from "./docTextMarkerRanges.js";

describe("normalizeMarkerRanges", () => {
  it("clamps malformed ranges and lets the later color win", () => {
    expect(normalizeMarkerRanges("abcdef", [
      { start: -2, end: 5, colorId: "mint" },
      { start: 2, end: 9, colorId: "rose" },
    ])).toEqual([
      { start: 0, end: 2, colorId: "mint" },
      { start: 2, end: 6, colorId: "rose" },
    ]);
  });

  it("merges adjacent ranges of the same color", () => {
    expect(normalizeMarkerRanges("abcdef", [
      { start: 0, end: 3, colorId: "blue" },
      { start: 3, end: 6, colorId: "blue" },
    ])).toEqual([{ start: 0, end: 6, colorId: "blue" }]);
  });
});

describe("setMarkerRange", () => {
  it("replaces only the selected part and preserves both outside pieces", () => {
    expect(setMarkerRange(
      "abcdefgh",
      [{ start: 0, end: 8, colorId: "mint" }],
      2,
      6,
      "rose",
    )).toEqual([
      { start: 0, end: 2, colorId: "mint" },
      { start: 2, end: 6, colorId: "rose" },
      { start: 6, end: 8, colorId: "mint" },
    ]);
  });

  it("removes marker only from the selection", () => {
    expect(setMarkerRange(
      "abcdefgh",
      [{ start: 0, end: 8, colorId: "mint" }],
      2,
      6,
      null,
    )).toEqual([
      { start: 0, end: 2, colorId: "mint" },
      { start: 6, end: 8, colorId: "mint" },
    ]);
  });
});

describe("toggleMarkerRange", () => {
  it("removes a fully covered selection using the same color", () => {
    expect(toggleMarkerRange(
      "abcdefgh",
      [{ start: 0, end: 8, colorId: "mint" }],
      2,
      6,
      "mint",
    )).toEqual([
      { start: 0, end: 2, colorId: "mint" },
      { start: 6, end: 8, colorId: "mint" },
    ]);
  });

  it("replaces a mixed selection with one color", () => {
    expect(toggleMarkerRange(
      "abcdefgh",
      [
        { start: 0, end: 4, colorId: "mint" },
        { start: 4, end: 8, colorId: "rose" },
      ],
      2,
      6,
      "blue",
    )).toEqual([
      { start: 0, end: 2, colorId: "mint" },
      { start: 2, end: 6, colorId: "blue" },
      { start: 6, end: 8, colorId: "rose" },
    ]);
  });
});

describe("editing marked text", () => {
  it("moves a marker when text is inserted before it", () => {
    expect(applyTextEditToMarkerRanges(
      "Hello world",
      "Say Hello world",
      [{ start: 6, end: 11, colorId: "mint" }],
    )).toEqual([{ start: 10, end: 15, colorId: "mint" }]);
  });

  it("keeps inserted characters inside a marked phrase unmarked", () => {
    expect(applyTextEditToMarkerRanges(
      "Hello",
      "Hel--lo",
      [{ start: 0, end: 5, colorId: "mint" }],
    )).toEqual([
      { start: 0, end: 3, colorId: "mint" },
      { start: 5, end: 7, colorId: "mint" },
    ]);
  });

  it("trims a marker when marked characters are deleted", () => {
    expect(applyTextEditToMarkerRanges(
      "Hello world",
      "Helworld",
      [{ start: 0, end: 11, colorId: "rose" }],
    )).toEqual([{ start: 0, end: 8, colorId: "rose" }]);
  });
});

describe("split and merge", () => {
  it("splits a marker across two text blocks", () => {
    expect(splitMarkerRangesAt(
      [{ start: 2, end: 8, colorId: "blue" }],
      5,
    )).toEqual({
      headRanges: [{ start: 2, end: 5, colorId: "blue" }],
      tailRanges: [{ start: 0, end: 3, colorId: "blue" }],
    });
  });

  it("merges ranges while leaving the block separator unmarked", () => {
    expect(mergeBlockMarkerRanges(
      {
        text: "Hello",
        markerRanges: [{ start: 0, end: 5, colorId: "mint" }],
      },
      {
        text: "world",
        markerRanges: [{ start: 0, end: 5, colorId: "mint" }],
      },
    )).toEqual([
      { start: 0, end: 5, colorId: "mint" },
      { start: 6, end: 11, colorId: "mint" },
    ]);
  });
});

describe("markerRangesToSegments", () => {
  it("returns renderable plain and marker segments", () => {
    expect(markerRangesToSegments(
      "Hello world",
      [{ start: 6, end: 11, colorId: "rose" }],
    )).toEqual([
      { type: "plain", text: "Hello " },
      { type: "marker", text: "world", colorId: "rose" },
    ]);
  });
});
