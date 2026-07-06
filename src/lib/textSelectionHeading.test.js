import { describe, expect, it } from "vitest";
import {
  applyHeadingToTextBlock,
  demoteHeadingBlockToText,
  getLineRange,
  getLinesInRange,
  splitTextBlockForHeadings,
} from "./textSelectionHeading.js";

describe("getLineRange", () => {
  it("returns full line bounds for a mid-line selection", () => {
    const text = "Hello there\nSecond line";
    expect(getLineRange(text, 6, 11)).toEqual({ start: 0, end: 11 });
  });

  it("includes spaces in line bounds from index 0", () => {
    const text = "Hello there";
    expect(getLineRange(text, 0, 6)).toEqual({ start: 0, end: 11 });
  });
});

describe("splitTextBlockForHeadings", () => {
  it("splits a single line into before, heading, after", () => {
    const block = { type: "text", text: "Intro\nHeading line\nOutro", boldRanges: [] };
    const pieces = splitTextBlockForHeadings(block, { start: 6, end: 18 }, "h2");
    expect(pieces.map((p) => p.type)).toEqual(["text", "h2", "text"]);
    expect(pieces[0].text).toBe("Intro\n");
    expect(pieces[1].title).toBe("Heading line");
    expect(pieces[2].text).toBe("\nOutro");
  });

  it("preserves bold ranges on before/after slices", () => {
    const block = {
      type: "text",
      text: "Hello there\nTitle\nTail",
      boldRanges: [{ start: 0, end: 5 }, { start: 18, end: 22 }],
    };
    const pieces = splitTextBlockForHeadings(block, { start: 12, end: 17 }, "h1");
    expect(normalizePiece(pieces[0])).toMatchObject({
      type: "text",
      text: "Hello there\n",
      boldRanges: [{ start: 0, end: 5 }],
    });
    expect(pieces[1]).toMatchObject({ type: "h1", title: "Title" });
    expect(normalizePiece(pieces[2])).toMatchObject({
      type: "text",
      text: "\nTail",
      boldRanges: [{ start: 1, end: 5 }],
    });
  });

  it("creates multiple headings for multiline selection", () => {
    const block = { type: "text", text: "A\nB\nC" };
    const pieces = splitTextBlockForHeadings(block, { start: 2, end: 5 }, "h3");
    expect(pieces.map((p) => [p.type, p.title || p.text])).toEqual([
      ["text", "A\n"],
      ["h3", "B"],
      ["h3", "C"],
    ]);
  });
});

describe("applyHeadingToTextBlock", () => {
  it("replaces one TEXT block with split pieces", () => {
    const blocks = [{ id: "t1", type: "text", text: "Line one\nLine two" }];
    const next = applyHeadingToTextBlock(blocks, 0, { start: 9, end: 17 }, "h2", { idPrefix: "NTX" });
    expect(next).toHaveLength(2);
    expect(next[0].type).toBe("text");
    expect(next[0].text).toBe("Line one\n");
    expect(next[1].type).toBe("h2");
    expect(next[1].title).toBe("Line two");
  });
});

describe("demoteHeadingBlockToText", () => {
  it("converts H2 block to TEXT", () => {
    const blocks = [{ id: "h2", type: "h2", title: "Section" }];
    const next = demoteHeadingBlockToText(blocks, 0);
    expect(next[0]).toEqual({ id: "h2", type: "text", text: "Section" });
  });
});

function normalizePiece(piece) {
  if (!piece?.boldRanges) return piece;
  return {
    ...piece,
    boldRanges: piece.boldRanges.filter((range) => range.end > range.start),
  };
}
