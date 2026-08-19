import { describe, expect, it } from "vitest";
import { createDocBlock, createStepEntry, DOC_BLOCK_TYPES } from "./docBlocks.js";
import {
  isDedicatedStepPlaybookDoc,
  listContentDocs,
  listUncategorizedDocs,
} from "./templateDoc.js";
import { collectSavedStepPlaybooks } from "./stepsLibrary.js";

describe("dedicated step playbook docs", () => {
  const playbook = {
    id: "play1",
    title: "How to filter",
    parentObjectId: "co1",
    docKind: "standard",
    category: "",
    blocks: [createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      saved: true,
      title: "How to filter",
      steps: [createStepEntry({ prompt: "hello", meta: "desc" })],
    })],
  };

  const folder = {
    id: "fold1",
    title: "Notes",
    parentObjectId: "co1",
    docKind: "standard",
    category: "",
    blocks: [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "hi" })],
  };

  it("detects a single step_sequence block as library-only", () => {
    expect(isDedicatedStepPlaybookDoc(playbook)).toBe(true);
    expect(isDedicatedStepPlaybookDoc(folder)).toBe(false);
  });

  it("stays out of Uncategorized and Content, still listed in Steps Library", () => {
    const docs = { play1: playbook, fold1: folder };
    expect(listUncategorizedDocs(docs, "co1").map((d) => d.id)).toEqual(["fold1"]);
    expect(listContentDocs(docs, "co1")).toEqual([]);
    expect(collectSavedStepPlaybooks(docs, { objectId: "co1" })).toHaveLength(1);
    expect(collectSavedStepPlaybooks(docs, { objectId: "co1" })[0].docId).toBe("play1");
  });
});
