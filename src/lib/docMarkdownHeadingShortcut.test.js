import { describe, expect, it } from "vitest";
import { DOC_BLOCK_TYPES, createDocBlock } from "./docBlocks.js";
import {
  applyH1MarkdownShortcutToDocBlocks,
  applyH1MarkdownShortcutToNodeBlocks,
  matchH1MarkdownShortcut,
  resolveH1MarkdownShortcutFromKey,
  splitAroundH1MarkdownMarker,
} from "./docMarkdownHeadingShortcut.js";
import {
  createEmptyTextBlock,
  NODE_BLOCK_TYPES,
} from "./nodeInlineContent.js";

describe("matchH1MarkdownShortcut", () => {
  it("matches ## at start of block with caret after marker", () => {
    expect(matchH1MarkdownShortcut("##", 2)).toBe(true);
  });

  it("matches ## at start of a later line", () => {
    expect(matchH1MarkdownShortcut("Hello\n##", 8)).toBe(true);
  });

  it("does not match single #", () => {
    expect(matchH1MarkdownShortcut("#", 1)).toBe(false);
  });

  it("does not match ## with trailing chars before caret", () => {
    expect(matchH1MarkdownShortcut("##x", 3)).toBe(false);
  });

  it("does not match ## mid-line", () => {
    expect(matchH1MarkdownShortcut("x##", 3)).toBe(false);
  });

  it("does not match when caret is before completing ##", () => {
    expect(matchH1MarkdownShortcut("##", 1)).toBe(false);
  });
});

describe("resolveH1MarkdownShortcutFromKey", () => {
  it("completes ## on the second # key", () => {
    expect(resolveH1MarkdownShortcutFromKey("#", 1, "#")).toEqual({
      text: "##",
      caret: 2,
    });
  });

  it("confirms with Space after ##", () => {
    expect(resolveH1MarkdownShortcutFromKey("##", 2, " ")).toEqual({
      text: "##",
      caret: 2,
    });
  });

  it("confirms with code Space", () => {
    expect(resolveH1MarkdownShortcutFromKey("##", 2, "Unidentified", "Space")).toEqual({
      text: "##",
      caret: 2,
    });
  });

  it("does not fire on first #", () => {
    expect(resolveH1MarkdownShortcutFromKey("", 0, "#")).toBeNull();
  });

  it("does not fire Space on single #", () => {
    expect(resolveH1MarkdownShortcutFromKey("#", 1, " ")).toBeNull();
  });
});

describe("splitAroundH1MarkdownMarker", () => {
  it("splits empty-only ##", () => {
    expect(splitAroundH1MarkdownMarker("##", 2)).toEqual({
      before: "",
      after: "",
      headEnd: 0,
      tailStart: 2,
    });
  });

  it("keeps prior lines in before", () => {
    expect(splitAroundH1MarkdownMarker("Hello\n##", 8)).toEqual({
      before: "Hello\n",
      after: "",
      headEnd: 6,
      tailStart: 8,
    });
  });

  it("returns null when not matched", () => {
    expect(splitAroundH1MarkdownMarker("#", 1)).toBeNull();
  });
});

describe("applyH1MarkdownShortcutToDocBlocks", () => {
  it("replaces only-## TEXT with empty H1 and tail TEXT", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "##" })];
    const result = applyH1MarkdownShortcutToDocBlocks(blocks, 0, "##", 2);

    expect(result).not.toBeNull();
    expect(result.blocks[0].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("");
    expect(result.blocks[0].id).toBe(result.h1Id);
    expect(result.blocks[1]?.type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[1]?.text).toBe("");
  });

  it("keeps prior line TEXT and inserts H1 after", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "Hello\n##" })];
    const result = applyH1MarkdownShortcutToDocBlocks(blocks, 0, "Hello\n##", 8);

    expect(result.blocks[0].type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[0].text).toBe("Hello\n");
    expect(result.blocks[1].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[1].id).toBe(result.h1Id);
  });

  it("returns null when shortcut does not match", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "#" })];
    expect(applyH1MarkdownShortcutToDocBlocks(blocks, 0, "#", 1)).toBeNull();
  });
});

describe("applyH1MarkdownShortcutToNodeBlocks", () => {
  it("replaces only-## TEXT with empty H1 and writing tail", () => {
    const blocks = [createEmptyTextBlock("##")];
    const result = applyH1MarkdownShortcutToNodeBlocks(blocks, 0, "##", 2);

    expect(result).not.toBeNull();
    expect(result.blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("");
    expect(result.blocks[0].id).toBe(result.h1Id);
    expect(result.blocks.some((b) => b.type === NODE_BLOCK_TYPES.TEXT)).toBe(true);
  });

  it("keeps prior line and inserts H1", () => {
    const blocks = [createEmptyTextBlock("Hello\n##")];
    const result = applyH1MarkdownShortcutToNodeBlocks(blocks, 0, "Hello\n##", 8);

    expect(result.blocks[0].type).toBe(NODE_BLOCK_TYPES.TEXT);
    expect(result.blocks[0].text).toBe("Hello\n");
    expect(result.blocks[1].type).toBe(NODE_BLOCK_TYPES.H1);
  });
});
