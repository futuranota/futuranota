import { describe, expect, it } from "vitest";
import {
  applyOrganizeToWritingBlocks,
  classifyOrganizeParagraphs,
  isLibraryHashLine,
  isStrictHeadingCandidate,
  normalizeSocialPasteText,
  organizePastedTextToNodeBlocks,
  organizePastedTextToSegments,
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
  it("makes first paragraph H1 and ALL CAPS H2", () => {
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
});

describe("isStrictHeadingCandidate", () => {
  it("rejects long body sentences", () => {
    expect(isStrictHeadingCandidate("This is a normal sentence that should stay body.")).toBe(false);
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
});

describe("applyOrganizeToWritingBlocks", () => {
  it("reorganizes prose and preserves todo blocks", () => {
    const before = [
      createEmptyTextBlock("messy title\n\nsome body that wraps\nbadly"),
      createInlineTodoBlock("Todo list:"),
    ];
    const { blocks, changed } = applyOrganizeToWritingBlocks(before);
    expect(changed).toBe(true);
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(blocks.some((b) => b.type === NODE_BLOCK_TYPES.TODO)).toBe(true);
  });

  it("no-ops on empty prose", () => {
    const before = [createInlineTodoBlock("Todo list:")];
    const { changed } = applyOrganizeToWritingBlocks(before);
    expect(changed).toBe(false);
  });

  it("does not turn existing H1 into hash text", () => {
    const before = [
      createInlineH1Block("Already a title"),
      createEmptyTextBlock("Body paragraph."),
    ];
    const { blocks } = applyOrganizeToWritingBlocks(before);
    expect(blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(blocks[0].title).toBe("Already a title");
  });
});
