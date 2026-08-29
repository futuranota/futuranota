import { beforeEach, describe, expect, it } from "vitest";
import { normalizeDoc } from "./normalizeDoc.js";
import { createLibraryItem } from "./folderLibrary.js";
import { createEmptyTextBlock } from "./nodeInlineContent.js";
import {
  applyRetroactiveItemToWritingBlocks,
  applyRetroactiveRefsToTextBlock,
  buildRetroactiveCatalogForDocument,
  findLibraryItemMatches,
  findLibraryTagMatches,
  isRetroactivePromptItem,
  reconcileDocumentRetroactiveRefs,
} from "./retroactiveLibraryNameRefs.js";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";

function textBlock(text, refs) {
  return {
    ...createEmptyTextBlock(text),
    ...(refs?.length ? { libraryNameRefs: refs } : {}),
  };
}

describe("findLibraryTagMatches", () => {
  it("finds exact word matches case-insensitively", () => {
    expect(findLibraryTagMatches("casa y Casa otra vez casa", "casa")).toEqual([
      { start: 0, end: 4 },
      { start: 7, end: 11 },
      { start: 21, end: 25 },
    ]);
  });

  it("does not match inside longer words", () => {
    expect(findLibraryTagMatches("casamiento en la casa", "casa")).toEqual([
      { start: 17, end: 21 },
    ]);
  });

  it("skips system prefixes # @ / but allows soft punctuation", () => {
    expect(findLibraryTagMatches("#casa /casa @casa", "casa")).toEqual([]);
    expect(findLibraryTagMatches("ver casa", "casa")).toEqual([{ start: 4, end: 8 }]);
    expect(findLibraryTagMatches("--casa", "casa")).toEqual([{ start: 2, end: 6 }]);
    expect(findLibraryTagMatches("casa/", "casa")).toEqual([{ start: 0, end: 4 }]);
    expect(findLibraryTagMatches("casa.fold", "casa")).toEqual([{ start: 0, end: 4 }]);
    expect(findLibraryTagMatches("(Casa),", "casa")).toEqual([{ start: 1, end: 5 }]);
    expect(findLibraryTagMatches("--casa, or casa/", "casa")).toEqual([
      { start: 2, end: 6 },
      { start: 11, end: 15 },
    ]);
  });

  it("matches multi-word alias phrases", () => {
    expect(findLibraryTagMatches("mi hermana se fue", "mi hermana")).toEqual([
      { start: 0, end: 10 },
    ]);
  });
});

describe("findLibraryItemMatches", () => {
  it("links both canonical name and aliases", () => {
    const item = { tag: "Gina", aliases: ["mi hermana"] };
    const text = "Gina y mi hermana salieron";
    const matches = findLibraryItemMatches(text, item);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.phrase)).toEqual(["Gina", "mi hermana"]);
  });

  it("prefers longer alias over shorter overlapping word", () => {
    const item = { tag: "Gina", aliases: ["hermana", "mi hermana"] };
    const matches = findLibraryItemMatches("vi a mi hermana", item);
    expect(matches).toHaveLength(1);
    expect(matches[0].phrase).toBe("mi hermana");
  });
});

describe("applyRetroactiveRefsToTextBlock", () => {
  const item = { id: "img1", tag: "casa", setId: null };

  it("creates five refs when loop is on", () => {
    const text = "casa casa casa casa casa";
    const result = applyRetroactiveRefsToTextBlock(text, [], item, { loops: true });
    expect(result.libraryNameRefs).toHaveLength(5);
    expect(result.libraryNameRefs.every((ref) => ref.itemId === "img1")).toBe(true);
  });

  it("creates one ref when loop is off", () => {
    const text = "casa casa casa casa casa";
    const result = applyRetroactiveRefsToTextBlock(text, [], item, { loops: false });
    expect(result.libraryNameRefs).toHaveLength(1);
    expect(result.libraryNameRefs[0].start).toBe(0);
  });

  it("replaces prior refs for the same itemId", () => {
    const text = "casa casa";
    const old = [{
      id: "LNR-old",
      itemId: "img1",
      tag: "casa",
      setId: null,
      start: 5,
      end: 9,
      insertedAt: "2020-01-01T00:00:00.000Z",
    }];
    const result = applyRetroactiveRefsToTextBlock(text, old, item, { loops: false });
    expect(result.libraryNameRefs).toHaveLength(1);
    expect(result.libraryNameRefs[0].start).toBe(0);
  });

  it("paints alias phrases under the same itemId", () => {
    const gina = { id: "img-gina", tag: "Gina", aliases: ["mi hermana"], setId: null };
    const text = "mi hermana se fue y Gina tambien";
    const result = applyRetroactiveRefsToTextBlock(text, [], gina, { loops: true });
    expect(result.libraryNameRefs).toHaveLength(2);
    expect(result.libraryNameRefs.map((r) => r.tag)).toEqual(["mi hermana", "Gina"]);
    expect(result.libraryNameRefs.every((r) => r.itemId === "img-gina")).toBe(true);
  });
});

