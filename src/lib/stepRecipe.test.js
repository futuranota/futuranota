import { describe, expect, it } from "vitest";
import {
  createStepEntry,
  finalizeStepSequence,
  normalizeStepImages,
  stepEntryHasContent,
  stepUsesRecipeLayout,
} from "./docBlocks.js";

describe("step recipe fields", () => {
  it("caps images at 2", () => {
    const images = normalizeStepImages([
      { src: "https://a/1.webp" },
      { src: "https://a/2.webp" },
      { src: "https://a/3.webp" },
      null,
    ]);
    expect(images).toHaveLength(2);
    expect(images[0].src).toContain("1.webp");
    expect(images[1].src).toContain("2.webp");
  });

  it("migrates refImage + variantImages into images", () => {
    const step = createStepEntry({
      refImage: { src: "https://a/ref.webp", caption: "before" },
      variantImages: [
        { src: "https://a/v1.webp" },
        { src: "https://a/v2.webp" },
      ],
    });
    expect(step.images).toHaveLength(2);
    expect(step.images[0].caption).toBe("before");
    expect(step.images[1].src).toContain("v1.webp");
    expect(step.refImage).toBeUndefined();
  });

  it("drops empty image objects", () => {
    expect(normalizeStepImages([{ src: "  " }, { name: "x" }])).toEqual([]);
    expect(createStepEntry({ images: [{ src: "" }] }).images).toEqual([]);
  });

  it("has content with only a prompt or only one image", () => {
    expect(stepEntryHasContent(createStepEntry({ prompt: "a cinematic car" }))).toBe(true);
    expect(stepEntryHasContent(createStepEntry({
      images: [{ src: "https://cdn.example/ref.webp", width: 10, height: 10 }],
    }))).toBe(true);
    expect(stepEntryHasContent(createStepEntry())).toBe(false);
  });

  it("uses recipe layout for new empty steps and recipe fields", () => {
    expect(stepUsesRecipeLayout(createStepEntry())).toBe(true);
    expect(stepUsesRecipeLayout(createStepEntry({ meta: "POV beach" }))).toBe(true);
  });

  it("keeps legacy block playbooks on the old editor", () => {
    const legacy = createStepEntry({ text: "Open the app and paste this." });
    expect(stepUsesRecipeLayout(legacy)).toBe(false);
    expect(stepEntryHasContent(legacy)).toBe(true);
  });

  it("marks prompt saved when finalizing a sequence with prompt text", () => {
    const steps = finalizeStepSequence([
      createStepEntry({ prompt: "silver SUV, floating orbs" }),
    ]);
    expect(steps[0].promptSaved).toBe(true);
  });
});
