import { describe, expect, it } from "vitest";
import {
  applyTextEditToLibraryNameRefs,
  filterLibraryNameCandidates,
  getLibraryNameQueryAtCaret,
  insertLibraryNameRefAtQuery,
  normalizeLibraryNameRefs,
} from "./docLibraryNameRefs.js";

const andes = { id: "img1", tag: "Andes", setId: "set-a" };

describe("library name invoke", () => {
  it("opens a word-prefix query after whitespace", () => {
    const q = getLibraryNameQueryAtCaret("and", 3);
    expect(q).toEqual({ start: 0, end: 3, query: "and" });
    expect(getLibraryNameQueryAtCaret("x and", 5)?.query).toBe("and");
  });

  it("ignores #i / @ / slash tokens and dots", () => {
    expect(getLibraryNameQueryAtCaret("#i", 2)).toBeNull();
    expect(getLibraryNameQueryAtCaret("/and", 4)).toBeNull();
    expect(getLibraryNameQueryAtCaret("@and", 4)).toBeNull();
    expect(getLibraryNameQueryAtCaret("and.fold", 8)).toBeNull();
    expect(getLibraryNameQueryAtCaret("a", 1)).toBeNull();
  });

  it("filters image names by prefix", () => {
    expect(filterLibraryNameCandidates([andes], "an").map((item) => item.tag)).toEqual(["Andes"]);
    expect(filterLibraryNameCandidates([andes], "des")).toEqual([]);
  });

  it("inserts the canonical name and keeps a ref span", () => {
    const query = getLibraryNameQueryAtCaret("and", 3);
    const result = insertLibraryNameRefAtQuery("and", [], query, andes);
    expect(result.text).toBe("Andes");
    expect(result.libraryNameRefs).toHaveLength(1);
    expect(result.libraryNameRefs[0].tag).toBe("Andes");
    expect(result.libraryNameRefs[0].itemId).toBe("img1");
    expect(normalizeLibraryNameRefs(result.text, result.libraryNameRefs)).toHaveLength(1);
  });

  it("drops the ref when the name is edited", () => {
    const query = getLibraryNameQueryAtCaret("and", 3);
    const inserted = insertLibraryNameRefAtQuery("and", [], query, andes);
    const next = applyTextEditToLibraryNameRefs(inserted.text, "Ande", inserted.libraryNameRefs);
    expect(next).toEqual([]);
  });
});
