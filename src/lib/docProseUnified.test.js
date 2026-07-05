import { describe, expect, it } from "vitest";
import { createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import {
  findProseUnitForBlockIndex,
  partitionBlocksForUnifiedProse,
  plainTextToProseBlocks,
  proseSegmentToEditableText,
  proseSegmentToPlainText,
  replaceProseSegmentByBlockIds,
} from "./docProseUnified.js";

describe("docProseUnified", () => {
  it("merges and splits headline + body paragraphs", () => {
    const h1 = createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "Headline" });
    const t1 = createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "Paragraph one" });
    const t2 = createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T2", text: "Paragraph two" });
    const blocks = [h1, t1, t2];

    const segments = partitionBlocksForUnifiedProse(blocks);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe("prose");

    const merged = proseSegmentToPlainText(blocks, 0, 2);
    expect(merged).toBe("Headline\n\nParagraph one\n\nParagraph two");

    const roundTrip = replaceProseSegmentByBlockIds(
      blocks,
      segments[0].blockIds,
      "New title\n\nNew body",
    );
    expect(roundTrip[0].title).toBe("New title");
    expect(roundTrip[1].text).toBe("New body");
    expect(roundTrip[0].id).toBe("H1");
  });

  it("keeps agent and todo blocks outside prose segments", () => {
    const agent = createDocBlock(DOC_BLOCK_TYPES.AGENT, { id: "A1", title: "Agent" });
    const h1 = createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "Title" });
    const text = createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "Body" });
    const todo = createDocBlock(DOC_BLOCK_TYPES.TODO, {
      id: "TD1",
      listTitle: "Plan",
      items: [{ id: "i1", text: "Item", checked: false }],
    });

    const segments = partitionBlocksForUnifiedProse([agent, h1, text, todo]);
    expect(segments.map((s) => s.kind)).toEqual(["block", "prose", "block"]);
  });

  it("preserves block ids when editing unified prose", () => {
    const existing = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "keep-h1", title: "A" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "keep-t1", text: "B" }),
    ];
    const next = plainTextToProseBlocks("A\n\nB\n\nC", existing);
    expect(next[0].id).toBe("keep-h1");
    expect(next[1].id).toBe("keep-t1");
    expect(next[2].text).toBe("C");
  });

  it("joins editable prose without trimming block values", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "Headline" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "Body line" }),
    ];
    expect(proseSegmentToEditableText(blocks, 0, 1)).toBe("Headline\n\nBody line");
    expect(proseSegmentToPlainText(blocks, 0, 1)).toBe("Headline\n\nBody line");
  });

  it("finds prose unit for H1 + body text blocks", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "Title" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "Body" }),
      createDocBlock(DOC_BLOCK_TYPES.TODO, { id: "TD1", listTitle: "Plan", items: [] }),
    ];
    expect(findProseUnitForBlockIndex(blocks, 0)).toEqual({ start: 0, end: 1 });
    expect(findProseUnitForBlockIndex(blocks, 1)).toEqual({ start: 0, end: 1 });
    expect(findProseUnitForBlockIndex(blocks, 2)).toEqual({ start: 2, end: 2 });
  });
});
