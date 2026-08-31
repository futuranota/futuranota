import { describe, expect, it } from "vitest";
import { listGuideArrowRanges } from "./docGuideArrow.js";

describe("listGuideArrowRanges", () => {
  it("highlights -> at the start of a line", () => {
    const text = "-> Gina dijo hola";
    expect(listGuideArrowRanges(text)).toEqual([{ start: 0, end: 2 }]);
  });

  it("highlights each line that starts with ->", () => {
    const text = "-> uno\nnormal\n  -> dos";
    expect(listGuideArrowRanges(text)).toEqual([
      { start: 0, end: 2 },
      { start: 16, end: 18 },
    ]);
  });

  it("ignores -> when it is not at line start", () => {
    const text = "dice -> no";
    expect(listGuideArrowRanges(text)).toEqual([]);
  });
});
