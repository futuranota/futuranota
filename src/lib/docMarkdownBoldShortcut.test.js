import { describe, expect, it } from "vitest";
import {
  applyBoldMarkerIfPending,
  endBoldStickyWithSpace,
  extendBoldSticky,
  isBoldStickyTriggerKey,
  matchBoldMarkerAtCaret,
  startBoldStickyFromMarker,
} from "./docMarkdownBoldShortcut.js";

describe("isBoldStickyTriggerKey", () => {
  it("accepts letters and digits", () => {
    expect(isBoldStickyTriggerKey("a")).toBe(true);
    expect(isBoldStickyTriggerKey("1")).toBe(true);
  });

  it("rejects dash and space", () => {
    expect(isBoldStickyTriggerKey("-")).toBe(false);
    expect(isBoldStickyTriggerKey(" ")).toBe(false);
  });
});

describe("matchBoldMarkerAtCaret", () => {
  it("matches exactly -- at line start", () => {
    expect(matchBoldMarkerAtCaret("--", 2)).toBe(true);
  });

  it("does not match --- (third dash already typed)", () => {
    expect(matchBoldMarkerAtCaret("---", 3)).toBe(false);
  });
});

describe("startBoldStickyFromMarker", () => {
  it("strips -- and bolds the first typed char", () => {
    const result = startBoldStickyFromMarker("--", {}, 2, "H");
    expect(result.text).toBe("H");
    expect(result.boldRanges).toEqual([{ start: 0, end: 1 }]);
    expect(result.stickyBoldStart).toBe(0);
    expect(result.focusCaret).toBe(1);
  });

  it("works with text after caret", () => {
    const result = startBoldStickyFromMarker("--world", {}, 2, "H");
    expect(result.text).toBe("Hworld");
    expect(result.boldRanges).toEqual([{ start: 0, end: 1 }]);
  });

  it("does not start on dash (keeps ------- free)", () => {
    expect(startBoldStickyFromMarker("--", {}, 2, "-")).toBeNull();
  });

  it("does not start on space", () => {
    expect(startBoldStickyFromMarker("--", {}, 2, " ")).toBeNull();
  });
});

describe("extendBoldSticky / endBoldStickyWithSpace", () => {
  it("extends bold for more characters", () => {
    const start = startBoldStickyFromMarker("--", {}, 2, "H");
    const next = extendBoldSticky(start.text, start, start.focusCaret, "i", start.stickyBoldStart);
    expect(next.text).toBe("Hi");
    expect(next.boldRanges).toEqual([{ start: 0, end: 2 }]);
    expect(next.stickyBoldStart).toBe(0);
  });

  it("ends sticky on space without bolding the space", () => {
    const start = startBoldStickyFromMarker("--", {}, 2, "H");
    const ended = endBoldStickyWithSpace(start.text, start, start.focusCaret, start.stickyBoldStart);
    expect(ended.text).toBe("H ");
    expect(ended.boldRanges).toEqual([{ start: 0, end: 1 }]);
    expect(ended.stickyBoldStart).toBeNull();
    expect(ended.focusCaret).toBe(2);
  });
});

describe("applyBoldMarkerIfPending", () => {
  it("converts --hello into bold hello", () => {
    const result = applyBoldMarkerIfPending("--hello");
    expect(result.text).toBe("hello");
    expect(result.boldRanges).toEqual([{ start: 0, end: 5 }]);
  });

  it("bolds only until first space", () => {
    const result = applyBoldMarkerIfPending("--hello world");
    expect(result.text).toBe("hello world");
    expect(result.boldRanges).toEqual([{ start: 0, end: 5 }]);
  });

  it("leaves ------- alone", () => {
    expect(applyBoldMarkerIfPending("-------")).toBeNull();
  });

  it("leaves bare -- alone", () => {
    expect(applyBoldMarkerIfPending("--")).toBeNull();
  });

  it("leaves -- followed by space alone", () => {
    expect(applyBoldMarkerIfPending("-- ")).toBeNull();
  });
});
