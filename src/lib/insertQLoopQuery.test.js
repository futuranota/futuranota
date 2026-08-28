import { describe, expect, it } from "vitest";
import {
  createDocBlock,
  DOC_BLOCK_TYPES,
} from "./docBlocks.js";
import {
  buildQLoopH1Block,
  insertQLoopQueryIntoDocBlocks,
  stripAtMentionQuery,
} from "./insertQLoopQuery.js";

describe("insertQLoopQuery", () => {
  const qloopSource = {
    loopId: "loop1:blk1",
    loopDocId: "loop1",
    loopBlockId: "blk1",
    queryId: "q1",
    index: 2,
  };

  it("builds an H1 without query mode and with qloop metadata", () => {
    const h1 = buildQLoopH1Block("What is the goal?", qloopSource);
    expect(h1.type).toBe(DOC_BLOCK_TYPES.H1);
    expect(h1.title).toBe("What is the goal?");
    expect(h1.queryEnabled).toBe(false);
    expect(h1.qloopSource.index).toBe(2);
    expect(h1.title).not.toMatch(/^\[/);
  });

  it("inserts H1 at caret and focuses empty text below", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "t1", text: "Hello @q" }),
    ];
    const result = insertQLoopQueryIntoDocBlocks(blocks, {
      blockIndex: 0,
      caretOffset: 6,
      title: "Audience?",
      qloopSource,
    });

    expect(result.blocks).toHaveLength(4);
    expect(result.blocks[0].text).toBe("Hello ");
    expect(result.blocks[1].type).toBe(DOC_BLOCK_TYPES.H1);
    expect(result.blocks[1].title).toBe("Audience?");
    expect(result.blocks[1].qloopSource.loopId).toBe("loop1:blk1");
    expect(result.blocks[2].type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[2].text).toBe("@q");
    expect(result.blocks[3].type).toBe(DOC_BLOCK_TYPES.TEXT);
    expect(result.blocks[3].text).toBe("");
    expect(result.focusBlockId).toBe(result.blocks[3].id);
  });

  it("does not insert description or slot index into document text", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "t1", text: "" }),
    ];
    const result = insertQLoopQueryIntoDocBlocks(blocks, {
      blockIndex: 0,
      caretOffset: 0,
      title: "Question only",
      qloopSource,
    });

    const h1 = result.blocks.find((block) => block.type === DOC_BLOCK_TYPES.H1);
    expect(h1.title).toBe("Question only");
    expect(JSON.stringify(result.blocks)).not.toContain("description");
    expect(h1.title).not.toContain("[2]");
  });

  it("strips an active @ mention query from text", () => {
    const stripped = stripAtMentionQuery("draft @qloop", { start: 6, end: 12 });
    expect(stripped.text).toBe("draft ");
    expect(stripped.caret).toBe(6);
  });
});
