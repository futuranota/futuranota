import { describe, expect, it } from "vitest";
import { listPromptPrefixRanges } from "./docPromptPrefix.js";

describe("listPromptPrefixRanges", () => {
  it("highlights prompt: at the start of a line", () => {
    const text = "prompt: Gina dijo hola";
    expect(listPromptPrefixRanges(text)).toEqual([{ start: 0, end: 7 }]);
  });

  it("is case-insensitive", () => {
    const text = "Prompt: algo";
    expect(listPromptPrefixRanges(text)).toEqual([{ start: 0, end: 7 }]);
  });

  it("highlights each line that starts with prompt:", () => {
    const text = "prompt: uno\nnormal\n  prompt: dos";
    expect(listPromptPrefixRanges(text)).toEqual([
      { start: 0, end: 7 },
      { start: 21, end: 28 },
    ]);
  });

  it("ignores prompt: when it is not at line start", () => {
    const text = "dice prompt: no";
    expect(listPromptPrefixRanges(text)).toEqual([]);
  });
});
