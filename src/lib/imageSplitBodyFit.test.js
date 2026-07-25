import { describe, expect, it } from "vitest";
import {
  findMaxFittingPrefixLength,
  resolveLineFitHeight,
  snapSplitToWordBoundary,
  composeBodyAfterSideEdit,
} from "./imageSplitBodyFit.js";

describe("findMaxFittingPrefixLength", () => {
  it("returns full length when everything fits", () => {
    expect(findMaxFittingPrefixLength("hello", () => true)).toBe(5);
  });

  it("returns 0 when nothing fits", () => {
    expect(findMaxFittingPrefixLength("hello", () => false)).toBe(0);
  });

  it("finds the largest fitting prefix by length", () => {
    const fits = (prefix) => prefix.length <= 3;
    expect(findMaxFittingPrefixLength("abcdef", fits)).toBe(3);
    expect(findMaxFittingPrefixLength("ab", fits)).toBe(2);
  });

  it("handles empty string", () => {
    expect(findMaxFittingPrefixLength("", () => true)).toBe(0);
  });
});

describe("resolveLineFitHeight", () => {
  it("floors to whole lines plus padding", () => {
    // 100 inner px / 20 = 5 lines → 4 + 100
    expect(resolveLineFitHeight(104, 20, 4)).toBe(104);
    // 95 inner → 4 lines → 4 + 80 = 84
    expect(resolveLineFitHeight(99, 20, 4)).toBe(84);
  });

  it("keeps at least one line", () => {
    expect(resolveLineFitHeight(10, 20, 4)).toBe(24);
  });

  it("returns 0 for non-positive height", () => {
    expect(resolveLineFitHeight(0, 20, 4)).toBe(0);
  });
});

describe("composeBodyAfterSideEdit", () => {
  it("does not duplicate below text when DOM is stale after reflow", () => {
    // prev side "AB", below already has "CDN", DOM still shows "ABCDNX"
    expect(composeBodyAfterSideEdit("AB", "ABCDNX", "CDN")).toBe("ABCDNX");
  });

  it("appends typed chars when DOM still has full stale base", () => {
    expect(composeBodyAfterSideEdit("Hello", "HelloWorldX", "World")).toBe("HelloWorldX");
  });

  it("keeps normal side edit + below", () => {
    expect(composeBodyAfterSideEdit("Hello", "Hello!", " world")).toBe("Hello! world");
  });
});

describe("snapSplitToWordBoundary", () => {
  it("leaves split at word boundary unchanged", () => {
    expect(snapSplitToWordBoundary("hello world", 6)).toBe(6);
  });

  it("retreats mid-word to previous break", () => {
    // "hello wo|rld" → after space
    expect(snapSplitToWordBoundary("hello world", 8)).toBe(6);
  });

  it("handles split at start or end", () => {
    expect(snapSplitToWordBoundary("hello", 0)).toBe(0);
    expect(snapSplitToWordBoundary("hello", 5)).toBe(5);
  });

  it("keeps mid-token cut when no earlier break", () => {
    expect(snapSplitToWordBoundary("herramienta", 5)).toBe(5);
  });

  it("snaps after newline", () => {
    expect(snapSplitToWordBoundary("abc\ndef", 5)).toBe(4);
  });
});
