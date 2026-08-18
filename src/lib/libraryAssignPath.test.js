import { describe, expect, it } from "vitest";
import {
  filterAssignByTag,
  getLibraryAssignPathAtCaret,
  listLibraryAssignMenuItems,
  mergeAssignFiles,
  replaceLibraryAssignPathToken,
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
      "recordatorio.scene01",
      "recordatorio.scene02",
    ]);
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
      "recordatorio.scene01",
      "recordatorio.scene02",
    ]);
  });

  it("replaces the live token", () => {
    const path = getLibraryAssignPathAtCaret("go recordatorio.sc", 18);
    const next = replaceLibraryAssignPathToken("go recordatorio.sc", path, "recordatorio.scene01");
    expect(next.text).toBe("go recordatorio.scene01");
    expect(next.caret).toBe("go recordatorio.scene01".length);
  });
});
