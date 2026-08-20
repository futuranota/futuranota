import { describe, expect, it } from "vitest";
import { listLibraryPromptCaptures } from "./libraryPromptCapture.js";
import { sliceNameRefsForCapture, sliceScriptRefsForCapture } from "./libraryScriptCapture.js";

describe("libraryScriptCapture", () => {
  it("rebases name refs inside a capture", () => {
    const text = "intro --Gina se levanta-- outro";
    const [capture] = listLibraryPromptCaptures(text);
    expect(capture?.prompt).toBe("Gina se levanta");
    const refs = sliceNameRefsForCapture(text, capture, [
      {
        id: "LNR1",
        itemId: "img1",
        tag: "Gina",
        setId: null,
        start: 8,
        end: 12,
        insertedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].start).toBe(0);
    expect(refs[0].end).toBe(4);
    expect(refs[0].tag).toBe("Gina");
  });

  it("ignores refs outside the capture", () => {
    const text = "Gina y --solo esto--";
    const [capture] = listLibraryPromptCaptures(text);
    const refs = sliceNameRefsForCapture(text, capture, [
      {
        id: "LNR1",
        itemId: "img1",
        tag: "Gina",
        setId: null,
        start: 0,
        end: 4,
        insertedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(refs).toEqual([]);
  });

  it("slices both name and speak refs", () => {
    const text = '--Gina ""hola""--';
    const [capture] = listLibraryPromptCaptures(text);
    const { libraryNameRefs, librarySpeakRefs } = sliceScriptRefsForCapture(text, capture, {
      libraryNameRefs: [{
        id: "LNR1",
        itemId: "img1",
        tag: "Gina",
        setId: null,
        start: 2,
        end: 6,
        insertedAt: "2026-01-01T00:00:00.000Z",
      }],
      librarySpeakRefs: [{
        id: "LSR1",
        itemId: "img1",
        tag: "Gina",
        start: 2,
        end: 13,
        dialogueStart: 8,
        dialogueEnd: 12,
        dialogue: "hola",
        insertedAt: "2026-01-01T00:00:00.000Z",
      }],
    });
    expect(libraryNameRefs[0].start).toBe(0);
    expect(librarySpeakRefs[0].dialogue).toBe("hola");
  });
});
