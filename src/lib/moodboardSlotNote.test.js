import { describe, expect, it } from "vitest";
import {
  MOODBOARD_SLOT_NOTE_BODY_SCALE_LIMIT,
  normalizeMoodboardSlotContentMode,
  resolveStickyNoteTextScale,
} from "./docBlocks.js";

describe("moodboard slot note scale", () => {
  it("defaults content mode to image", () => {
    expect(normalizeMoodboardSlotContentMode(null)).toBe("image");
    expect(normalizeMoodboardSlotContentMode("note")).toBe("note");
  });

  it("uses large scale at or under the body char limit", () => {
    expect(resolveStickyNoteTextScale("")).toBe("large");
    expect(resolveStickyNoteTextScale("x".repeat(MOODBOARD_SLOT_NOTE_BODY_SCALE_LIMIT))).toBe("large");
  });

  it("drops to body scale after the limit", () => {
    expect(
      resolveStickyNoteTextScale("x".repeat(MOODBOARD_SLOT_NOTE_BODY_SCALE_LIMIT + 1)),
    ).toBe("body");
  });

  it("trims before counting", () => {
    expect(resolveStickyNoteTextScale(`  ${"x".repeat(30)}  `)).toBe("large");
    expect(resolveStickyNoteTextScale(`  ${"x".repeat(31)}  `)).toBe("body");
  });
});
