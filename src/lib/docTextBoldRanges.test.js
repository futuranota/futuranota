import { describe, expect, it } from "vitest";
import {
  normalizeBoldRanges,
  rangesToSegments,
  shiftBoldRanges,
  toggleBoldRange,
} from "./docTextBoldRanges.js";
import { readTextareaSelection } from "./textareaSelectionRect.js";

describe("toggleBoldRange", () => {
  it("bolds selection from index 0 including trailing space", () => {
    const text = "Hello there";
    const ranges = toggleBoldRange(text, [], 0, 6);
    expect(ranges).toEqual([{ start: 0, end: 6 }]);
    expect(text.slice(ranges[0].start, ranges[0].end)).toBe("Hello ");
  });

  it("bolds a whitespace-only selection", () => {
    const text = "Hello there";
    const ranges = toggleBoldRange(text, [], 5, 6);
    expect(ranges).toEqual([{ start: 5, end: 6 }]);
    expect(text.slice(ranges[0].start, ranges[0].end)).toBe(" ");
  });

  it("bolds full phrase including internal spaces", () => {
    const text = "Hello there friend";
    const ranges = toggleBoldRange(text, [], 0, 17);
    expect(ranges).toEqual([{ start: 0, end: 17 }]);
  });

  it("toggles off an already-bold range with spaces", () => {
    const text = "Hello there";
    const initial = toggleBoldRange(text, [], 0, 11);
    const cleared = toggleBoldRange(text, initial, 0, 11);
    expect(cleared).toEqual([]);
  });
});

describe("rangesToSegments", () => {
  it("keeps spaces inside bold segments", () => {
    const segments = rangesToSegments("Hello there", [{ start: 0, end: 6 }]);
    expect(segments).toEqual([
      { type: "bold", text: "Hello " },
      { type: "plain", text: "there" },
    ]);
  });

  it("renders a bold segment that is only a space", () => {
    const segments = rangesToSegments("A B", [{ start: 1, end: 2 }]);
    expect(segments).toEqual([
      { type: "plain", text: "A" },
      { type: "bold", text: " " },
      { type: "plain", text: "B" },
    ]);
  });
});

describe("shiftBoldRanges", () => {
  it("preserves bold on a space when text grows before it", () => {
    const ranges = [{ start: 5, end: 6 }];
    const next = shiftBoldRanges(ranges, 0, 0, 2, "Hi Hello there".length);
    expect(normalizeBoldRanges("Hi Hello there", next)).toEqual([{ start: 7, end: 8 }]);
  });
});

describe("readTextareaSelection", () => {
  it("accepts whitespace-only selections", () => {
    const el = {
      tagName: "TEXTAREA",
      value: "Hello there",
      selectionStart: 5,
      selectionEnd: 6,
    };
    expect(readTextareaSelection(el)).toEqual({ start: 5, end: 6 });
  });

  it("accepts selections starting at index 0", () => {
    const el = {
      tagName: "TEXTAREA",
      value: "Hello there",
      selectionStart: 0,
      selectionEnd: 5,
    };
    expect(readTextareaSelection(el)).toEqual({ start: 0, end: 5 });
  });
});
