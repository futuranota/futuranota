import { describe, expect, it } from "vitest";
import { DOC_BLOCK_TYPES, createDocBlock } from "./docBlocks.js";
import {
  applyVisibleNodeReorder,
  getLinkedOwnerBundleEndIndex,
  reorderLinkedOwnerBundlesInBlocks,
} from "./folderDocumentOrder.js";

describe("folderDocumentOrder", () => {
  it("reorders linked owner bundles and keeps loose text in place", () => {
    const a = createDocBlock(DOC_BLOCK_TYPES.H1, {
      text: "Alpha",
      title: "Alpha",
      nodeId: "n-a",
      queryEnabled: true,
      nodeLinkColor: "mint",
    });
    const aBody = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "a body" });
    const mid = createDocBlock(DOC_BLOCK_TYPES.H2, { title: "middle note" });
    const b = createDocBlock(DOC_BLOCK_TYPES.H1, {
      text: "Beta",
      title: "Beta",
      nodeId: "n-b",
      queryEnabled: true,
      nodeLinkColor: "mint",
    });
    const bBody = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "b body" });
    const blocks = [a, aBody, mid, b, bBody];

    expect(getLinkedOwnerBundleEndIndex(blocks, 0)).toBe(1);

    const next = reorderLinkedOwnerBundlesInBlocks(blocks, ["n-b", "n-a"]);
    const titles = next.filter((block) => block.type === DOC_BLOCK_TYPES.H1).map((blk) => blk.nodeId);
    expect(titles).toEqual(["n-b", "n-a"]);
    const midIndex = next.findIndex((block) => block.title === "middle note");
    const bIndex = next.findIndex((block) => block.nodeId === "n-b");
    const aIndex = next.findIndex((block) => block.nodeId === "n-a");
    expect(bIndex).toBeLessThan(midIndex);
    expect(midIndex).toBeLessThan(aIndex);
  });

  it("applies visible reorder into full id list", () => {
    expect(applyVisibleNodeReorder(["a", "b", "c", "d"], ["c", "a"])).toEqual([
      "c",
      "b",
      "a",
      "d",
    ]);
  });
});
