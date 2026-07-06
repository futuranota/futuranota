import { describe, expect, it } from "vitest";
import { DOC_BLOCK_TYPES } from "./docBlocks.js";
import {
  applySlashInTextBlock,
  createEmptyTextBlock,
  createInlineH1Block,
  ensureEmptyTextBlockAfterNode,
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
