import { describe, expect, it } from "vitest";
import {
  createDocBlock,
  createQLoopEntry,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  docPersistedContentCharCount,
  resolveDocBlocks,
} from "./docBlocks.js";
import { mergeEntityMapsPreferNewer } from "./mergeEntityMapsPreferNewer.js";

describe("resolveDocBlocks", () => {
  it("falls back to body markers when blocks[] is empty", () => {
    const block = createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
      id: "BLK-1",
      saved: true,
      title: "How to Prompt?",
      queries: [createQLoopEntry({ index: 1, title: "Example" })],
    });
    const body = docBlocksToBody([block]);
    const resolved = resolveDocBlocks({ blocks: [], body });
    expect(resolved).toHaveLength(1);
    expect(resolved[0].type).toBe(DOC_BLOCK_TYPES.QLOOP_SEQUENCE);
    expect(resolved[0].id).toBe("BLK-1");
    expect(resolved[0].title).toBe("How to Prompt?");
  });
});

describe("docPersistedContentCharCount", () => {
  it("counts qloop query descriptions for merge richness", () => {
    const thin = {
      title: "QLoops",
      body: "",
      blocks: [createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
        saved: true,
        title: "Old",
        queries: [createQLoopEntry({ index: 1, title: "x" })],
      })],
    };
    const rich = {
      title: "How to Prompt?",
      body: "",
      blocks: [createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
        saved: true,
        title: "How to Prompt?",
        queries: [createQLoopEntry({
          index: 1,
          title: "Bad prompt",
          description: "A much longer description with detailed guidance for the user.",
        })],
      })],
    };
    expect(docPersistedContentCharCount(rich)).toBeGreaterThan(docPersistedContentCharCount(thin));
  });

  it("prefers richer local qloop doc when remote stub is newer", () => {
    const remote = {
      id: "DOC-1",
      title: "Testing",
      updatedAt: "2026-08-30T18:00:00.000Z",
      blocks: [createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
        saved: true,
        title: "Testing",
        queries: [createQLoopEntry({ index: 1, title: "old" })],
      })],
    };
    const local = {
      id: "DOC-1",
      title: "How to Prompt?",
      updatedAt: "2026-08-30T17:00:00.000Z",
      blocks: [createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
        saved: true,
        title: "How to Prompt?",
        queries: [createQLoopEntry({
          index: 1,
          title: "Good prompt",
          description: "Detailed marketing strategy guidance with multiple bullet points.",
        })],
      })],
    };
    const merged = mergeEntityMapsPreferNewer(
      { "DOC-1": remote },
      { "DOC-1": local },
      docPersistedContentCharCount,
      { preferRicherContent: true, lastSyncedAt: "2026-08-30T19:00:00.000Z" },
    );
    expect(merged["DOC-1"]).toBe(local);
  });
});
