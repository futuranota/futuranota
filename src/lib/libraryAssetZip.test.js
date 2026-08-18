import { describe, expect, it } from "vitest";
import { safeAssetFolderName, uniqueImageFilename } from "./libraryAssetZip.js";

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
});
