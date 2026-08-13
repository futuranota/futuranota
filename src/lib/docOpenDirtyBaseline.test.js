import { describe, expect, it } from "vitest";
import {
  DOC_BLOCK_TYPES,
  createDocBlock,
  ensureWritableDocTail,
  normalizeDocBlock,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { ensureAllLinkedOwnerContinuationSlots } from "./docNodeSync.js";

function json(value) {
  return JSON.stringify(value);
}

describe("folder open dirty baseline", () => {
  it("normalizing an empty TODO is JSON-stable across calls", () => {
    const todo = {
      type: DOC_BLOCK_TYPES.TODO,
      id: "todo-1",
      listTitle: "Todo list:",
      nodeId: "n-1",
      queryEnabled: true,
    };
    const once = normalizeDocBlock(todo);
    const twice = normalizeDocBlock(once);
    expect(json(twice)).toBe(json(once));
    expect(json(normalizeDocBlocks([todo]))).toBe(json(normalizeDocBlocks([todo])));
  });

  it("continuation slots are JSON-idempotent after the first heal", () => {
    const h1 = createDocBlock(DOC_BLOCK_TYPES.H1, {
      id: "h1-a",
      title: "Alpha",
      nodeId: "n-a",
      queryEnabled: true,
    });
    const healed = ensureWritableDocTail(ensureAllLinkedOwnerContinuationSlots([h1]));
    const again = ensureWritableDocTail(ensureAllLinkedOwnerContinuationSlots(healed));
    expect(json(again)).toBe(json(healed));
  });

  it("createDocBlock keeps a stable id when patch.id is undefined", () => {
    const a = createDocBlock(DOC_BLOCK_TYPES.H1, { id: undefined, title: "A" });
    expect(a.id).toBeTruthy();
    const b = createDocBlock(DOC_BLOCK_TYPES.TEXT, { id: undefined, text: "hi" });
    expect(b.id).toBeTruthy();
  });
});
