import { describe, expect, it } from "vitest";
import {
  fichaHasVisual,
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
    expect(resolveFichaPreviewKind(item, "image")).toBe("image");
  });

  it("Docs / Prompt prefer the written prompt when both faces exist", () => {
    const item = { category: "image", description: "hero shot", mediaUrl: "/a.webp" };
    expect(resolveFichaPreviewKind(item, "prompt")).toBe("prompt");
  });

  it("falls back to prompt text when Library has no photo", () => {
    const item = { category: "image", description: "only metadata" };
    expect(resolveFichaPreviewKind(item, "image")).toBe("prompt");
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
