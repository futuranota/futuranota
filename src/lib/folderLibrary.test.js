import { beforeEach, describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  assignLibraryItemToSet,
  createFolderLibraryItem,
  createLibraryItem,
  createLibrarySet,
  listDocumentLibraryGroups,
  listFolderLibraryItems,
  listLibraryItems,
  listLibrarySetItems,
  listLibrarySets,
  listLooseLibraryItems,
  normalizeFolderLibraryItem,
  normalizeFolderLibraryItems,
  normalizeFolderLibraryFilterTab,
  normalizeLibraryOwnerKind,
  normalizeLibrarySets,
  removeFolderLibraryItem,
  removeLibraryItem,
  removeLibrarySet,
  updateFolderLibraryItem,
  updateLibraryItem,
} from "./folderLibrary.js";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";

describe("folderLibrary normalize", () => {
  it("drops invalid entries and keeps a valid ficha", () => {
    const items = normalizeFolderLibraryItems([
      null,
      { id: "LIB1", tag: "car_sheet", description: "Hero car", category: "image" },
      { id: "LIB1", tag: "dup", description: "skip" },
      { tag: "no-id" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].tag).toBe("car_sheet");
    expect(items[0].category).toBe("image");
  });

  it("normalizeFolderLibraryItem defaults category to auto", () => {
    const item = normalizeFolderLibraryItem({
      id: "x",
      tag: "hero",
      category: "weird",
    });
    expect(item?.category).toBe("auto");
    expect(item?.mediaUrl).toBeNull();
  });

  it("normalizeDoc always includes libraryItems array", () => {
    const doc = normalizeDoc({ id: "f1", title: "Folder" });
    expect(Array.isArray(doc.libraryItems)).toBe(true);
    expect(doc.libraryItems).toEqual([]);
  });

  it("normalizeDoc preserves libraryItems", () => {
    const doc = normalizeDoc({
      id: "f2",
      libraryItems: [
        {
          id: "LIB9",
          tag: "card",
          description: "Product card",
          category: "auto",
          mediaUrl: null,
          mediaKind: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(doc.libraryItems).toHaveLength(1);
    expect(doc.libraryItems[0].tag).toBe("card");
  });
  it("preserves skill attachment fields", () => {
    const item = normalizeFolderLibraryItem({
      id: "s1",
      tag: "writer_skill",
      category: "skill",
      description: "Drafts posts",
      attachmentUrl: "https://example.com/a.zip",
      attachmentName: "writer.zip",
      attachmentKind: "zip",
    });
    expect(item?.attachmentUrl).toContain("a.zip");
    expect(item?.attachmentKind).toBe("zip");
  });

  it("normalizes wallColor hex", () => {
    const item = normalizeFolderLibraryItem({
      id: "w1",
      tag: "poster",
      category: "image",
      wallColor: "#abC",
    });
    expect(item?.wallColor).toBe("#AABBCC");
  });

  it("defaults setId to null and keeps a valid setId", () => {
    const loose = normalizeFolderLibraryItem({ id: "a", tag: "loose" });
    expect(loose?.setId).toBeNull();
    const packed = normalizeFolderLibraryItem({
      id: "b",
      tag: "packed",
      setId: " SET-1 ",
    });
    expect(packed?.setId).toBe("SET-1");
  });

  it("normalizeLibrarySets drops invalid entries", () => {
    const sets = normalizeLibrarySets([
      null,
      { id: "SET1", tag: "pack_a", description: "Story" },
      { id: "SET1", tag: "dup" },
      { tag: "no-id" },
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].tag).toBe("pack_a");
    expect(sets[0].description).toBe("Story");
  });

  it("normalizeFolderLibraryFilterTab maps documents and legacy all to image", () => {
    expect(normalizeFolderLibraryFilterTab("documents")).toBe("documents");
    expect(normalizeFolderLibraryFilterTab("docs")).toBe("documents");
    expect(normalizeFolderLibraryFilterTab("image")).toBe("image");
    expect(normalizeFolderLibraryFilterTab("all")).toBe("image");
    expect(normalizeFolderLibraryFilterTab("video")).toBe("image");
  });
});

describe("folderLibrary CRUD", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Project",
          libraryItems: [],
        }),
      },
    });
  });

  it("creates, updates, lists, and removes items", () => {
    const created = createFolderLibraryItem("folder1", {
      tag: "car_sheet",
      description: "Side view",
      category: "image",
    });
    expect(created?.id).toMatch(/^LIB/);
    expect(listFolderLibraryItems("folder1")).toHaveLength(1);

    const updated = updateFolderLibraryItem("folder1", created.id, {
      description: "Updated",
      mediaUrl: "https://example.com/a.webp",
    });
    expect(updated?.description).toBe("Updated");
    expect(updated?.mediaKind).toBe("image");

    expect(removeFolderLibraryItem("folder1", created.id)).toBe(true);
    expect(listFolderLibraryItems("folder1")).toHaveLength(0);
  });

  it("rejects create without tag", () => {
    expect(createFolderLibraryItem("folder1", { tag: "  " })).toBeNull();
    expect(listFolderLibraryItems("folder1")).toHaveLength(0);
  });
});

