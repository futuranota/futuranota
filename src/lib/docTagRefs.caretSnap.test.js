import { describe, expect, it } from "vitest";
import {
  insertTagRefAtQuery,
  snapCaretOutOfTagRefBoxFootprint,
} from "./docTagRefs.js";

describe("tagRef box footprint caret snap", () => {
  it("simulates stale-value snap after @ on spacer (why keyup snap was removed)", () => {
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
    const staleText = inserted.text;
    const staleTagRefs = inserted.tagRefs;
    const spacerCaret = 5;
    const liveText = `${staleText.slice(0, spacerCaret)}@${staleText.slice(spacerCaret)}`;
    const liveCaret = spacerCaret + 1;

    const snapOnStale = snapCaretOutOfTagRefBoxFootprint(
      staleText,
      staleTagRefs,
      liveCaret,
    );
    expect(snapOnStale).toBe(staleText.length);

    const snapOnLive = snapCaretOutOfTagRefBoxFootprint(
      liveText,
      staleTagRefs,
      liveCaret,
    );
    expect(snapOnLive).toBe(liveCaret);
  });
});
