import { describe, expect, it } from "vitest";
import {
  imageSplitHasFill,
  isImageCardLibraryPick,
  libraryItemToImageSplitPatch,
} from "./libraryImageCardPick.js";

describe("libraryImageCardPick", () => {
  it("accepts Prompt fichas with photo, prompt, or both", () => {
    expect(isImageCardLibraryPick({ category: "image", mediaUrl: "/a.webp" })).toBe(true);
    expect(isImageCardLibraryPick({ category: "image", description: "walk the hall" })).toBe(true);
    expect(isImageCardLibraryPick({ category: "skill", mediaUrl: "/a.webp" })).toBe(false);
    expect(isImageCardLibraryPick({ category: "image" })).toBe(false);
  });

  it("copies photo + metadata without touching the right-hand story", () => {
    const patch = libraryItemToImageSplitPatch(
      {
        id: "lib1",
        tag: "gina_hall",
        category: "image",
        description: "Gina comienza a caminar por el pasillo",
        mediaUrl: "/gina.webp",
      },
      "folder",
    );
    expect(patch).toMatchObject({
      src: "/gina.webp",
      libraryItemId: "lib1",
      libraryOwnerKind: "folder",
      libraryPrompt: "Gina comienza a caminar por el pasillo",
      libraryTag: "gina_hall",
      mediaFace: "image",
      imageSaved: true,
    });
    expect(patch.body).toBeUndefined();
    expect(patch.overlayTitle).toBeUndefined();
  });

  it("prompt-only fichas land on the Prompt face", () => {
    const patch = libraryItemToImageSplitPatch({
      id: "lib2",
      tag: "cue",
      category: "image",
      description: "invitation gesture",
    }, "document");
    expect(patch.src).toBe("");
    expect(patch.imageSaved).toBe(false);
    expect(patch.mediaFace).toBe("prompt");
    expect(patch.libraryPrompt).toBe("invitation gesture");
    expect(imageSplitHasFill(patch)).toBe(true);
  });

  it("empty card is not filled", () => {
    expect(imageSplitHasFill({ src: "", libraryPrompt: "  " })).toBe(false);
  });
});
