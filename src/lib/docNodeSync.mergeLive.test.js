import { describe, expect, it } from "vitest";
import { createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { mergeMissingLinkedOwnerBundlesLive } from "./docNodeSync.js";

function linkedH1(nodeId, title) {
  return createDocBlock(DOC_BLOCK_TYPES.H1, {
    title,
    nodeId,
    queryEnabled: true,
    nodeLinkColor: "mint",
  });
}

describe("mergeMissingLinkedOwnerBundlesLive", () => {
  it("does not remarge store owners when the node is gone", () => {
    const draft = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
    const store = [linkedH1("ideas-1", "Ideas")];
    const merged = mergeMissingLinkedOwnerBundlesLive(draft, store, {}, () => false);
    expect(merged.some((b) => b.nodeId === "ideas-1")).toBe(false);
  });

  it("does not remarge tombstoned node ids even if still in live map", () => {
    const draft = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
    const store = [linkedH1("ideas-1", "Ideas")];
    const live = { "ideas-1": { id: "ideas-1", title: "Ideas" } };
    const merged = mergeMissingLinkedOwnerBundlesLive(
      draft,
      store,
      live,
      (id) => id === "ideas-1",
    );
    expect(merged.some((b) => b.nodeId === "ideas-1")).toBe(false);
  });

  it("strips ghost linked bundles from a stale draft", () => {
    const draft = [
      linkedH1("ideas-1", "Ideas"),
      createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" }),
    ];
    const store = [linkedH1("ideas-1", "Ideas")];
    const merged = mergeMissingLinkedOwnerBundlesLive(draft, store, {}, () => false);
    expect(merged.some((b) => b.nodeId === "ideas-1")).toBe(false);
  });

  it("still appends live missing owners from store", () => {
    const draft = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
    const store = [linkedH1("live-1", "Live doc")];
    const live = { "live-1": { id: "live-1", title: "Live doc" } };
    const merged = mergeMissingLinkedOwnerBundlesLive(draft, store, live, () => false);
    expect(merged.some((b) => b.nodeId === "live-1")).toBe(true);
  });
});
