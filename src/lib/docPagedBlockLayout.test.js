import { describe, expect, it } from "vitest";
import {
  buildBlockAwarePageBreaks,
  contentHeightFromBlocks,
  isAtomicWritingBlockType,
  normalizePageBreaks,
  resolveAdaptiveTargetViewportBlocks,
} from "./docPagedBlockLayout.js";
import { NODE_BLOCK_TYPES } from "./nodeInlineContent.js";

describe("docPagedBlockLayout", () => {
  it("treats all blocks including text as atomic", () => {
    expect(isAtomicWritingBlockType(NODE_BLOCK_TYPES.TEXT)).toBe(true);
    expect(isAtomicWritingBlockType(NODE_BLOCK_TYPES.MOODBOARD)).toBe(true);
  });

  it("keeps atomic moodboard on its own page when it does not fit remainder", () => {
    const blocks = [
      { id: "a", type: "text", top: 0, height: 900, bottom: 900, atomic: true },
      { id: "b", type: "moodboard", top: 900, height: 500, bottom: 1400, atomic: true },
    ];
    const breaks = buildBlockAwarePageBreaks(blocks, 400, 3);
    expect(breaks).toEqual([0, 900]);
  });

  it("does not break before moodboard when it fits on the current page", () => {
    const blocks = [
      { id: "a", type: "text", top: 0, height: 200, bottom: 200, atomic: true },
      { id: "b", type: "moodboard", top: 200, height: 500, bottom: 700, atomic: true },
    ];
    const breaks = buildBlockAwarePageBreaks(blocks, 400, 5);
    expect(breaks).toEqual([0]);
  });

  it("keeps long text cell whole on one page (no mid-cell split)", () => {
    const blocks = [
      { id: "a", type: "text", top: 0, height: 2000, bottom: 2000, atomic: true },
    ];
    const breaks = buildBlockAwarePageBreaks(blocks, 400, 5);
    expect(breaks).toEqual([0]);
  });

  it("moves text cell to next page when it does not fit remainder", () => {
    const blocks = [
      { id: "a", type: "text", top: 0, height: 1800, bottom: 1800, atomic: true },
      { id: "b", type: "text", top: 1800, height: 300, bottom: 2100, atomic: true },
    ];
    const breaks = buildBlockAwarePageBreaks(blocks, 400, 5);
    expect(breaks).toEqual([0, 1800]);
  });

  it("gives tall atomic block an exclusive page and breaks before the next block", () => {
    const blocks = [
      { id: "a", type: "moodboard", top: 0, height: 1500, bottom: 1500, atomic: true },
      { id: "b", type: "text", top: 1500, height: 100, bottom: 1600, atomic: true },
    ];
    const breaks = buildBlockAwarePageBreaks(blocks, 400, 3);
    expect(breaks).toEqual(normalizePageBreaks([0, 1500]));
  });

  it("adaptive target grows with document height", () => {
    const short = [
      { id: "a", type: "text", top: 0, height: 800, bottom: 800, atomic: true },
    ];
    const long = [
      { id: "a", type: "text", top: 0, height: 4000, bottom: 4000, atomic: true },
    ];
    expect(contentHeightFromBlocks(short)).toBe(800);
    expect(resolveAdaptiveTargetViewportBlocks(short, 400)).toBeGreaterThanOrEqual(4);
    expect(resolveAdaptiveTargetViewportBlocks(long, 400)).toBeGreaterThanOrEqual(5);
  });

  it("adaptive packing uses fewer pages for medium docs than fixed small target", () => {
    const blocks = [
      { id: "a", type: "text", top: 0, height: 1000, bottom: 1000, atomic: true },
      { id: "b", type: "moodboard", top: 1000, height: 600, bottom: 1600, atomic: true },
      { id: "c", type: "text", top: 1600, height: 800, bottom: 2400, atomic: true },
    ];
    const tight = buildBlockAwarePageBreaks(blocks, 400, 3);
    const adaptive = buildBlockAwarePageBreaks(
      blocks,
      400,
      resolveAdaptiveTargetViewportBlocks(blocks, 400),
    );
    expect(adaptive.length).toBeLessThanOrEqual(tight.length);
  });
});
