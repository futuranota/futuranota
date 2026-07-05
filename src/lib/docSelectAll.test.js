import { describe, expect, it } from "vitest";
import { createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import {
  collectCopyableDocPlainText,
  isTextFieldFullySelected,
} from "./docSelectAll.js";

describe("docSelectAll", () => {
  it("collectCopyableDocPlainText includes H1 + body and skips TODOs", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1", title: "Section title" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T1", text: "Body paragraph" }),
      createDocBlock(DOC_BLOCK_TYPES.TODO, {
        id: "TD1",
        listTitle: "Plan",
        items: [{ id: "i1", text: "Item", checked: false }],
      }),
    ];

    expect(collectCopyableDocPlainText(blocks)).toBe("Section title\n\nBody paragraph");
  });

  it("collectCopyableDocPlainText includes linked H1 title and skips hidden macro answer", () => {
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, {
        id: "H1",
        title: "Linked title",
        nodeId: "node-1",
        queryEnabled: true,
        nodeLinkColor: "mint",
      }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, {
        id: "T1",
        text: "hidden answer",
        macroNodeSlot: "macro-answer",
      }),
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H2", title: "Next section" }),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: "T2", text: "Visible body" }),
    ];

    expect(collectCopyableDocPlainText(blocks)).toBe(
      "Linked title\n\nNext section\n\nVisible body",
    );
  });

  it("isTextFieldFullySelected detects full field selection", () => {
    /** @type {HTMLTextAreaElement} */
    const field = {
      value: "Hello",
      selectionStart: 0,
      selectionEnd: 5,
    };
    expect(isTextFieldFullySelected(field)).toBe(true);

    field.selectionEnd = 3;
    expect(isTextFieldFullySelected(field)).toBe(false);

    field.value = "";
    field.selectionEnd = 0;
    expect(isTextFieldFullySelected(field)).toBe(true);
  });
});
