import { describe, expect, it, vi } from "vitest";
import {
  createDocBlock,
  createQLoopEntry,
  DOC_BLOCK_TYPES,
  swapQLoopEntryTextAt,
} from "./docBlocks.js";
import { collectSavedQLoops } from "./qloopsLibrary.js";
import {
  createBlankQLoopSession,
  persistQLoopSession,
  qloopSessionFromRef,
  qloopSessionHasContent,
} from "./qloopSession.js";

describe("qloopSession", () => {
  it("creates blank sessions and detects content", () => {
    const blank = createBlankQLoopSession("co1");
    expect(blank.objectId).toBe("co1");
    expect(blank.saved).toBe(false);
    expect(qloopSessionHasContent(blank)).toBe(false);

    const withTitle = { ...blank, title: "Discovery" };
    expect(qloopSessionHasContent(withTitle)).toBe(true);

    const withQuery = {
      ...blank,
      queries: [createQLoopEntry({ index: 1, title: "Goal?" })],
    };
    expect(qloopSessionHasContent(withQuery)).toBe(true);
  });

  it("persists a new dedicated QLoop doc", () => {
    const session = createBlankQLoopSession("co1");
    session.title = "Onboarding questions";
    session.queries = [
      createQLoopEntry({ index: 1, title: "What changed?" }),
    ];

    const addDoc = vi.fn(() => "new-loop-doc");
    const updateDoc = vi.fn();
    const docs = {};
    const objects = { co1: { name: "Acme" } };

    const result = persistQLoopSession(session, {
      addDoc,
      updateDoc,
      docs,
      objects,
      defaultTitle: "QLoops",
    });

    expect(result.docId).toBe("new-loop-doc");
    expect(addDoc).toHaveBeenCalledTimes(1);
    const initialBlocks = addDoc.mock.calls[0][6];
    expect(initialBlocks).toHaveLength(1);
    expect(initialBlocks[0].type).toBe(DOC_BLOCK_TYPES.QLOOP_SEQUENCE);
    expect(initialBlocks[0].saved).toBe(true);
    expect(initialBlocks[0].queries[0].title).toBe("What changed?");
  });

  it("updates an existing loop from a library ref", () => {
    const loopDoc = {
      id: "loop1",
      title: "Discovery",
      parentObjectId: "co1",
      blocks: [createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
        id: "blk1",
        saved: true,
        title: "Discovery",
        queries: [createQLoopEntry({ index: 1, title: "Old" })],
      })],
    };
    const docs = { loop1: loopDoc };
    const loop = collectSavedQLoops(docs, { objectId: "co1" })[0];
    const session = qloopSessionFromRef(loop);
    session.queries = [createQLoopEntry({ id: loop.queries[0].id, index: 1, title: "New" })];

    const updateDoc = vi.fn();
    const result = persistQLoopSession(session, {
      addDoc: vi.fn(),
      updateDoc,
      docs,
      objects: {},
      defaultTitle: "QLoops",
    });

    expect(result.docId).toBe("loop1");
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const patch = updateDoc.mock.calls[0][1];
    expect(patch.blocks[0].queries[0].title).toBe("New");
    expect(patch.blocks[0].saved).toBe(true);
  });

  it("swapQLoopEntryTextAt moves text between fixed slots", () => {
    const a = createQLoopEntry({ id: "q1", index: 1, title: "First", description: "A" });
    const b = createQLoopEntry({ id: "q2", index: 2, title: "Second", description: "B" });
    const swapped = swapQLoopEntryTextAt([a, b], 0, 1);

    expect(swapped[0].id).toBe("q1");
    expect(swapped[0].index).toBe(1);
    expect(swapped[0].title).toBe("Second");
    expect(swapped[0].description).toBe("B");
    expect(swapped[1].id).toBe("q2");
    expect(swapped[1].index).toBe(2);
    expect(swapped[1].title).toBe("First");
    expect(swapped[1].description).toBe("A");
  });
});
