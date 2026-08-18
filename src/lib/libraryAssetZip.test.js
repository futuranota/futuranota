import { describe, expect, it } from "vitest";
import {
  libraryAssetHasPack,
  libraryAssetItemHasPackFile,
  listLibraryAssetPackEntries,
  safeAssetFolderName,
  uniqueAssetStem,
  uniqueImageFilename,
} from "./libraryAssetZip.js";

describe("libraryAssetZip names", () => {
  it("sanitizes folder names", () => {
    expect(safeAssetFolderName("Character")).toBe("Character");
    expect(safeAssetFolderName("  hero stills!! ")).toBe("hero_stills");
    expect(safeAssetFolderName("")).toBe("asset");
  });

  it("avoids duplicate filenames", () => {
    const used = new Set();
    expect(uniqueImageFilename("shot", 0, used)).toBe("shot.webp");
    expect(uniqueImageFilename("shot", 1, used)).toBe("shot_2.webp");
  });

  it("reuses one stem for txt and webp", () => {
    const used = new Set();
    expect(uniqueAssetStem("recordatorio", 0, used)).toBe("recordatorio");
    expect(uniqueAssetStem("recordatorio", 1, used)).toBe("recordatorio_2");
    const paired = listLibraryAssetPackEntries([
      {
        category: "image",
        tag: "recordatorio",
        description: "keep the beat",
        mediaUrl: "https://cdn.example/a.webp",
      },
      {
        category: "image",
        tag: "Art in Life",
        description: "only text",
      },
      {
        category: "image",
        tag: "recordatorio",
        description: "again",
        mediaUrl: "https://cdn.example/b.webp",
      },
    ]);
    expect(paired.map((entry) => [
      entry.stem,
      Boolean(entry.text),
      Boolean(entry.mediaUrl),
    ])).toEqual([
      ["recordatorio", true, true],
      ["Art_in_Life", true, false],
      ["recordatorio_2", true, true],
    ]);
  });

  it("skips empty fichas and non-image rows", () => {
    expect(libraryAssetItemHasPackFile({ category: "image", description: "hi" })).toBe(true);
    expect(libraryAssetItemHasPackFile({ category: "image", mediaUrl: "/x.webp" })).toBe(true);
    expect(libraryAssetItemHasPackFile({ category: "image" })).toBe(false);
    expect(libraryAssetItemHasPackFile({ category: "pdf", description: "nope" })).toBe(false);
    expect(listLibraryAssetPackEntries([
      { category: "image", tag: "empty" },
      { category: "pdf", tag: "doc", description: "skip" },
    ])).toEqual([]);
  });

  it("includes the asset Script as a txt beside the fichas", () => {
    const packed = listLibraryAssetPackEntries(
      [
        {
          category: "image",
          tag: "recordatorio",
          description: "ficha script",
          mediaUrl: "https://cdn.example/a.webp",
        },
      ],
      { tag: "Scene 01", description: "scene bible" },
    );
    expect(packed.map((entry) => [entry.stem, entry.text, entry.mediaUrl])).toEqual([
      ["Scene_01", "scene bible", ""],
      ["recordatorio", "ficha script", "https://cdn.example/a.webp"],
    ]);
    expect(libraryAssetHasPack({ description: "scene bible" }, [])).toBe(true);
    expect(libraryAssetHasPack({ description: "  " }, [])).toBe(false);
  });
});
