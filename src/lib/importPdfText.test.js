import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  extractTextFromPdfData,
  isPdfLibraryAttachment,
  mergePdfTextIntoWritingBlocks,
  normalizePdfExtractedText,
  pastePdfPageTexts,
  splitPastedPdfText,
  textItemsToPageText,
  writingTextAreasAreEmpty,
} from "./importPdfText.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
} from "./nodeInlineContent.js";

describe("splitPastedPdfText", () => {
  it("keeps a body without a Prompt heading as the prompt", () => {
    expect(splitPastedPdfText("Crea la hoja\ncon luz suave")).toEqual({
      description: "",
      prompt: "Crea la hoja\ncon luz suave",
    });
  });

  it("splits description and prompt on the heading", () => {
    expect(splitPastedPdfText("01 / CREAR LA HOJA\nExplica el encuadre\n\nPrompt\n{add this producto}")).toEqual({
      description: "01 / CREAR LA HOJA\nExplica el encuadre",
      prompt: "{add this producto}",
    });
  });

  it("keeps the body when the heading has nothing after it", () => {
    expect(splitPastedPdfText("Solo esto\nPrompt")).toEqual({
      description: "",
      prompt: "Solo esto\nPrompt",
    });
  });
});

describe("pastePdfPageTexts", () => {
  it("skips blank pages and joins the rest", () => {
    expect(pastePdfPageTexts(["", "Hola", "Prompt\nSigue"])).toEqual({
      description: "Hola",
      prompt: "Sigue",
    });
  });
});

describe("normalizePdfExtractedText", () => {
  it("collapses noisy whitespace", () => {
    expect(normalizePdfExtractedText("  a \n\n\n b  \t\n")).toBe("a\n\nb");
  });

  it("moves a spaced dash onto the next line and keeps a hyphen inside a word", () => {
    expect(normalizePdfExtractedText("calidad - envíos y e-commerce GPT-4o")).toBe(
      "calidad\n- envíos y e-commerce GPT-4o",
    );
  });

  it("joins a letter split from its accent", () => {
    expect(normalizePdfExtractedText(
      "Proporciona una estructura l ó gica. Garant í as y env í os.",
    )).toBe("Proporciona una estructura lógica. Garantías y envíos.");
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

describe("writingTextAreasAreEmpty", () => {
  it("treats blank textareas as empty", () => {
    expect(writingTextAreasAreEmpty([createEmptyTextBlock("  ")])).toBe(true);
  });

  it("ignores document-style H1 titles — only textareas count", () => {
    expect(writingTextAreasAreEmpty([
      createInlineH1Block("Doc heading"),
      createEmptyTextBlock(""),
    ])).toBe(true);
  });

  it("is not empty when a textarea has prose", () => {
    expect(writingTextAreasAreEmpty([
      createInlineH1Block(""),
      createEmptyTextBlock("hello"),
    ])).toBe(false);
  });
});

describe("isPdfLibraryAttachment", () => {
  it("detects pdf by kind, name, or category", () => {
    expect(isPdfLibraryAttachment({ category: "pdf" })).toBe(true);
    expect(isPdfLibraryAttachment({
      category: "skill",
      attachmentKind: "application/pdf",
    })).toBe(true);
    expect(isPdfLibraryAttachment({
      category: "skill",
      attachmentName: "notes.pdf",
    })).toBe(true);
    expect(isPdfLibraryAttachment({
      category: "skill",
      attachmentName: "readme.md",
    })).toBe(false);
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
