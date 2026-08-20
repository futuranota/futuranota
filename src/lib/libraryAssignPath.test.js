import { describe, expect, it } from "vitest";
import {
  filterAssignByTag,
  getLibraryAssignPathAtCaret,
  isLibraryAssignPromptFile,
  libraryAssignMenuEmptyReason,
  listLibraryAssignMenuItems,
  mergeAssignFiles,
  replaceLibraryAssignPathToken,
  shouldCloneLibraryAssign,
} from "./libraryAssignPath.js";

const files = [
  { id: "f1", tag: "recordatorio", description: "note" },
  { id: "f2", tag: "hero" },
];
const assets = [
  { id: "a1", tag: "scene01" },
  { id: "a2", tag: "scene02" },
];

describe("libraryAssignPath", () => {
  it("reads a file prefix and a dotted path at the caret", () => {
    expect(getLibraryAssignPathAtCaret("recordatorio", 12)).toMatchObject({
      fileQuery: "recordatorio",
      hasDot: false,
    });
    expect(getLibraryAssignPathAtCaret("recordatorio.scene0", 19)).toMatchObject({
      fileQuery: "recordatorio",
      assetQuery: "scene0",
      hasDot: true,
    });
    expect(getLibraryAssignPathAtCaret("x recordatorio.sc", 17)?.fileQuery).toBe("recordatorio");
  });

  it("ignores # / @ / slash tokens", () => {
    expect(getLibraryAssignPathAtCaret("#recordatorio", 13)).toBeNull();
    expect(getLibraryAssignPathAtCaret("/recordatorio", 13)).toBeNull();
  });

  it("lists files then file.asset rows", () => {
    const fileQ = getLibraryAssignPathAtCaret("reco", 4);
    expect(listLibraryAssignMenuItems(fileQ, files, assets).map((row) => row.tag)).toEqual([
      "recordatorio",
    ]);
    const pathQ = getLibraryAssignPathAtCaret("recordatorio.sc", 15);
    expect(listLibraryAssignMenuItems(pathQ, files, assets).map((row) => row.tag)).toEqual([
      "scene01",
      "scene02",
    ]);
  });

  it("offers speak beside assets when typing tag.s", () => {
    const ginaFiles = [{ id: "g1", tag: "Gina", description: "assistant" }];
    const pathQ = getLibraryAssignPathAtCaret("Gina.s", 6);
    expect(listLibraryAssignMenuItems(pathQ, ginaFiles, assets).map((row) => row.tag)).toEqual([
      "speak",
      "scene01",
      "scene02",
    ]);
    expect(listLibraryAssignMenuItems(pathQ, ginaFiles, assets)[0]?.kind).toBe("speak");
  });

  it("prefers document files over folder duplicates", () => {
    const merged = mergeAssignFiles(
      [{ id: "d1", tag: "recordatorio" }],
      [{ id: "f1", tag: "recordatorio" }, { id: "f2", tag: "other" }],
    );
    expect(merged.map((item) => item.id)).toEqual(["d1", "f2"]);
  });

  it("filters by prefix", () => {
    expect(filterAssignByTag(assets, "scene0").map((item) => item.tag)).toEqual([
      "scene01",
      "scene02",
    ]);
  });

  it("lists every asset when the asset query is empty", () => {
    const pathQ = getLibraryAssignPathAtCaret("recordatorio.", 13);
    expect(listLibraryAssignMenuItems(pathQ, files, assets).map((row) => row.tag)).toEqual([
      "speak",
      "scene01",
      "scene02",
    ]);
  });

  it("replaces the live token", () => {
    const path = getLibraryAssignPathAtCaret("go recordatorio.sc", 18);
    const next = replaceLibraryAssignPathToken("go recordatorio.sc", path, "recordatorio.scene01");
    expect(next.text).toBe("go recordatorio.scene01");
    expect(next.caret).toBe("go recordatorio.scene01".length);
  });

  it("clones folder and looped document files; moves the rest", () => {
    expect(shouldCloneLibraryAssign({ sourceKind: "folder" })).toBe(true);
    expect(shouldCloneLibraryAssign({ sourceKind: "document", loop: true })).toBe(true);
    expect(shouldCloneLibraryAssign({ sourceKind: "document", loop: false })).toBe(false);
  });

  it("resolves spaced names when files are passed", () => {
    const spaced = [{ id: "f3", tag: "Art in Life" }];
    const text = "Art in Life.scene";
    expect(getLibraryAssignPathAtCaret(text, text.length, spaced)).toMatchObject({
      fileQuery: "Art in Life",
      assetQuery: "scene",
      hasDot: true,
    });
    expect(getLibraryAssignPathAtCaret(text, text.length)?.fileQuery).toBe("Life");
    const dotted = getLibraryAssignPathAtCaret("Art in Life.", 12, spaced);
    expect(listLibraryAssignMenuItems(dotted, spaced, assets).map((row) => row.tag)).toEqual([
      "speak",
      "scene01",
      "scene02",
    ]);
  });

  it("lists matching prompt names when the dotted prefix is not unique", () => {
    const prefixFiles = [
      { id: "a", tag: "recordatorio" },
      { id: "b", tag: "recuerdo" },
    ];
    const pathQ = getLibraryAssignPathAtCaret("rec.", 4);
    expect(listLibraryAssignMenuItems(pathQ, prefixFiles, assets).map((row) => row.kind)).toEqual([
      "file",
      "file",
    ]);
    expect(listLibraryAssignMenuItems(pathQ, prefixFiles, assets).map((row) => row.tag)).toEqual([
      "recordatorio",
      "recuerdo",
    ]);
    expect(libraryAssignMenuEmptyReason(pathQ, prefixFiles, assets)).toBeNull();
  });

  it("still offers speak when the file is unique but there are no assets", () => {
    const pathQ = getLibraryAssignPathAtCaret("recordatorio.", 13);
    expect(listLibraryAssignMenuItems(pathQ, files, [])).toMatchObject([
      { kind: "speak", tag: "speak" },
    ]);
    expect(libraryAssignMenuEmptyReason(pathQ, files, [])).toBeNull();
  });

  it("returns noFile when the name matches nothing", () => {
    const pathQ = getLibraryAssignPathAtCaret("zzzz.", 5);
    expect(listLibraryAssignMenuItems(pathQ, files, assets)).toEqual([]);
    expect(libraryAssignMenuEmptyReason(pathQ, files, assets)).toBe("noFile");
  });

  it("returns noAssetMatch when the unique file has assets but the query misses", () => {
    const pathQ = getLibraryAssignPathAtCaret("recordatorio.zzz", 16);
    expect(listLibraryAssignMenuItems(pathQ, files, assets)).toEqual([]);
    expect(libraryAssignMenuEmptyReason(pathQ, files, assets)).toBe("noAssetMatch");
  });

  it("keeps a spaced asset query after a known prompt name", () => {
    const dest = [{ id: "a3", tag: "scene 01" }];
    const text = "recordatorio.scene 01";
    expect(getLibraryAssignPathAtCaret(text, text.length, files)).toMatchObject({
      fileQuery: "recordatorio",
      assetQuery: "scene 01",
      hasDot: true,
    });
    expect(listLibraryAssignMenuItems(
      getLibraryAssignPathAtCaret(text, text.length, files),
      files,
      dest,
    ).map((row) => row.tag)).toEqual(["scene 01"]);
    expect(getLibraryAssignPathAtCaret("Hello. World", 12, files)?.hasDot).toBeFalsy();
  });

  it("keeps only loose image and auto prompts", () => {
    expect(isLibraryAssignPromptFile({ category: "image", tag: "a" })).toBe(true);
    expect(isLibraryAssignPromptFile({ category: "auto", tag: "a" })).toBe(true);
    expect(isLibraryAssignPromptFile({ category: "image", setId: "s1", tag: "a" })).toBe(false);
    expect(isLibraryAssignPromptFile({ category: "pdf", tag: "a" })).toBe(false);
  });
});
