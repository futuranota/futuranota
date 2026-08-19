import { beforeEach, describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  addPromptClass,
  assignLibraryItemToSet,
  cloneLibraryItemIntoSet,
  createFolderLibraryItem,
  createLibraryItem,
  createLibrarySet,
  listDocumentLibraryGroups,
  listFolderLibraryItems,
  listLibraryItems,
  listLibrarySetItems,
  listLibrarySets,
  listLooseLibraryItems,
  listPromptClasses,
  removePromptClass,
  normalizeFolderLibraryItem,
  PROMPT_CLASS_AMBIENTE,
  isPromptClassAmbiente,
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
    expect(item?.loop).toBe(false);
    expect(item?.promptClass).toBeNull();
  });

  it("normalizes loop and promptClass", () => {
    const item = normalizeFolderLibraryItem({
      id: "x",
      tag: "barrio",
      category: "image",
      loop: true,
      promptClass: "characters",
    });
    expect(item?.loop).toBe(true);
    expect(item?.promptClass).toBe("characters");
  });

  it("migrates legacy imageRole into promptClass", () => {
    const item = normalizeFolderLibraryItem({
      id: "x",
      tag: "plaza",
      category: "image",
      imageRole: "location",
    });
    expect(item?.promptClass).toBe("location");
    expect(item?.imageRole).toBeUndefined();
  });

  it("recognizes the built-in ambiente class", () => {
    expect(isPromptClassAmbiente("Ambiente")).toBe(true);
    expect(isPromptClassAmbiente("characters")).toBe(false);
    const item = normalizeFolderLibraryItem({
      id: "x",
      tag: "park",
      category: "image",
      promptClass: PROMPT_CLASS_AMBIENTE,
    });
    expect(item?.promptClass).toBe("ambiente");
  });

  it("normalizeDoc always includes libraryItems and promptClasses", () => {
    const doc = normalizeDoc({ id: "f1", title: "Folder" });
    expect(Array.isArray(doc.libraryItems)).toBe(true);
    expect(doc.libraryItems).toEqual([]);
    expect(doc.promptClasses).toEqual([]);
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

  it("folder create defaults loop on and keeps promptClass", () => {
    const created = createFolderLibraryItem("folder1", {
      tag: "hero",
      category: "image",
      promptClass: "characters",
    });
    expect(created?.loop).toBe(true);
    expect(created?.promptClass).toBe("characters");
  });

  it("folder create honors explicit loop off", () => {
    const created = createFolderLibraryItem("folder1", {
      tag: "once",
      category: "image",
      loop: false,
    });
    expect(created?.loop).toBe(false);
    const updated = updateFolderLibraryItem("folder1", created.id, { loop: true });
    expect(updated?.loop).toBe(true);
  });

  it("folder can still create attachments", () => {
    const created = createFolderLibraryItem("folder1", {
      tag: "brief_zip",
      category: "skill",
    });
    expect(created?.category).toBe("skill");
    expect(listFolderLibraryItems("folder1")).toHaveLength(1);
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
      category: "image",
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

  it("rejects skill create on a document", () => {
    expect(createLibraryItem("document", "node1", {
      tag: "brief_pdf",
      category: "skill",
    })).toBeNull();
    expect(listLibraryItems("document", "node1")).toHaveLength(0);
  });

  it("does not list a document group that only has leftover attachments", () => {
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          title: "Brief",
          sourceQuery: "Launch brief",
          parentDocId: "folder1",
          libraryItems: [
            {
              id: "LIBSKILL",
              tag: "old_zip",
              category: "skill",
              description: "",
              mediaUrl: null,
              mediaKind: null,
              attachmentUrl: "https://example.com/a.zip",
              attachmentName: "a.zip",
              attachmentKind: "zip",
              wallColor: null,
              setId: null,
              loop: false,
              promptClass: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          librarySets: [],
        },
      },
    });
    expect(listDocumentLibraryGroups("folder1")).toEqual([]);
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

  it("clones a ficha into a set without moving the source", () => {
    const set = createLibrarySet("document", "node1", { tag: "orlando" });
    const source = createLibraryItem("document", "node1", {
      tag: "wardrobe",
      category: "image",
      description: "Same clothes",
    });
    const cloned = cloneLibraryItemIntoSet("node1", source, set.id);
    expect(cloned?.id).not.toBe(source.id);
    expect(cloned?.tag).toBe("wardrobe");
    expect(cloned?.setId).toBe(set.id);
    expect(listLibraryItems("document", "node1")).toHaveLength(2);
    expect(listLibraryItems("document", "node1").find((item) => item.id === source.id)?.setId).toBeNull();
    expect(listLibrarySetItems("document", "node1", set.id)).toHaveLength(1);
    expect(cloned?.loop).toBe(false);
    expect(cloned?.promptClass).toBeNull();
  });

  it("clones promptClass with the ficha", () => {
    const set = createLibrarySet("document", "node1", { tag: "orlando" });
    const source = createLibraryItem("document", "node1", {
      tag: "wardrobe",
      category: "image",
      promptClass: "element",
    });
    const cloned = cloneLibraryItemIntoSet("node1", source, set.id);
    expect(cloned?.promptClass).toBe("element");
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

describe("prompt classes", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Project",
          nodeIds: ["node1"],
          libraryItems: [],
          promptClasses: [],
        }),
      },
    });
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          title: "Brief",
          parentDocId: "folder1",
          libraryItems: [],
          librarySets: [],
          promptClasses: [],
        },
      },
    });
  });

  it("adds a class and lists stored plus used names", () => {
    expect(addPromptClass("folder", "folder1", " Characters ")).toBe("Characters");
    expect(addPromptClass("folder", "folder1", "characters")).toBe("Characters");
    createFolderLibraryItem("folder1", {
      tag: "lamp",
      category: "image",
      promptClass: "element",
    });
    expect(listPromptClasses("folder", "folder1")).toEqual(["Characters", "element"]);
  });

  it("stores classes on the document owner", () => {
    expect(addPromptClass("document", "node1", "wardrobe")).toBe("wardrobe");
    expect(listPromptClasses("document", "node1")).toEqual(["wardrobe"]);
    expect(listPromptClasses("folder", "folder1")).toEqual([]);
  });

  it("removes a class and clears it from fichas", () => {
    addPromptClass("folder", "folder1", "location");
    const item = createFolderLibraryItem("folder1", {
      tag: "set",
      category: "image",
      promptClass: "location",
    });
    expect(removePromptClass("folder", "folder1", "location")).toBe(true);
    expect(listPromptClasses("folder", "folder1")).toEqual([]);
    expect(listFolderLibraryItems("folder1").find((entry) => entry.id === item.id)?.promptClass).toBeNull();
  });
});
