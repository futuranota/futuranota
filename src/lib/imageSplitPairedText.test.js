import { describe, expect, it } from "vitest";
import {
  DOC_BLOCK_TYPES,
  createDocBlock,
  ensureImageSplitPairedTextBlock,
  getImageSplitPairedTextIndex,
  isImageSplitPairedTextBlock,
  normalizeDocBlocks,
  saveImageSplitMediaBlock,
} from "./docBlocks.js";

describe("image split paired TEXT", () => {
  it("creates a paired TEXT block and migrates legacy copy off the card", () => {
    const imageBlock = createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, {
      src: "https://example.com/photo.jpg",
      imageSaved: true,
      overlayTitle: "Headline",
      body: "Side notes",
    });

    const next = ensureImageSplitPairedTextBlock([imageBlock], 0);
    const pairedIndex = getImageSplitPairedTextIndex(next, 0);

    expect(pairedIndex).toBe(1);
    expect(isImageSplitPairedTextBlock(next[pairedIndex])).toBe(true);
    expect(next[pairedIndex].text).toBe("Side notes");
    expect(next[pairedIndex].imageSplitHeadline).toBe("Headline");
    expect(next[0].body).toBe("");
    expect(next[0].overlayTitle).toBe("");
    expect(next[0].pairedTextBlockId).toBe(next[pairedIndex].id);
  });

  it("keeps side layout data on save but only locks media", () => {
    const imageBlock = createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, {
      src: "https://example.com/photo.jpg",
      imageSaved: true,
    });
    let blocks = ensureImageSplitPairedTextBlock([imageBlock], 0);
    const pairedIndex = getImageSplitPairedTextIndex(blocks, 0);
    blocks = blocks.map((entry, i) => (
      i === pairedIndex
        ? { ...entry, text: "Still beside the image", imageSplitHeadline: "Title" }
        : entry
    ));

    const saved = saveImageSplitMediaBlock(blocks, 0);

    expect(saved[0].splitSaved).toBe(true);
    expect(saved[pairedIndex].text).toBe("Still beside the image");
    expect(saved[pairedIndex].imageSplitHeadline).toBe("Title");
  });

  it("normalizes legacy saved cards into paired TEXT blocks", () => {
    const imageBlock = createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, {
      src: "https://example.com/photo.jpg",
      imageSaved: true,
      splitSaved: true,
      body: "Legacy body",
    });

    const next = normalizeDocBlocks([imageBlock]);
    const pairedIndex = getImageSplitPairedTextIndex(next, 0);

    expect(pairedIndex).toBe(1);
    expect(next[pairedIndex].text).toBe("Legacy body");
    expect(next[0].body).toBe("");
  });
});
