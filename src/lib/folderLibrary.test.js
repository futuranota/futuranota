import { beforeEach, describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  createFolderLibraryItem,
  listFolderLibraryItems,
  normalizeFolderLibraryItem,
  normalizeFolderLibraryItems,
  removeFolderLibraryItem,
  updateFolderLibraryItem,
} from "./folderLibrary.js";
import { useDocsStore } from "../stores/docsStore.js";

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
