import { describe, expect, it } from "vitest";
import {
  createStepEntry,
  finalizeStepSequence,
  normalizeStepVariantImages,
  stepEntryHasContent,
  stepUsesRecipeLayout,
} from "./docBlocks.js";

describe("step recipe fields", () => {
  it("caps variant images at 2", () => {
    const images = normalizeStepVariantImages([
      { src: "https://a/1.webp" },
      { src: "https://a/2.webp" },
      { src: "https://a/3.webp" },
      null,
    ]);
    expect(images).toHaveLength(2);
    expect(images[0].src).toContain("1.webp");
    expect(images[1].src).toContain("2.webp");
  });

  it("drops empty image objects", () => {
    expect(normalizeStepVariantImages([{ src: "  " }, { name: "x" }])).toEqual([]);
    expect(createStepEntry({ refImage: { src: "" } }).refImage).toBeNull();
  });

  it("has content with only a prompt or only a ref image", () => {
    expect(stepEntryHasContent(createStepEntry({ prompt: "a cinematic car" }))).toBe(true);
    expect(stepEntryHasContent(createStepEntry({
      refImage: { src: "https://cdn.example/ref.webp", width: 10, height: 10 },
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
