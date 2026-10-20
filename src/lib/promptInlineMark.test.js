import { describe, expect, it } from "vitest";
import { hasHighlightBackground, markFromInlineStyle } from "./promptInlineMark.js";

describe("hasHighlightBackground", () => {
  it("ignores paper, transparent, and clip-only backgrounds", () => {
    expect(hasHighlightBackground("background-color: transparent")).toBe(false);
    expect(hasHighlightBackground("background-color: rgb(255, 255, 255)")).toBe(false);
    expect(hasHighlightBackground("background-color: #fff")).toBe(false);
    expect(hasHighlightBackground("background: none")).toBe(false);
    expect(hasHighlightBackground("background-clip: text")).toBe(false);
    expect(hasHighlightBackground("font-family: Times; font-size: 12pt")).toBe(false);
  });

  it("keeps a real yellow highlight", () => {
    expect(hasHighlightBackground("background-color: #f4e7a3")).toBe(true);
    expect(hasHighlightBackground("background-color: rgb(244, 231, 163)")).toBe(true);
    expect(hasHighlightBackground("background-color: yellow")).toBe(true);
    expect(hasHighlightBackground("mso-highlight: yellow")).toBe(true);
  });
});

describe("markFromInlineStyle", () => {
  it("does not wrap a Google Docs paper span as mark", () => {
    expect(markFromInlineStyle(
      "font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:400",
    )).toBe("");
  });

  it("maps bold and italic without treating paper as highlight", () => {
    expect(markFromInlineStyle("font-weight: 700; background-color: #ffffff")).toBe("strong");
    expect(markFromInlineStyle("font-style: italic")).toBe("em");
  });
});
