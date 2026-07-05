import { describe, expect, it } from "vitest";
import { createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { findProseUnitForBlockIndex } from "./docProseUnified.js";
import {
  collectDocPlainText,
  resolveProseUnitSelectAll,
} from "./docSelectAll.js";

describe("docSelectAll", () => {
  it("resolves prose unit text for H1 + body from either field", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "My title" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "Body copy" }),
    ];

    expect(resolveProseUnitSelectAll(blocks, 0)).toEqual({
      unit: { start: 0, end: 1 },
      text: "My title\n\nBody copy",
    });
    expect(resolveProseUnitSelectAll(blocks, 1)).toEqual({
      unit: { start: 0, end: 1 },
      text: "My title\n\nBody copy",
    });
  });

  it("resolves H1 + empty body tail as title-only unit text", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "Headline" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "" }),
    ];

    expect(resolveProseUnitSelectAll(blocks, 0)).toEqual({
      unit: { start: 0, end: 1 },
      text: "Headline",
    });
    expect(findProseUnitForBlockIndex(blocks, 1)).toEqual({ start: 0, end: 1 });
  });

  it("does not merge linked H1 with macro answer text", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, {
        id: "H1",
        title: "Linked",
        nodeId: "node-1",
        queryEnabled: true,
        nodeLinkColor: "mint",
      }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, {
        id: "T1",
        text: "hidden answer",
        macroNodeSlot: "macro-answer",
      }),
    ];

    expect(resolveProseUnitSelectAll(blocks, 0)).toBeNull();
    expect(findProseUnitForBlockIndex(blocks, 0)).toEqual({ start: 0, end: 0 });
  });

  it("falls back to full document plain text snapshot", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "A" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "B" }),
      createDocBlock(DOC_BLOCK_TYPES.TODO, {
        id: "TD1",
        listTitle: "Plan",
        items: [{ id: "i1", text: "Item", checked: false }],
      }),
    ];

    expect(collectDocPlainText(blocks)).toBe("A\n\nB\n\nPlan\n\n• Item");
  });
});
