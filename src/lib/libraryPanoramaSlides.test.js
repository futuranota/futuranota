import { describe, expect, it } from "vitest";
import { listPanoramaPromptSlides } from "./libraryPanoramaSlides.js";

describe("listPanoramaPromptSlides", () => {
  it("keeps loose image/auto fichas with mediaUrl", () => {
    const items = [
      { id: "1", category: "image", mediaUrl: "https://x/a.webp", setId: null },
      { id: "2", category: "auto", mediaUrl: "https://x/b.webp" },
      { id: "3", category: "image", mediaUrl: "https://x/c.webp", setId: "asset1" },
      { id: "4", category: "image", mediaUrl: "" },
      { id: "5", category: "skill", mediaUrl: "https://x/d.webp" },
      { id: "6", category: "image", description: "text only" },
    ];
    expect(listPanoramaPromptSlides(items).map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("returns empty for bad input", () => {
    expect(listPanoramaPromptSlides(null)).toEqual([]);
    expect(listPanoramaPromptSlides(undefined)).toEqual([]);
  });
});
