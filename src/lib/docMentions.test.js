import { describe, expect, it } from "vitest";
import {
  applyTextEditToMentions,
  getMentionQueryAtCaret,
  insertMentionAtQuery,
  mergeMentionBlocks,
  normalizeMentions,
  shiftMentions,
} from "./docMentions.js";

const sampleMention = (overrides = {}) => ({
  id: "MNT1",
  sourceEntryId: "E1",
  tag: "blog",
  description: "Weekly posts",
  start: 0,
  end: 5,
  insertedAt: "2026-07-20T00:00:00.000Z",
  ...overrides,
});

describe("docMentions", () => {
  it("normalizes mentions that still match @tag in text", () => {
    const text = "see @blog today";
    const mentions = normalizeMentions(text, [
      sampleMention({ start: 4, end: 9 }),
      sampleMention({ id: "bad", start: 0, end: 3, tag: "nope" }),
    ]);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].tag).toBe("blog");
    expect(mentions[0].start).toBe(4);
    expect(mentions[0].end).toBe(9);
  });

  it("detects @query at caret with whitespace boundary", () => {
    expect(getMentionQueryAtCaret("hello @bl", 9)).toEqual({
      start: 6,
      end: 9,
      query: "bl",
    });
    expect(getMentionQueryAtCaret("email@bl", 8)).toBeNull();
    expect(getMentionQueryAtCaret("@", 1)).toEqual({ start: 0, end: 1, query: "" });
  });

  it("inserts @tag and snapshot metadata", () => {
    const result = insertMentionAtQuery(
      "note @bl",
      [],
      { start: 5, end: 8, query: "bl" },
      { entryId: "E9", tag: "blog", description: "Desc snapshot" },
    );
    expect(result.text).toBe("note @blog");
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0]).toMatchObject({
      sourceEntryId: "E9",
      tag: "blog",
      description: "Desc snapshot",
      start: 5,
      end: 10,
    });
    expect(result.caret).toBe(10);
  });

  it("adds a trailing space when inserting before non-space text", () => {
    const result = insertMentionAtQuery(
      "@blmore",
      [],
      { start: 0, end: 3, query: "bl" },
      { tag: "blog", description: "" },
    );
    expect(result.text).toBe("@blog more");
    expect(result.caret).toBe(6);
  });

  it("shifts mentions after an edit before them", () => {
    const text = "xx @blog";
    const mentions = [sampleMention({ start: 3, end: 8 })];
    const next = applyTextEditToMentions("xx @blog", "yyy @blog", mentions);
    expect(next).toEqual([
      expect.objectContaining({ start: 4, end: 9, tag: "blog" }),
    ]);
    expect(text).toBe("xx @blog");
  });

  it("drops mention metadata when editing inside the token", () => {
    const mentions = [sampleMention({ start: 0, end: 5 })];
    const next = shiftMentions(mentions, 2, 1, 1, "@bxog");
    expect(next).toEqual([]);
  });

  it("keeps snapshot description after source would be gone", () => {
    const text = "@blog";
    const mentions = normalizeMentions(text, [
      sampleMention({ description: "Frozen copy", sourceEntryId: "deleted" }),
    ]);
    expect(mentions[0].description).toBe("Frozen copy");
  });

  it("merges mention ranges across adjacent text blocks", () => {
    const merged = mergeMentionBlocks(
      "hi @a",
      [sampleMention({ tag: "a", start: 3, end: 5, description: "A" })],
      "@b",
      [sampleMention({ id: "M2", tag: "b", start: 0, end: 2, description: "B" })],
      "\n",
    );
    expect(merged.text).toBe("hi @a\n@b");
    expect(merged.mentions.map((m) => ({ tag: m.tag, start: m.start, end: m.end }))).toEqual([
      { tag: "a", start: 3, end: 5 },
      { tag: "b", start: 6, end: 8 },
    ]);
  });
});
