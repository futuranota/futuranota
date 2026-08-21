import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  extractTextFromPdfData,
  mergePdfTextIntoWritingBlocks,
  normalizePdfExtractedText,
  textItemsToPageText,
  writingBlocksAreEffectivelyEmpty,
} from "./importPdfText.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
} from "./nodeInlineContent.js";

describe("normalizePdfExtractedText", () => {
  it("collapses noisy whitespace", () => {
    expect(normalizePdfExtractedText("  a \n\n\n b  \t\n")).toBe("a\n\nb");
  });
});

describe("textItemsToPageText", () => {
  it("joins same-line items with spaces and breaks on y jumps", () => {
    const text = textItemsToPageText([
      { str: "Hello", transform: [1, 0, 0, 1, 0, 100] },
      { str: "world", transform: [1, 0, 0, 1, 40, 100] },
      { str: "Next", transform: [1, 0, 0, 1, 0, 80] },
    ]);
    expect(text).toContain("Hello world");
    expect(text).toContain("\nNext");
  });
});

describe("mergePdfTextIntoWritingBlocks", () => {
  it("fills an empty writing surface", () => {
    const { blocks, changed, empty } = mergePdfTextIntoWritingBlocks(
      [createEmptyTextBlock("")],
      "Paragraph from PDF",
    );
    expect(empty).toBe(false);
    expect(changed).toBe(true);
    expect(blocks[0].text).toBe("Paragraph from PDF");
  });

  it("appends after existing prose", () => {
    const { blocks, changed } = mergePdfTextIntoWritingBlocks(
      [createInlineH1Block("Title"), createEmptyTextBlock("Keep me")],
      "Imported",
    );
    expect(changed).toBe(true);
    expect(blocks.some((b) => b.text === "Keep me")).toBe(true);
    expect(blocks.some((b) => b.text === "Imported")).toBe(true);
  });

  it("marks empty extract", () => {
    const result = mergePdfTextIntoWritingBlocks(
      [createEmptyTextBlock("")],
      "   ",
    );
    expect(result.empty).toBe(true);
    expect(result.changed).toBe(false);
  });
});

describe("writingBlocksAreEffectivelyEmpty", () => {
  it("treats blank text as empty", () => {
    expect(writingBlocksAreEffectivelyEmpty([createEmptyTextBlock("  ")])).toBe(true);
  });

  it("treats heading as content", () => {
    expect(writingBlocksAreEffectivelyEmpty([createInlineH1Block("Hi")])).toBe(false);
  });
});

describe("extractTextFromPdfData", () => {
  it("reads text written with pdf-lib", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 200]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Futura Nota import probe", {
      x: 24,
      y: 150,
      size: 14,
      font,
    });
    const bytes = await pdf.save();
    const result = await extractTextFromPdfData(bytes);
    expect(result.empty).toBe(false);
    expect(result.text).toMatch(/Futura Nota import probe/);
    expect(result.pageCount).toBe(1);
  });
});
