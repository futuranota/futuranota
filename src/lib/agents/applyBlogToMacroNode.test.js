import { describe, expect, it } from "vitest";
import { createDocBlock, DOC_BLOCK_TYPES } from "../docBlocks.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  NODE_BLOCK_TYPES,
} from "../nodeInlineContent.js";
import {
  isMacroNodeLinkedInParentDoc,
  mergeMacroBlogWritingBlocks,
  splitMacroBlogBodySections,
} from "./applyBlogToMacroNode.js";

describe("applyBlogToMacroNode helpers", () => {
  it("detects linked macro by sourceBlockId or doc nodeId", () => {
    const node = { id: "NODE-1", sourceBlockId: "H1-1" };
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1-1", title: "Query", nodeId: "NODE-1" }),
    ];
    expect(isMacroNodeLinkedInParentDoc(node, blocks)).toBe(true);

    const orphanNode = { id: "NODE-2", sourceBlockId: null };
    expect(isMacroNodeLinkedInParentDoc(orphanNode, [
      createDocBlock(DOC_BLOCK_TYPES.H1, { id: "H1-2", title: "Linked", nodeId: "NODE-2" }),
    ])).toBe(true);
  });

  it("drops duplicated headline from body sections when linked", () => {
    expect(splitMacroBlogBodySections("My title\n\nFirst para", "My title")).toEqual(["First para"]);
    expect(splitMacroBlogBodySections("Intro\n\nSecond", "My title")).toEqual(["Intro", "Second"]);
  });

  it("replaces prior generated prose after /agent when linked", () => {
    const normalized = [
      { id: "A1", type: NODE_BLOCK_TYPES.AGENT, instruction: "Write blog" },
      createInlineH1Block("Old title"),
      createEmptyTextBlock("Old body"),
    ];
    const generated = [createEmptyTextBlock("New body")];
    const next = mergeMacroBlogWritingBlocks(normalized, generated, 0, true);
    expect(next.map((block) => block.type)).toEqual([
      NODE_BLOCK_TYPES.AGENT,
      NODE_BLOCK_TYPES.TEXT,
    ]);
    expect(next[1].text).toBe("New body");
  });
});
