import { describe, expect, it } from "vitest";
import {
  fichaHasVisual,
  fichaShowsMediaBadge,
  libraryFichaDetailMode,
  libraryTilePrefer,
  pickDocLibraryPreviews,
  promptPreviewText,
  resolveFichaPreviewKind,
} from "./libraryFichaPreview.js";

describe("libraryFichaPreview", () => {
  it("treats empty prompt + image as a visual, never a blank prompt card", () => {
    const item = { category: "image", description: "  ", mediaUrl: "/a.webp" };
    expect(promptPreviewText(item)).toBe("");
    expect(fichaHasVisual(item)).toBe(true);
    expect(resolveFichaPreviewKind(item, "prompt")).toBe("image");
    expect(resolveFichaPreviewKind(item, "image")).toBe("image");
  });

  it("Library / Assets prefer the photo when both faces exist", () => {
    const item = { category: "image", description: "hero shot", mediaUrl: "/a.webp" };
    expect(libraryTilePrefer("folder")).toBe("image");
    expect(resolveFichaPreviewKind(item, libraryTilePrefer("folder"))).toBe("image");
    expect(fichaShowsMediaBadge(item, libraryTilePrefer("folder"))).toBe(false);
  });

  it("Docs index squares prefer the written prompt when both faces exist", () => {
    const item = { category: "image", description: "hero shot", mediaUrl: "/a.webp" };
    expect(libraryTilePrefer("document")).toBe("prompt");
    expect(resolveFichaPreviewKind(item, libraryTilePrefer("document"))).toBe("prompt");
    expect(fichaShowsMediaBadge(item, libraryTilePrefer("document"))).toBe(true);
  });

  it("does not show a media badge on prompt-only docs tiles", () => {
    const item = { category: "image", description: "hero shot" };
    expect(fichaShowsMediaBadge(item, libraryTilePrefer("document"))).toBe(false);
  });

  it("falls back to prompt text when Library has no photo", () => {
    const item = { category: "image", description: "only metadata" };
    expect(resolveFichaPreviewKind(item, "image")).toBe("prompt");
  });

  it("opens Library detail on Image when a photo exists", () => {
    expect(libraryFichaDetailMode("folder", { hasImage: true, hasRef: true })).toBe("image");
    expect(libraryFichaDetailMode("document", { hasImage: true, hasRef: true })).toBe("image");
    expect(libraryFichaDetailMode("folder", { hasImage: false, hasRef: true })).toBe("ref");
  });

  it("picks doc squares with prompts first, then image-only fichas", () => {
    const items = [
      { id: "1", category: "image", description: "", mediaUrl: "/a.webp" },
      { id: "2", category: "image", description: "scene" },
      { id: "3", category: "skill", description: "skip" },
      { id: "4", category: "image", description: "other" },
    ];
    expect(pickDocLibraryPreviews(items, 4).map((entry) => entry.id)).toEqual(["2", "4", "1"]);
  });
});
