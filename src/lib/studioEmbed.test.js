import { describe, expect, it } from "vitest";
import { parseStudioVimeoInput } from "./studioEmbed.js";
import {
  normalizeStudioAspectRatio,
  normalizeStudioPhase,
  studioAspectCss,
} from "./studioConfig.js";

describe("parseStudioVimeoInput", () => {
  it("accepts vimeo.com URLs", () => {
    const parsed = parseStudioVimeoInput("https://vimeo.com/123456789");
    expect(parsed.error).toBeNull();
    expect(parsed.provider).toBe("vimeo");
    expect(parsed.embedSrc).toContain("player.vimeo.com/video/123456789");
  });

  it("rejects YouTube", () => {
    const parsed = parseStudioVimeoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parsed.error).toBe("STUDIO_VIMEO_ONLY");
    expect(parsed.embedSrc).toBe("");
  });
});

describe("studioAspect", () => {
  it("normalizes unknown to 16:9", () => {
    expect(normalizeStudioAspectRatio("4:3")).toBe("16:9");
  });

  it("accepts full ratio set", () => {
    expect(normalizeStudioAspectRatio("2:3")).toBe("2:3");
    expect(normalizeStudioAspectRatio("3:2")).toBe("3:2");
    expect(normalizeStudioAspectRatio("1:1")).toBe("1:1");
    expect(normalizeStudioAspectRatio("9:16")).toBe("9:16");
  });

  it("maps CSS ratios", () => {
    expect(studioAspectCss("2:3")).toBe("2 / 3");
    expect(studioAspectCss("3:2")).toBe("3 / 2");
    expect(studioAspectCss("16:9")).toBe("16 / 9");
    expect(studioAspectCss("9:16")).toBe("9 / 16");
    expect(studioAspectCss("1:1")).toBe("1 / 1");
  });
});

describe("studioPhase", () => {
  it("defaults to embed", () => {
    expect(normalizeStudioPhase("nope")).toBe("embed");
  });

  it("keeps view", () => {
    expect(normalizeStudioPhase("view")).toBe("view");
  });
});
