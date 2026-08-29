import { describe, expect, it } from "vitest";
import {
  clampPageIndex,
  clampScrollTopToPage,
  computePageCount,
  isLastBlockOfPage,
  lastBlockOffsetInPage,
  maxScrollTopForPage,
  pageCountFromBreaks,
  pageHeightFromViewport,
  pageIndexFromBreaks,
  pageIndexFromScrollTop,
  PAGE_VIEWPORT_BLOCKS,
  PAGE_VIEWPORT_BLOCKS_DEFAULT,
  PAGE_VIEWPORT_BLOCKS_MIN,
  scrollTopForPage,
  scrollTopForPageBreak,
} from "./docPagedWriting.js";

describe("docPagedWriting", () => {
  it("page is N viewport blocks tall", () => {
    expect(PAGE_VIEWPORT_BLOCKS).toBe(5);
    expect(PAGE_VIEWPORT_BLOCKS_DEFAULT).toBe(5);
    expect(PAGE_VIEWPORT_BLOCKS_MIN).toBe(4);
    expect(pageHeightFromViewport(400)).toBe(2000);
    expect(lastBlockOffsetInPage(400)).toBe(1600);
    expect(pageHeightFromViewport(0)).toBe(0);
  });

  it("computePageCount floors to at least 1", () => {
    expect(computePageCount(0, 1200)).toBe(1);
    expect(computePageCount(1200, 1200)).toBe(1);
    expect(computePageCount(1201, 1200)).toBe(2);
  });

  it("clampPageIndex stays in range", () => {
    expect(clampPageIndex(-1, 3)).toBe(0);
    expect(clampPageIndex(2, 3)).toBe(2);
    expect(clampPageIndex(9, 3)).toBe(2);
  });

  it("scrollTopForPage and pageIndexFromScrollTop round-trip with fixed 3x pages", () => {
    expect(scrollTopForPage(0, 1200)).toBe(0);
    expect(scrollTopForPage(2, 1200)).toBe(2400);
    expect(pageIndexFromScrollTop(1200, 1200)).toBe(1);
  });

  it("page breaks drive page index and scroll positions", () => {
    const breaks = [0, 900, 1500];
    expect(pageCountFromBreaks(breaks)).toBe(3);
    expect(scrollTopForPageBreak(1, breaks)).toBe(900);
    expect(pageIndexFromBreaks(950, breaks)).toBe(1);
    expect(pageIndexFromBreaks(1499, breaks)).toBe(1);
    expect(pageIndexFromBreaks(1500, breaks)).toBe(2);
  });

  it("maxScrollTopForPage respects variable page spans", () => {
    const breaks = [0, 900, 1500];
    expect(maxScrollTopForPage(0, 400, breaks, 1600)).toBe(500);
    expect(maxScrollTopForPage(1, 400, breaks, 1600)).toBe(1100);
  });

  it("isLastBlockOfPage uses break-based max scroll", () => {
    const breaks = [0, 900];
    expect(isLastBlockOfPage(100, 0, 400, breaks, 1400)).toBe(false);
    expect(isLastBlockOfPage(498, 0, 400, breaks, 1400)).toBe(true);
  });

  it("clampScrollTopToPage keeps scroll inside break-based page window", () => {
    const breaks = [0, 900];
    expect(clampScrollTopToPage(950, 0, 400, 1400, breaks)).toBe(500);
    expect(clampScrollTopToPage(200, 1, 400, 1400, breaks)).toBe(900);
    expect(clampScrollTopToPage(1200, 1, 400, 1400, breaks)).toBe(1000);
  });

  it("fixed fallback clamp still works without breaks", () => {
    expect(clampScrollTopToPage(900, 0, 400, 1400)).toBe(900);
  });
});
