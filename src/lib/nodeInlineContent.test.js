import { describe, expect, it } from "vitest";
import { DOC_BLOCK_TYPES } from "./docBlocks.js";
import {
  appendNodeWritingBlock,
  applySlashInTextBlock,
  createEmptyTextBlock,
  createInlineH1Block,
  ensureEmptyTextBlockAfterNode,
  insertNodeWritingSlashAtFocus,
  NODE_BLOCK_TYPES,
} from "./nodeInlineContent.js";

describe("applySlashInTextBlock /title", () => {
  it("replaces empty TEXT with empty H1 and tail TEXT", () => {
    const blocks = [createEmptyTextBlock("/title")];
    const next = applySlashInTextBlock(blocks, 0, { type: DOC_BLOCK_TYPES.H1 });

    expect(next[0].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(next[0].title).toBe("");
    expect(next[1]?.type).toBe(NODE_BLOCK_TYPES.TEXT);
    expect(next[1]?.text).toBe("");
  });

  it("keeps prefix in TEXT and inserts empty H1 after when slash starts a line", () => {
    const blocks = [createEmptyTextBlock("Hello\n/title")];
    const next = applySlashInTextBlock(blocks, 0, { type: DOC_BLOCK_TYPES.H1 });

    expect(next[0].type).toBe(NODE_BLOCK_TYPES.TEXT);
    expect(next[0].text).toBe("Hello\n");
    expect(next[1].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(next[1].title).toBe("");
  });
});

describe("insertNodeWritingSlashAtFocus", () => {
  it("inserts H1 at the focused empty TEXT, not after trailing empties", () => {
    const content = createEmptyTextBlock("que eventualmente puedan comparar");
    const emptyA = createEmptyTextBlock();
    const emptyB = createEmptyTextBlock();
    const emptyC = createEmptyTextBlock();
    const blocks = [content, emptyA, emptyB, emptyC];

    const { blocks: next, insertedIndex } = insertNodeWritingSlashAtFocus(
      blocks,
      { blockIndex: 1, focusText: true },
      { type: DOC_BLOCK_TYPES.H1 },
    );

    expect(next[0].text).toBe("que eventualmente puedan comparar");
    expect(next[1].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(insertedIndex).toBe(1);
    expect(next.filter((b) => b.type === NODE_BLOCK_TYPES.TEXT && !(b.text || "").trim())).toHaveLength(1);
  });

  it("falls back to first trailing empty when focus is missing", () => {
    const content = createEmptyTextBlock("hello");
    const emptyA = createEmptyTextBlock();
    const emptyB = createEmptyTextBlock();
    const blocks = [content, emptyA, emptyB];

    const { blocks: next, insertedIndex } = insertNodeWritingSlashAtFocus(
      blocks,
      null,
      { type: DOC_BLOCK_TYPES.H2 },
    );

    expect(next[0].text).toBe("hello");
    expect(next[1].type).toBe(NODE_BLOCK_TYPES.H2);
    expect(insertedIndex).toBe(1);
  });

  it("appendNodeWritingBlock no longer parks blocks after a stack of empties", () => {
    const content = createEmptyTextBlock("hello");
    const emptyA = createEmptyTextBlock();
    const emptyB = createEmptyTextBlock();
    const h1 = createInlineH1Block("");
    const next = appendNodeWritingBlock([content, emptyA, emptyB], h1);

    expect(next[0].text).toBe("hello");
    expect(next[1].type).toBe(NODE_BLOCK_TYPES.H1);
    expect(next[2]?.type).toBe(NODE_BLOCK_TYPES.TEXT);
  });
});

describe("ensureEmptyTextBlockAfterNode", () => {
  it("does not duplicate an existing empty TEXT block", () => {
    const h1 = createInlineH1Block("Title");
    const text = createEmptyTextBlock();
    const blocks = [h1, text];
    const next = ensureEmptyTextBlockAfterNode(blocks, 0);

    expect(next).toHaveLength(2);
    expect(next[1].id).toBe(text.id);
  });

  it("inserts empty TEXT when missing below H1", () => {
    const h1 = createInlineH1Block("Title");
    const next = ensureEmptyTextBlockAfterNode([h1], 0);

    expect(next).toHaveLength(2);
    expect(next[1].type).toBe(NODE_BLOCK_TYPES.TEXT);
    expect(next[1].text).toBe("");
  });
});
