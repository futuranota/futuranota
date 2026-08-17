import { describe, expect, it } from "vitest";
import {
  findNewlyClosedLibraryPrompt,
  listLibraryPromptCaptures,
  stripLibraryPromptDelimiters,
} from "./libraryPromptCapture.js";

describe("libraryPromptCapture", () => {
  it("lists a closed prompt pair", () => {
    const items = listLibraryPromptCaptures(
      "hola --sol y una montaña-- fin",
    );
    expect(items).toHaveLength(1);
    expect(items[0].prompt).toBe("sol y una montaña");
  });

  it("ignores empty wrappers", () => {
    expect(listLibraryPromptCaptures("----")).toEqual([]);
    expect(listLibraryPromptCaptures("--   --")).toEqual([]);
  });

  it("detects a newly closed pair at the end", () => {
    const capture = findNewlyClosedLibraryPrompt(
      "--quiero este texto descriptivo para generar esta imagen con una sol y una montaña-",
      "--quiero este texto descriptivo para generar esta imagen con una sol y una montaña--",
    );
    expect(capture?.prompt).toContain("sol y una montaña");
  });

  it("does not re-fire an already closed pair", () => {
    const text = "--sol y montaña--";
    expect(findNewlyClosedLibraryPrompt(text, text)).toBeNull();
  });

  it("strips delimiters and keeps the prompt in the prose", () => {
    const text = "y Francisco --sol y montaña-- miraba";
    const [capture] = listLibraryPromptCaptures(text);
    expect(stripLibraryPromptDelimiters(text, capture)).toBe(
      "y Francisco sol y montaña miraba",
    );
  });
});
