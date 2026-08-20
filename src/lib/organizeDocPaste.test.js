import { describe, expect, it } from "vitest";
import {
  estimateCharsCapacity,
  packTextIntoCellChunks,
  resolvePackCellChars,
} from "./organizeDocCellCapacity.js";
import {
  applyOrganizeToWritingBlocks,
  classifyOrganizeParagraphs,
  isLibraryHashLine,
  isStrictHeadingCandidate,
  looksLikeDocumentTitle,
  normalizeSocialPasteText,
  organizePastedTextToNodeBlocks,
  organizePastedTextToSegments,
  planOrganizeWritingBlocks,
} from "./organizeDocPaste.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  createInlineTodoBlock,
  NODE_BLOCK_TYPES,
} from "./nodeInlineContent.js";

describe("isLibraryHashLine", () => {
  it("protects #i and #o variants", () => {
    expect(isLibraryHashLine("#i")).toBe(true);
    expect(isLibraryHashLine("#o")).toBe(true);
    expect(isLibraryHashLine("#input")).toBe(true);
    expect(isLibraryHashLine("#output extra")).toBe(true);
    expect(isLibraryHashLine("# Title")).toBe(false);
    expect(isLibraryHashLine("##")).toBe(false);
    expect(isLibraryHashLine("#imagen")).toBe(false);
  });
});

describe("normalizeSocialPasteText", () => {
  it("repairs soft-wrapped social lines into paragraphs", () => {
    const paragraphs = normalizeSocialPasteText(
      "Launch week\n\nThis is a long line that got\nbroken in the middle by paste\n\nNEXT STEPS\nShip the build",
    );
    expect(paragraphs[0]).toBe("Launch week");
    expect(paragraphs[1]).toMatch(/broken in the middle/);
    expect(paragraphs).toContain("NEXT STEPS");
  });
});

describe("classifyOrganizeParagraphs", () => {
  it("makes first title H1 and ALL CAPS H2", () => {
    const segments = classifyOrganizeParagraphs([
      "Big idea for the post",
      "Some body copy that explains the offer.",
      "WHY IT MATTERS",
      "Because clarity sells.",
    ]);
    expect(segments.map((s) => s.kind)).toEqual(["h1", "text", "h2", "text"]);
    expect(segments[0].text).toBe("Big idea for the post");
    expect(segments[2].text).toBe("WHY IT MATTERS");
  });

  it("keeps #i / #o as text and converts markdown headings with space", () => {
    const segments = organizePastedTextToSegments(
      "# Title from markdown\n\nBody here\n\n#i\n\n## Sub from markdown\n\nMore",
    );
    expect(segments[0]).toEqual({ kind: "h1", text: "Title from markdown" });
    expect(segments.some((s) => s.kind === "text" && s.text === "#i")).toBe(true);
    expect(segments.some((s) => s.kind === "h2" && s.text === "Sub from markdown")).toBe(true);
  });

  it("does not force a long body paragraph into H1", () => {
    const longBody = "This is a long opening paragraph that clearly reads like body copy with multiple clauses and should stay text until a real title appears.";
    const segments = classifyOrganizeParagraphs([
      longBody,
      "Scene One",
      "Then the story continues with more detail for the reader.",
    ]);
    expect(segments[0].kind).toBe("text");
    expect(segments.some((s) => s.kind === "h1" && s.text === "Scene One")).toBe(true);
  });
});

describe("looksLikeDocumentTitle", () => {
  it("accepts short titles and rejects long sentences", () => {
    expect(looksLikeDocumentTitle("Launch week")).toBe(true);
    expect(looksLikeDocumentTitle("This is a normal sentence that should stay body.")).toBe(false);
  });
});

describe("isStrictHeadingCandidate", () => {
  it("rejects long body sentences", () => {
    expect(isStrictHeadingCandidate("This is a normal sentence that should stay body.")).toBe(false);
  });
});

