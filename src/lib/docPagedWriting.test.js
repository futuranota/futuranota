import { describe, expect, it } from "vitest";
import {
  clampPageIndex,
  clampScrollTopToPage,
  computePageCount,
  isSecondBlockOfPage,
  maxScrollTopForPage,
  pageHeightFromViewport,
  pageIndexForContentOffset,
  pageIndexFromScrollTop,
  PAGE_VIEWPORT_BLOCKS,
  scrollTopForPage,
} from "./docPagedWriting.js";

describe("docPagedWriting", () => {
  it("page is N viewport blocks tall", () => {
    expect(PAGE_VIEWPORT_BLOCKS).toBe(2);
    expect(pageHeightFromViewport(400)).toBe(800);
    expect(pageHeightFromViewport(0)).toBe(0);
  });

  it("computePageCount floors to at least 1", () => {
    expect(computePageCount(0, 800)).toBe(1);
    expect(computePageCount(100, 800)).toBe(1);
    expect(computePageCount(800, 800)).toBe(1);
    expect(computePageCount(801, 800)).toBe(2);
    expect(computePageCount(2400, 800)).toBe(3);
  });

  it("computePageCount guards bad pageHeight", () => {
    expect(computePageCount(800, 0)).toBe(1);
    expect(computePageCount(800, -10)).toBe(1);
  });

  it("clampPageIndex stays in range", () => {
    expect(clampPageIndex(-1, 3)).toBe(0);
    expect(clampPageIndex(0, 3)).toBe(0);
    expect(clampPageIndex(2, 3)).toBe(2);
    expect(clampPageIndex(9, 3)).toBe(2);
  });

  it("scrollTopForPage and pageIndexFromScrollTop round-trip with 2x pages", () => {
    expect(scrollTopForPage(0, 800)).toBe(0);
    expect(scrollTopForPage(2, 800)).toBe(1600);
    expect(pageIndexFromScrollTop(0, 800)).toBe(0);
    expect(pageIndexFromScrollTop(799, 800)).toBe(0);
    expect(pageIndexFromScrollTop(800, 800)).toBe(1);
  });

  it("pageIndexForContentOffset maps caret Y into pages", () => {
    expect(pageIndexForContentOffset(0, 800)).toBe(0);
    expect(pageIndexForContentOffset(799, 800)).toBe(0);
    expect(pageIndexForContentOffset(800, 800)).toBe(1);
  });

  it("second block is the second viewport within the page", () => {
    expect(isSecondBlockOfPage(0, 0, 400)).toBe(false);
    expect(isSecondBlockOfPage(399, 0, 400)).toBe(false);
    expect(isSecondBlockOfPage(400, 0, 400)).toBe(true);
    expect(isSecondBlockOfPage(800, 1, 400)).toBe(false);
    expect(isSecondBlockOfPage(1200, 1, 400)).toBe(true);
    expect(maxScrollTopForPage(0, 400)).toBe(400);
    expect(maxScrollTopForPage(1, 400)).toBe(1200);
  });

  it("clampScrollTopToPage keeps scroll inside the page window", () => {
    expect(clampScrollTopToPage(-10, 0, 400)).toBe(0);
    expect(clampScrollTopToPage(200, 0, 400)).toBe(200);
    expect(clampScrollTopToPage(900, 0, 400)).toBe(400);
    expect(clampScrollTopToPage(1000, 1, 400)).toBe(1000);
    expect(clampScrollTopToPage(2000, 1, 400)).toBe(1200);
    expect(clampScrollTopToPage(700, 1, 400)).toBe(800);
    expect(clampScrollTopToPage(500, 0, 400, 500)).toBe(100);
  });
});
