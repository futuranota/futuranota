import { describe, expect, it } from "vitest";
import {
  DEFAULT_CELL_CHARS,
  estimateCharsCapacity,
  packTextIntoCellChunks,
  resolvePackCellChars,
} from "./organizeDocCellCapacity.js";

describe("estimateCharsCapacity", () => {
  it("scales with height and width", () => {
    const short = estimateCharsCapacity({
      widthPx: 400,
      heightPx: 24,
      fontSizePx: 14,
      lineHeightPx: 20,
    });
    const tall = estimateCharsCapacity({
      widthPx: 400,
      heightPx: 120,
      fontSizePx: 14,
      lineHeightPx: 20,
    });
    expect(tall).toBeGreaterThan(short);
    expect(short).toBeGreaterThanOrEqual(48);
  });
});

describe("packTextIntoCellChunks", () => {
  it("keeps short text in one chunk", () => {
    expect(packTextIntoCellChunks("Hello world", 200)).toEqual(["Hello world"]);
  });

  it("returns empty for blank", () => {
    expect(packTextIntoCellChunks("   ")).toEqual([]);
  });
});

describe("resolvePackCellChars", () => {
  it("falls back to default", () => {
    expect(resolvePackCellChars([])).toBe(DEFAULT_CELL_CHARS);
  });
});