describe("packTextIntoCellChunks", () => {
  it("splits long prose across cell capacity", () => {
    const text = Array.from({ length: 8 }, (_, i) => `Paragraph number ${i + 1} with enough words to count.`).join("\n\n");
    const chunks = packTextIntoCellChunks(text, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n")).toContain("Paragraph number 1");
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
  });
});

describe("resolvePackCellChars", () => {
  it("uses median capacity", () => {
    expect(resolvePackCellChars([100, 200, 300])).toBe(200);
    expect(estimateCharsCapacity({ widthPx: 400, heightPx: 72, fontSizePx: 14, lineHeightPx: 20 })).toBeGreaterThan(40);
  });
});

describe("organizePastedTextToNodeBlocks", () => {
  it("emits real H1/H2/TEXT blocks with writable tail", () => {
    const blocks = organizePastedTextToNodeBlocks(
      "Headline\n\nIntro paragraph.\n\nDETAILS\n\nMore detail.",
    );
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(blocks[0].title).toBe("Headline");
    expect(blocks.some((b) => b.type === NODE_BLOCK_TYPES.H2 && b.title === "DETAILS")).toBe(true);
    expect(blocks[blocks.length - 1].type).toBe(NODE_BLOCK_TYPES.TEXT);
  });

  it("packs body into multiple TEXT cells by capacity", () => {
    const body = Array.from({ length: 6 }, (_, i) => `Block of story text ${i + 1} that should fill cells.`).join("\n\n");
    const blocks = organizePastedTextToNodeBlocks(`Story Title\n\n${body}`, { charsPerCell: 70 });
    const textBlocks = blocks.filter((b) => b.type === NODE_BLOCK_TYPES.TEXT && (b.text || "").trim());
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(textBlocks.length).toBeGreaterThan(1);
  });
});

describe("applyOrganizeToWritingBlocks", () => {
  it("reorganizes prose, collapses empty cells, preserves todo blocks", () => {
    const before = [
      createEmptyTextBlock("messy title\n\nsome body that wraps\nbadly"),
      createEmptyTextBlock(""),
      createEmptyTextBlock(""),
      createInlineTodoBlock("Todo list:"),
    ];
    const { blocks, changed } = applyOrganizeToWritingBlocks(before, { charsPerCell: 120 });
    expect(changed).toBe(true);
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(blocks.some((b) => b.type === NODE_BLOCK_TYPES.TODO)).toBe(true);
    const emptyMid = blocks.filter((b, i) => (
      i < blocks.length - 1
      && b.type === NODE_BLOCK_TYPES.TEXT
      && !(b.text || "").trim()
      && !b.embedded
    ));
    expect(emptyMid.length).toBe(0);
  });

  it("no-ops on empty prose", () => {
    const before = [createInlineTodoBlock("Todo list:")];
    const { changed } = applyOrganizeToWritingBlocks(before);
    expect(changed).toBe(false);
  });

  it("preserves existing H1 when re-organizing", () => {
    const before = [
      createInlineH1Block("Already a title"),
      createEmptyTextBlock("Body paragraph."),
      createEmptyTextBlock(""),
    ];
    const { blocks } = applyOrganizeToWritingBlocks(before);
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(blocks[0].title).toBe("Already a title");
  });
});

describe("planOrganizeWritingBlocks", () => {
  it("returns progressive steps ending at final blocks", () => {
    const before = [
      createEmptyTextBlock("Story Title\n\nFirst body.\n\nNEXT\n\nSecond body."),
      createEmptyTextBlock(""),
    ];
    const plan = planOrganizeWritingBlocks(before, { charsPerCell: 200 });
    expect(plan.changed).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(1);
    expect(plan.steps[plan.steps.length - 1]).toEqual(plan.blocks);
    expect(plan.steps[0].some((b) => b.type === NODE_BLOCK_TYPES.H1)).toBe(false);
  });
});
