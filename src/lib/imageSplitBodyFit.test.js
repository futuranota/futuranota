import { describe, expect, it } from "vitest";
import { findMaxFittingPrefixLength } from "./imageSplitBodyFit.js";

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
