import { describe, expect, it } from "vitest";
import { DOC_BLOCK_TYPES, createDocBlock } from "./docBlocks.js";
import {
  applyH1MarkdownShortcutToDocBlocks,
  applyH1MarkdownShortcutToNodeBlocks,
  findH1MarkdownShortcutCaret,
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

  it("matches ## before existing line text", () => {
    expect(matchH1MarkdownShortcut("##Hello", 2)).toBe(true);
  });

  it("matches ## at start of a later line", () => {
    expect(matchH1MarkdownShortcut("Hello\n##", 8)).toBe(true);
  });

  it("does not match single #", () => {
    expect(matchH1MarkdownShortcut("#", 1)).toBe(false);
  });

  it("does not match ## mid-line", () => {
    expect(matchH1MarkdownShortcut("x##", 3)).toBe(false);
  });
});

describe("resolveH1MarkdownShortcutFromKey", () => {
  it("completes ## on the second # key with title text after caret", () => {
    expect(resolveH1MarkdownShortcutFromKey("#Hello", 1, "#")).toEqual({
      text: "##Hello",
      caret: 2,
    });
  });

  it("confirms with Space after ##", () => {
    expect(resolveH1MarkdownShortcutFromKey("##", 2, " ")).toEqual({
      text: "##",
      caret: 2,
    });
  });

  it("does not fire on first #", () => {
    expect(resolveH1MarkdownShortcutFromKey("", 0, "#")).toBeNull();
  });
});

describe("splitAroundH1MarkdownMarker", () => {
  it("splits empty-only ##", () => {
    expect(splitAroundH1MarkdownMarker("##", 2)).toEqual({
      before: "",
      title: "",
      after: "",
      headEnd: 0,
      tailStart: 2,
    });
  });

  it("uses rest of line as title", () => {
    expect(splitAroundH1MarkdownMarker("##Hello world", 2)).toEqual({
      before: "",
      title: "Hello world",
      after: "",
      headEnd: 0,
      tailStart: 13,
    });
  });

  it("strips one leading space from title", () => {
    expect(splitAroundH1MarkdownMarker("## Title", 2).title).toBe("Title");
  });

  it("keeps later lines in after", () => {
    expect(splitAroundH1MarkdownMarker("##Title\nbody", 2)).toEqual({
      before: "",
      title: "Title",
      after: "body",
      headEnd: 0,
      tailStart: 8,
    });
  });

  it("keeps prior lines in before", () => {
    expect(splitAroundH1MarkdownMarker("Hello\n##World", 8)).toEqual({
      before: "Hello\n",
      title: "World",
      after: "",
      headEnd: 6,
      tailStart: 13,
    });
  });
});

describe("findH1MarkdownShortcutCaret", () => {
  it("finds caret after ## with title", () => {
    expect(findH1MarkdownShortcutCaret("##Hello")).toBe(2);
  });

  it("returns -1 when absent", () => {
    expect(findH1MarkdownShortcutCaret("Hello")).toBe(-1);
  });
});

describe("applyH1MarkdownShortcutToDocBlocks", () => {
  it("replaces only-## TEXT with empty H1 and writable tail at end", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "##" })];
    const result = applyH1MarkdownShortcutToDocBlocks(blocks, 0, "##", 2);

    expect(result.blocks[0].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("");
    expect(result.blocks[1]?.type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[1]?.text).toBe("");
    expect(result.blocks).toHaveLength(2);
  });

  it("promotes rest of line into H1 title", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "##Hello world" })];
    const result = applyH1MarkdownShortcutToDocBlocks(blocks, 0, "##Hello world", 2);

    expect(result.blocks[0].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("Hello world");
  });

  it("does not insert empty TEXT between H1 and existing body below", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "##Title\nbody below" })];
    const result = applyH1MarkdownShortcutToDocBlocks(blocks, 0, "##Title\nbody below", 2);

    expect(result.blocks[0].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("Title");
    expect(result.blocks[1].type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[1].text).toBe("body below");
    // Writable tail only at the very end — not between H1 and body.
    expect(result.blocks[2]?.type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[2]?.text).toBe("");
    expect(result.blocks).toHaveLength(3);
  });

  it("keeps prior line TEXT and inserts H1 with title", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "Hello\n##World" })];
    const result = applyH1MarkdownShortcutToDocBlocks(blocks, 0, "Hello\n##World", 8);

    expect(result.blocks[0].type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[0].text).toBe("Hello\n");
    expect(result.blocks[1].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[1].title).toBe("World");
  });

  it("returns null when shortcut does not match", () => {
    const blocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "#" })];
    expect(applyH1MarkdownShortcutToDocBlocks(blocks, 0, "#", 1)).toBeNull();
  });
});

describe("applyH1MarkdownShortcutToNodeBlocks", () => {
  it("promotes line text into H1 title", () => {
    const blocks = [createEmptyTextBlock("##Hello")];
    const result = applyH1MarkdownShortcutToNodeBlocks(blocks, 0, "##Hello", 2);

    expect(result.blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("Hello");
  });

  it("keeps body below without empty gap under H1", () => {
    const blocks = [createEmptyTextBlock("##Title\nbody")];
    const result = applyH1MarkdownShortcutToNodeBlocks(blocks, 0, "##Title\nbody", 2);

    expect(result.blocks[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(result.blocks[0].title).toBe("Title");
    expect(result.blocks[1].type).toBe(NODE_BLOCK_TYPES.TEXT);
    expect(result.blocks[1].text).toBe("body");
  });
});
