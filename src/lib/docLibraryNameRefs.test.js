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

  it("filters aliases by phrase prefix", () => {
    const gina = {
      id: "g1",
      tag: "Gina",
      aliases: ["mi hermana"],
      description: "portrait",
    };
    const hits = filterLibraryNameCandidates([gina], "mi");
    expect(hits).toHaveLength(1);
    expect(hits[0].tag).toBe("mi hermana");
    expect(hits[0].canonicalTag).toBe("Gina");
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

  it("keeps only the name when committing over a dotted assign token", () => {
    const text = "go Pitagoras.scene01";
    const result = insertLibraryNameRefAtQuery(
      text,
      [],
      { start: 3, end: text.length },
      { id: "f1", tag: "Pitagoras" },
    );
    expect(result.text).toBe("go Pitagoras");
    expect(result.libraryNameRefs[0].tag).toBe("Pitagoras");
    expect(result.caret).toBe("go Pitagoras".length);
  });

  it("drops the ref when the name is edited", () => {
    const query = getLibraryNameQueryAtCaret("and", 3);
    const inserted = insertLibraryNameRefAtQuery("and", [], query, andes);
    const next = applyTextEditToLibraryNameRefs(inserted.text, "Ande", inserted.libraryNameRefs);
    expect(next).toEqual([]);
  });
});