describe("document library CRUD", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Project",
          nodeIds: ["node1", "node2"],
          libraryItems: [],
        }),
      },
    });
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          title: "Brief",
          sourceQuery: "Launch brief",
          parentDocId: "folder1",
          libraryItems: [],
          librarySets: [],
        },
        node2: {
          id: "node2",
          title: "Notes",
          parentDocId: "folder1",
          libraryItems: [],
          librarySets: [],
        },
      },
    });
  });

  it("normalizes ownerKind", () => {
    expect(normalizeLibraryOwnerKind("document")).toBe("document");
    expect(normalizeLibraryOwnerKind("folder")).toBe("folder");
    expect(normalizeLibraryOwnerKind("")).toBe("folder");
  });

  it("creates, updates, lists, and removes items on a node", () => {
    const created = createLibraryItem("document", "node1", {
      tag: "hero_shot",
      description: "Cover",
      category: "image",
    });
    expect(created?.id).toMatch(/^LIB/);
    expect(listLibraryItems("document", "node1")).toHaveLength(1);
    expect(listFolderLibraryItems("folder1")).toHaveLength(0);

    const updated = updateLibraryItem("document", "node1", created.id, {
      description: "Updated cover",
    });
    expect(updated?.description).toBe("Updated cover");

    expect(removeLibraryItem("document", "node1", created.id)).toBe(true);
    expect(listLibraryItems("document", "node1")).toHaveLength(0);
  });

  it("lists document groups only when a doc has fichas", () => {
    expect(listDocumentLibraryGroups("folder1")).toEqual([]);

    createLibraryItem("document", "node1", {
      tag: "script_v1",
      category: "skill",
    });
    const groups = listDocumentLibraryGroups("folder1");
    expect(groups).toHaveLength(1);
    expect(groups[0].documentId).toBe("node1");
    expect(groups[0].title).toBe("Launch brief");
    expect(groups[0].items).toHaveLength(1);
  });

  it("does not mix folder fichas into document groups", () => {
    createFolderLibraryItem("folder1", { tag: "shared_sheet", category: "image" });
    expect(listDocumentLibraryGroups("folder1")).toEqual([]);
    expect(listFolderLibraryItems("folder1")).toHaveLength(1);
  });
});

describe("document library sets", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Project",
          nodeIds: ["node1"],
          libraryItems: [],
        }),
      },
    });
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          title: "Brief",
          sourceQuery: "Launch brief",
          parentDocId: "folder1",
          libraryItems: [],
          librarySets: [],
        },
      },
    });
  });

  it("creates, lists, and does not store sets on folders", () => {
    const created = createLibrarySet("document", "node1", {
      tag: "hero_pack",
      description: "Launch stills",
    });
    expect(created?.id).toMatch(/^SET/);
    expect(created?.tag).toBe("hero_pack");
    expect(listLibrarySets("document", "node1")).toHaveLength(1);
    expect(createLibrarySet("folder", "folder1", { tag: "nope" })).toBeNull();
    expect(listLibrarySets("folder", "folder1")).toEqual([]);
  });

  it("rejects create without a name", () => {
    expect(createLibrarySet("document", "node1", { tag: "  " })).toBeNull();
    expect(listLibrarySets("document", "node1")).toHaveLength(0);
  });

  it("assigns a loose ficha into a set and lists it there", () => {
    const set = createLibrarySet("document", "node1", { tag: "pack" });
    const item = createLibraryItem("document", "node1", {
      tag: "hero_shot",
      category: "image",
    });
    expect(item?.setId).toBeNull();
    expect(listLooseLibraryItems("document", "node1")).toHaveLength(1);

    const assigned = assignLibraryItemToSet("document", "node1", item.id, set.id);
    expect(assigned?.setId).toBe(set.id);
    expect(listLibrarySetItems("document", "node1", set.id)).toHaveLength(1);
    expect(listLooseLibraryItems("document", "node1")).toHaveLength(0);

    const loosened = assignLibraryItemToSet("document", "node1", item.id, null);
    expect(loosened?.setId).toBeNull();
    expect(listLooseLibraryItems("document", "node1")).toHaveLength(1);
  });

  it("does not assign to a missing set", () => {
    const item = createLibraryItem("document", "node1", { tag: "hero_shot", category: "image" });
    expect(assignLibraryItemToSet("document", "node1", item.id, "SET-missing")).toBeNull();
    expect(listLibraryItems("document", "node1")[0].setId).toBeNull();
  });

  it("unassigns fichas when a set is removed", () => {
    const set = createLibrarySet("document", "node1", { tag: "pack" });
    const item = createLibraryItem("document", "node1", { tag: "hero_shot", category: "image" });
    assignLibraryItemToSet("document", "node1", item.id, set.id);
    expect(removeLibrarySet("document", "node1", set.id)).toBe(true);
    expect(listLibrarySets("document", "node1")).toEqual([]);
    expect(listLibraryItems("document", "node1")[0].setId).toBeNull();
  });
});
