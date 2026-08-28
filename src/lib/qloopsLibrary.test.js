import { describe, expect, it, vi } from "vitest";
import {
  createDocBlock,
  createQLoopEntry,
  DOC_BLOCK_TYPES,
} from "./docBlocks.js";
import {
  collectSavedQLoops,
  collectUsedQLoopIndexesInDocBlocks,
  filterQLoops,
  removeQLoopFromDoc,
  suggestNextQLoopIndex,
} from "./qloopsLibrary.js";
import { isDedicatedQLoopDoc } from "./templateDoc.js";

describe("qloopsLibrary", () => {
  const loopDoc = {
    id: "loop1",
    title: "Discovery",
    parentObjectId: "co1",
    docKind: "standard",
    category: "",
    blocks: [createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
      id: "blk1",
      saved: true,
      title: "Marketing discovery",
      queries: [
        createQLoopEntry({ index: 1, title: "What is the goal?" }),
        createQLoopEntry({ index: 2, title: "Who is the audience?", description: "hint" }),
      ],
    })],
  };

  const folderDoc = {
    id: "fold1",
    title: "Notes",
    parentObjectId: "co1",
    docKind: "standard",
    category: "",
    blocks: [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "hi" })],
  };

  it("detects dedicated QLoop docs and collects saved loops", () => {
    const docs = { loop1: loopDoc, fold1: folderDoc };
    expect(isDedicatedQLoopDoc(loopDoc)).toBe(true);
    expect(isDedicatedQLoopDoc(folderDoc)).toBe(false);

    const loops = collectSavedQLoops(docs, { objectId: "co1" });
    expect(loops).toHaveLength(1);
    expect(loops[0].docId).toBe("loop1");
    expect(loops[0].queryCount).toBe(2);
    expect(loops[0].preview).toContain("goal");
  });

  it("filters loops by title, preview, and description", () => {
    const loops = collectSavedQLoops({ loop1: loopDoc }, { objectId: "co1" });
    expect(filterQLoops(loops, "audience")).toHaveLength(1);
    expect(filterQLoops(loops, "hint")).toHaveLength(1);
    expect(filterQLoops(loops, "missing")).toHaveLength(0);
  });

  it("tracks used indexes and suggests the next slot", () => {
    const loops = collectSavedQLoops({ loop1: loopDoc }, { objectId: "co1" });
    const loop = loops[0];
    const blocks = [
      createDocBlock(DOC_BLOCK_TYPES.H1, {
        title: "What is the goal?",
        qloopSource: {
          loopId: loop.id,
          loopDocId: loop.docId,
          loopBlockId: loop.blockId,
          queryId: loop.queries[0].id,
          index: 1,
        },
      }),
    ];

    expect(collectUsedQLoopIndexesInDocBlocks(blocks, loop.id)).toEqual(new Set([1]));
    expect(suggestNextQLoopIndex(loop, blocks)).toBe(2);
  });

  it("removes a dedicated QLoop doc entirely", () => {
    const deleteDoc = vi.fn();
    const updateDoc = vi.fn();
    const loops = collectSavedQLoops({ loop1: loopDoc }, { objectId: "co1" });
    const result = removeQLoopFromDoc(loops[0], loopDoc, updateDoc, deleteDoc);
    expect(result.docRemoved).toBe(true);
    expect(deleteDoc).toHaveBeenCalledWith("loop1");
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
