import { describe, expect, it } from "vitest";
import {
  imageSplitHasFill,
  isImageCardLibraryPick,
  isMoodboardLibraryPick,
  flattenVisualPicksFromCatalogs,
  flattenAttachmentPicksFromCatalogs,
  findLibraryItemBySlot,
  libraryItemToImageSplitPatch,
  libraryItemToMoodboardSlotPatch,
  moodboardSlotPersistedSrcForLibrary,
  resolveImageSplitLibraryLink,
  resolveMoodboardSlotPresentation,
  syncImageSplitPromptToLibrary,
} from "./libraryImageCardPick.js";

describe("libraryImageCardPick", () => {
  it("accepts Prompt fichas with photo, prompt, or both", () => {
    expect(isImageCardLibraryPick({ category: "image", mediaUrl: "/a.webp" })).toBe(true);
    expect(isImageCardLibraryPick({ category: "image", description: "walk the hall" })).toBe(true);
    expect(isImageCardLibraryPick({ category: "skill", mediaUrl: "/a.webp" })).toBe(false);
    expect(isImageCardLibraryPick({ category: "image" })).toBe(false);
  });

  it("moodboard picks require a photo", () => {
    expect(isMoodboardLibraryPick({ category: "image", mediaUrl: "/a.webp" })).toBe(true);
    expect(isMoodboardLibraryPick({ category: "image", description: "only text" })).toBe(false);
    expect(isMoodboardLibraryPick({ category: "skill", mediaUrl: "/a.webp" })).toBe(false);
  });

  it("flattens workspace visuals and excludes one folder catalog", () => {
    const catalogs = [
      {
        ownerKind: "folder",
        ownerId: "folderA",
        items: [
          { id: "a1", category: "image", mediaUrl: "/a1.webp" },
          { id: "a2", category: "image", description: "prompt only" },
        ],
      },
      {
        ownerKind: "document",
        ownerId: "doc1",
        items: [{ id: "d1", category: "image", mediaUrl: "/d1.webp" }],
      },
      {
        ownerKind: "folder",
        ownerId: "folderB",
        items: [{ id: "b1", category: "image", mediaUrl: "/b1.webp" }],
      },
    ];
    const all = flattenVisualPicksFromCatalogs(catalogs);
    expect(all.map((row) => row.item.id)).toEqual(["a1", "d1", "b1"]);
    const rest = flattenVisualPicksFromCatalogs(catalogs, { excludeFolderId: "folderA" });
    expect(rest.map((row) => `${row.ownerKind}:${row.ownerId}:${row.item.id}`)).toEqual([
      "document:doc1:d1",
      "folder:folderB:b1",
    ]);
  });

  it("maps a visual ficha onto a moodboard slot without re-upload fields", () => {
    const patch = libraryItemToMoodboardSlotPatch(
      {
        id: "lib9",
        tag: "hero_ref",
        category: "image",
        description: "optional note",
        mediaUrl: "/hero.webp",
      },
      "folder",
      "folder1",
    );
    expect(patch).toEqual({
      src: "/hero.webp",
      name: "hero_ref",
      alt: "hero_ref",
      width: 0,
      height: 0,
      imageSaved: true,
      kind: "image",
      libraryItemId: "lib9",
      libraryOwnerKind: "folder",
      libraryOwnerId: "folder1",
    });
  });

  it("rejects prompt-only fichas for moodboard slots", () => {
    expect(libraryItemToMoodboardSlotPatch({
      id: "lib0",
      tag: "cue",
      category: "image",
      description: "no photo",
    }, "document")).toBeNull();
  });

  it("copies photo + metadata without touching the right-hand story", () => {
    const patch = libraryItemToImageSplitPatch(
      {
        id: "lib1",
        tag: "gina_hall",
        category: "image",
        description: "Gina comienza a caminar por el pasillo",
        mediaUrl: "/gina.webp",
        wallColor: "#3a2a1a",
      },
      "folder",
      "folder1",
    );
    expect(patch).toMatchObject({
      src: "/gina.webp",
      libraryItemId: "lib1",
      libraryOwnerKind: "folder",
      libraryOwnerId: "folder1",
      libraryPrompt: "Gina comienza a caminar por el pasillo",
      libraryTag: "gina_hall",
      mediaFace: "prompt",
      imageSaved: true,
      wallColor: "#3A2A1A",
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

  it("photo-only fichas land on the Image face so Prompt can be written", () => {
    const patch = libraryItemToImageSplitPatch({
      id: "lib3",
      tag: "still",
      category: "image",
      mediaUrl: "/still.webp",
    }, "document");
    expect(patch.mediaFace).toBe("image");
    expect(patch.libraryPrompt).toBe("");
    expect(patch.imageSaved).toBe(true);
  });

  it("copies wall color onto the Image card", () => {
    const patch = libraryItemToImageSplitPatch({
      id: "lib4",
      tag: "wall",
      category: "image",
      mediaUrl: "/w.webp",
      wallColor: "#abc",
    }, "folder", "f1");
    expect(patch.wallColor).toBe("#AABBCC");
  });

  it("empty card is not filled", () => {
    expect(imageSplitHasFill({ src: "", libraryPrompt: "  " })).toBe(false);
  });

  it("does not rewrite a library ficha without a matching catalog", () => {
    expect(syncImageSplitPromptToLibrary({
      libraryItemId: "lib1",
      libraryPrompt: "new text",
    })).toBeNull();
  });

  it("overwrites prompt using stored library ids", () => {
    expect(syncImageSplitPromptToLibrary({
      libraryItemId: "lib1",
      libraryOwnerKind: "folder",
      libraryOwnerId: "folder1",
      libraryPrompt: "new text from card",
    }, [{
      ownerKind: "folder",
      ownerId: "folder1",
      items: [{ id: "lib1", mediaUrl: "/gina.webp" }],
    }])).toEqual({
      ownerKind: "folder",
      ownerId: "folder1",
      itemId: "lib1",
      description: "new text from card",
    });
  });

  it("finds the ficha by photo when owner ids were never stored", () => {
    expect(resolveImageSplitLibraryLink({
      src: "/gina.webp",
      libraryPrompt: "added later",
    }, [{
      ownerKind: "folder",
      ownerId: "folder1",
      items: [{ id: "lib1", mediaUrl: "/gina.webp" }],
    }])).toEqual({
      ownerKind: "folder",
      ownerId: "folder1",
      itemId: "lib1",
    });
  });

  describe("moodboard slot presentation", () => {
    const catalogs = [{
      ownerKind: "folder",
      ownerId: "folder1",
      items: [{
        id: "lib9",
        tag: "hero",
        mediaUrl: "/baked.webp",
        sourceMediaUrl: "/raw.webp",
        frameAspect: "9:16",
        wallColor: "#ff0000",
      }],
    }];

    it("uses baked library mediaUrl when slot frame matches", () => {
      const slot = {
        libraryItemId: "lib9",
        libraryOwnerKind: "folder",
        libraryOwnerId: "folder1",
        frameAspect: "9:16",
      };
      const item = findLibraryItemBySlot(slot, catalogs);
      const pres = resolveMoodboardSlotPresentation(slot, item);
      expect(pres.mode).toBe("baked");
      expect(pres.displaySrc).toBe("/baked.webp");
      expect(pres.downloadSourceUrl).toBe("/raw.webp");
      expect(moodboardSlotPersistedSrcForLibrary("9:16", item)).toBe("/baked.webp");
    });

    it("uses contain preview when slot frame differs from library", () => {
      const slot = {
        libraryItemId: "lib9",
        libraryOwnerKind: "folder",
        libraryOwnerId: "folder1",
        frameAspect: "3:2",
        wallColor: "#00ff00",
      };
      const item = findLibraryItemBySlot(slot, catalogs);
      const pres = resolveMoodboardSlotPresentation(slot, item);
      expect(pres.mode).toBe("contain");
      expect(pres.displaySrc).toBe("/raw.webp");
      expect(pres.wallColor).toBe("#00FF00");
      expect(moodboardSlotPersistedSrcForLibrary("3:2", item)).toBe("");
    });

    it("legacy slot uses src with cover mode", () => {
      const pres = resolveMoodboardSlotPresentation({ src: "/legacy.webp" }, null);
      expect(pres.mode).toBe("legacy");
      expect(pres.displaySrc).toBe("/legacy.webp");
    });
  });
});

describe("flattenAttachmentPicksFromCatalogs", () => {
  it("keeps skill/pdf and skips image fichas", () => {
    const catalogs = [
      {
        ownerKind: "folder",
        ownerId: "f1",
        items: [
          { id: "a1", category: "skill", tag: "pdf1" },
          { id: "i1", category: "image", mediaUrl: "/x.webp" },
          { id: "a2", category: "pdf", tag: "doc" },
        ],
      },
    ];
    const rows = flattenAttachmentPicksFromCatalogs(catalogs);
    expect(rows.map((r) => r.item.id)).toEqual(["a1", "a2"]);
  });
});
