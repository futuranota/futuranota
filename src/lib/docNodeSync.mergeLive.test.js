import { describe, expect, it } from "vitest";
import { createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { mergeMissingLinkedOwnerBundlesLive, pruneLinkedBundlesMovedOutOfFolder } from "./docNodeSync.js";

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

describe("pruneLinkedBundlesMovedOutOfFolder", () => {
  it("removes bundles whose node moved to another folder", () => {
    const blocks = [
      linkedH1("doc-a", "Still here"),
      linkedH1("doc-b", "Moved away"),
    ];
    const nodesById = {
      "doc-a": { id: "doc-a", parentDocId: "folder-1" },
      "doc-b": { id: "doc-b", parentDocId: "folder-2" },
    };
    const pruned = pruneLinkedBundlesMovedOutOfFolder(blocks, nodesById, "folder-1");
    expect(pruned.some((b) => b.nodeId === "doc-a")).toBe(true);
    expect(pruned.some((b) => b.nodeId === "doc-b")).toBe(false);
  });

  it("keeps bundles that still belong to the open folder", () => {
    const blocks = [linkedH1("doc-a", "Still here")];
    const nodesById = { "doc-a": { id: "doc-a", parentDocId: "folder-1" } };
    const pruned = pruneLinkedBundlesMovedOutOfFolder(blocks, nodesById, "folder-1");
    expect(pruned).toHaveLength(1);
  });
});
