import { describe, expect, it } from "vitest";
import {
  collectWritingProseSegments,
  sanitizePdfFileName,
  sanitizePdfText,
  writingBlocksHaveExportableProse,
  buildWritingBlocksPdf,
} from "./exportDocToPdf.js";
import {
  createEmptyTextBlock,
  createInlineAgentBlock,
  createInlineCodeBlock,
  createInlineH1Block,
  createInlineH2Block,
  createInlineLinkVaultBlock,
  createInlinePasswordVaultBlock,
  createInlineStepSequenceBlock,
  createInlineTodoBlock,
} from "./nodeInlineContent.js";
import { createLinkEntry, createPasswordEntry } from "./vaultBlocks.js";
import { createTodoItem } from "./docBlocks.js";

describe("collectWritingProseSegments", () => {
  it("collects headings, text, code, todos and skips password secrets", () => {
    const todo = createInlineTodoBlock("Checklist");
    todo.items = [
      createTodoItem({ text: "Ship", checked: true }),
      createTodoItem({ text: "Review", checked: false }),
    ];
    const segments = collectWritingProseSegments([
      createInlineH1Block("Title"),
      createEmptyTextBlock("Body paragraph."),
      createInlineH2Block("Section"),
      createInlineCodeBlock("js", "const x = 1;"),
      todo,
      createInlinePasswordVaultBlock([
        createPasswordEntry({ description: "Admin", password: "secret" }),
      ]),
      createEmptyTextBlock(""),
    ]);

    expect(segments.find((s) => s.kind === "h1")).toEqual({ kind: "h1", text: "Title" });
    expect(segments.find((s) => s.kind === "text")).toEqual({
      kind: "text",
      text: "Body paragraph.",
    });
    expect(segments.find((s) => s.kind === "code")).toMatchObject({
      kind: "code",
      language: "javascript",
      text: "const x = 1;",
    });
    expect(segments.find((s) => s.kind === "todo")).toMatchObject({
      kind: "todo",
      title: "Checklist",
      items: [
        { text: "Ship", checked: true },
        { text: "Review", checked: false },
      ],
    });
    const note = segments.find((s) => s.kind === "note");
    expect(note?.text).toMatch(/Password vault/i);
    expect(JSON.stringify(segments)).not.toContain("secret");
  });

  it("collects links, steps and agent", () => {
    const segments = collectWritingProseSegments([
      createInlineLinkVaultBlock([
        createLinkEntry({ name: "Docs", url: "https://example.com" }),
      ]),
      createInlineStepSequenceBlock([{ text: "First" }, { text: "Second" }], true, "Launch"),
      createInlineAgentBlock("Summarize the brief"),
    ]);
    expect(segments.some((s) => s.kind === "links")).toBe(true);
    expect(segments.some((s) => s.kind === "steps")).toBe(true);
    expect(segments.some((s) => s.kind === "agent")).toBe(true);
  });

  it("collects image src segments", () => {
    const segments = collectWritingProseSegments([
      {
        id: "img1",
        type: "image",
        src: "https://cdn.example/a.png",
        imageSaved: true,
        alt: "Hero",
      },
    ]);
    expect(segments).toEqual([
      { kind: "image", src: "https://cdn.example/a.png", caption: "Hero" },
    ]);
  });

  it("detects empty prose", () => {
    expect(writingBlocksHaveExportableProse([createEmptyTextBlock("")])).toBe(false);
    expect(writingBlocksHaveExportableProse([
      createInlineH1Block("Hi"),
    ])).toBe(true);
    expect(writingBlocksHaveExportableProse([
      createInlineCodeBlock("js", "ok"),
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
  it("keeps latin accents and strips emoji", () => {
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

  it("builds pdf with code and todo blocks", async () => {
    const todo = createInlineTodoBlock("Tasks");
    todo.items = [createTodoItem({ text: "Done item", checked: true })];
    const { bytes, empty } = await buildWritingBlocksPdf([
      createInlineH1Block("Mixed"),
      createInlineCodeBlock("js", "console.log(1)"),
      todo,
    ], { title: "Mixed" });
    expect(empty).toBe(false);
    expect(bytes.byteLength).toBeGreaterThan(100);
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