describe("applyRetroactiveItemToWritingBlocks", () => {
  const item = { id: "img1", tag: "casa", category: "image", loop: true };

  it("places first match in block 2 when block 1 has no match and loop is off", () => {
    const blocks = [
      textBlock("sin match"),
      textBlock("casa aqui casa"),
    ];
    const noLoopItem = { ...item, loop: false };
    const result = applyRetroactiveItemToWritingBlocks(blocks, noLoopItem, "document");
    expect(result.changed).toBe(true);
    expect(result.blocks[0].libraryNameRefs).toBeUndefined();
    expect(result.blocks[1].libraryNameRefs).toHaveLength(1);
    expect(result.blocks[1].libraryNameRefs[0].start).toBe(0);
  });

  it("links all matches across blocks when loop is on", () => {
    const blocks = [
      textBlock("casa uno"),
      textBlock("casa dos"),
    ];
    const result = applyRetroactiveItemToWritingBlocks(blocks, item, "document");
    expect(result.blocks[0].libraryNameRefs).toHaveLength(1);
    expect(result.blocks[1].libraryNameRefs).toHaveLength(1);
  });
});

describe("buildRetroactiveCatalogForDocument", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Folder",
          nodeIds: ["node1"],
          libraryItems: [{
            id: "F1",
            tag: "folder_casa",
            category: "image",
            loop: true,
          }],
        }),
      },
    });
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          dataType: "text",
          parentDocId: "folder1",
          libraryItems: [{
            id: "D1",
            tag: "casa",
            category: "image",
            loop: false,
          }],
        },
      },
    });
  });

  it("prefers document entry over folder for the same tag key", () => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Folder",
          nodeIds: ["node1"],
          libraryItems: [{
            id: "F1",
            tag: "casa",
            category: "image",
            loop: true,
          }],
        }),
      },
    });

    const catalog = buildRetroactiveCatalogForDocument("node1", "folder1");
    expect(catalog).toHaveLength(1);
    expect(catalog[0].item.id).toBe("D1");
    expect(catalog[0].ownerKind).toBe("document");
  });
});

describe("reconcileDocumentRetroactiveRefs", () => {
  beforeEach(() => {
    useDocsStore.setState({
      docs: {
        folder1: normalizeDoc({
          id: "folder1",
          title: "Folder",
          nodeIds: ["node1"],
          libraryItems: [],
        }),
      },
    });
    useNodesStore.setState({
      nodes: {
        node1: {
          id: "node1",
          dataType: "text",
          parentDocId: "folder1",
          libraryItems: [],
        },
      },
    });
  });

  it("is idempotent on a second pass", () => {
    createLibraryItem("document", "node1", {
      tag: "andes",
      category: "image",
      loop: true,
    });
    const blocks = [textBlock("andes y andes")];

    const first = reconcileDocumentRetroactiveRefs(blocks, "node1", "folder1");
    expect(first.changed).toBe(true);
    expect(first.blocks[0].libraryNameRefs).toHaveLength(2);

    const second = reconcileDocumentRetroactiveRefs(first.blocks, "node1", "folder1");
    expect(second.changed).toBe(false);
    expect(second.blocks[0].libraryNameRefs).toHaveLength(2);
  });
});

describe("isRetroactivePromptItem", () => {
  it("accepts loose image/auto prompts only", () => {
    expect(isRetroactivePromptItem({ tag: "a", category: "image" })).toBe(true);
    expect(isRetroactivePromptItem({ tag: "a", category: "auto" })).toBe(true);
    expect(isRetroactivePromptItem({ tag: "a", category: "image", setId: "SET1" })).toBe(false);
    expect(isRetroactivePromptItem({ tag: "a", category: "skill" })).toBe(false);
  });
});
