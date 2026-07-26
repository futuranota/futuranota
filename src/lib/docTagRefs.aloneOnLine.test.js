import { describe, expect, it } from "vitest";
import {
  insertTagRefAtQuery,
  isTagRefAloneOnLine,
  normalizeTagRefs,
  removeTagRefById,
  resolveTagRefThumbSrc,
  snapCaretOutOfTagRefBoxFootprint,
} from "./docTagRefs.js";

describe("isTagRefAloneOnLine", () => {
  it("is true when the tag is the only content on the line", () => {
    expect(isTagRefAloneOnLine("hero", 0, 4)).toBe(true);
    expect(isTagRefAloneOnLine("  hero  ", 2, 6)).toBe(true);
    expect(isTagRefAloneOnLine("before\nhero\nafter", 7, 11)).toBe(true);
  });

  it("is false when other text shares the line", () => {
    expect(isTagRefAloneOnLine("see hero now", 4, 8)).toBe(false);
    expect(isTagRefAloneOnLine("hero shot", 0, 4)).toBe(false);
    expect(isTagRefAloneOnLine("x\nsee hero", 6, 10)).toBe(false);
  });
});

describe("tagRef thumb persistence", () => {
  it("keeps thumbSrc through normalize and insert", () => {
    const inserted = insertTagRefAtQuery(
      "#h",
      [],
      { start: 0, end: 2, query: "h" },
      {
        label: "hero",
        slotId: "s1",
        blockId: "b1",
        thumbSrc: "https://example.com/hero.jpg",
      },
    );
    expect(inserted.tagRefs[0]?.thumbSrc).toBe("https://example.com/hero.jpg");
    expect(isTagRefAloneOnLine(inserted.text, inserted.tagRefs[0].start, inserted.tagRefs[0].end)).toBe(true);
    expect(inserted.text).toBe("hero\n\n\n");
    expect(inserted.caret).toBe(inserted.text.length);

    const normalized = normalizeTagRefs(inserted.text, inserted.tagRefs);
    expect(normalized[0]?.thumbSrc).toBe("https://example.com/hero.jpg");
    expect(resolveTagRefThumbSrc(normalized[0])).toBe("https://example.com/hero.jpg");
  });

  it("does not add box footprint when text shares the line", () => {
    const inserted = insertTagRefAtQuery(
      "see #h",
      [],
      { start: 4, end: 6, query: "h" },
      {
        label: "hero",
        slotId: "s1",
        blockId: "b1",
        thumbSrc: "https://example.com/hero.jpg",
      },
    );
    expect(inserted.text).toBe("see hero");
    expect(isTagRefAloneOnLine(inserted.text, inserted.tagRefs[0].start, inserted.tagRefs[0].end)).toBe(false);
  });

  it("resolves thumb from candidates when not stored", () => {
    const src = resolveTagRefThumbSrc(
      { label: "hero", slotId: "s1", blockId: "b1" },
      [{ label: "hero", slotId: "s1", blockId: "b1", thumbSrc: "/uploads/x.png" }],
    );
    expect(src).toBe("/uploads/x.png");
  });

  it("snaps caret out of the box footprint to the free line", () => {
    const inserted = insertTagRefAtQuery(
      "#h",
      [],
      { start: 0, end: 2, query: "h" },
      {
        label: "hero",
        slotId: "s1",
        blockId: "b1",
        thumbSrc: "https://example.com/hero.jpg",
      },
    );
    expect(snapCaretOutOfTagRefBoxFootprint(
      inserted.text,
      inserted.tagRefs,
      2,
    )).toBe(inserted.text.length);
    expect(snapCaretOutOfTagRefBoxFootprint(
      inserted.text,
      inserted.tagRefs,
      inserted.text.length,
    )).toBe(inserted.text.length);
  });

  it("removes box footprint when deleting by id", () => {
    const inserted = insertTagRefAtQuery(
      "#h",
      [],
      { start: 0, end: 2, query: "h" },
      {
        label: "hero",
        slotId: "s1",
        blockId: "b1",
        thumbSrc: "https://example.com/hero.jpg",
      },
    );
    const removed = removeTagRefById(
      inserted.text,
      inserted.tagRefs,
      inserted.tagRefs[0].id,
    );
    expect(removed?.text).toBe("");
    expect(removed?.tagRefs).toEqual([]);
  });
});
