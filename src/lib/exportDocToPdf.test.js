import { describe, expect, it } from "vitest";
import {
  collectWritingProseSegments,
  sanitizePdfFileName,
  writingBlocksHaveExportableProse,
  buildWritingBlocksPdf,
} from "./exportDocToPdf.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  createInlineH2Block,
  createInlineTodoBlock,
  NODE_BLOCK_TYPES,
} from "./nodeInlineContent.js";

describe("collectWritingProseSegments", () => {
  it("collects headings and text, skips todos", () => {
    const segments = collectWritingProseSegments([
      createInlineH1Block("Title"),
      createEmptyTextBlock("Body paragraph."),
      createInlineH2Block("Section"),
      createInlineTodoBlock("Todo list:"),
      createEmptyTextBlock(""),
    ]);
    expect(segments).toEqual([
      { kind: "h1", text: "Title" },
      { kind: "text", text: "Body paragraph." },
      { kind: "h2", text: "Section" },
    ]);
  });

  it("detects empty prose", () => {
    expect(writingBlocksHaveExportableProse([createEmptyTextBlock("")])).toBe(false);
    expect(writingBlocksHaveExportableProse([
      createInlineH1Block("Hi"),
    ])).toBe(true);
  });
});

describe("sanitizePdfFileName", () => {
  it("adds .pdf and strips bad chars", () => {
    expect(sanitizePdfFileName("My Doc / Draft")).toBe("My Doc Draft.pdf");
    expect(sanitizePdfFileName("ready.pdf")).toBe("ready.pdf");
  });
});

describe("sanitizePdfText", () => {
  it("keeps latin accents and strips emoji", async () => {
    const { sanitizePdfText } = await import("./exportDocToPdf.js");
    expect(sanitizePdfText("café niño")).toContain("café");
    expect(sanitizePdfText("hola 🚀 listo")).toBe("hola  listo");
  });
});

describe("buildWritingBlocksPdf", () => {
  it("builds non-empty pdf bytes from prose", async () => {
    const { bytes, empty, fileName } = await buildWritingBlocksPdf([
      createInlineH1Block("Launch"),
      createEmptyTextBlock("Ship the build tomorrow."),
    ], { title: "Launch" });
    expect(empty).toBe(false);
    expect(fileName).toBe("Launch.pdf");
    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(bytes[0]).toBe(0x25); // %PDF
  });

  it("builds pdf when body has emoji", async () => {
    const { bytes, empty } = await buildWritingBlocksPdf([
      createInlineH1Block("Launch 🚀"),
      createEmptyTextBlock("Ship it tomorrow ✨"),
    ], { title: "Launch 🚀" });
    expect(empty).toBe(false);
    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(bytes[0]).toBe(0x25);
  });

  it("marks empty when no prose", async () => {
    const { empty } = await buildWritingBlocksPdf([createEmptyTextBlock("")]);
    expect(empty).toBe(true);
  });
});
