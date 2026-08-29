/**
 * Visual page windowing for document writing (layout only — does not split corpus).
 *
 * Pages are defined by `pageBreaks[]` (scrollTop where each page starts).
 * When no breaks are supplied, falls back to fixed N× viewport slices.
 */

/** Default viewport-heights per page when estimating ideal page count. */
export const PAGE_VIEWPORT_BLOCKS_DEFAULT = 5;

/** Minimum viewport-heights per page (generous floor vs legacy 3×). */
export const PAGE_VIEWPORT_BLOCKS_MIN = 4;

/** @deprecated Use PAGE_VIEWPORT_BLOCKS_DEFAULT — kept for tests/fallback. */
export const PAGE_VIEWPORT_BLOCKS = PAGE_VIEWPORT_BLOCKS_DEFAULT;

/** @type {WeakMap<HTMLElement, { pageBreaks: number[], contentHeight: number }>} */
const layoutByScrollEl = new WeakMap();

/**
 * @param {HTMLElement | null | undefined} scrollEl
 * @param {{ pageBreaks: number[], contentHeight?: number } | null} layout
 */
export function setPagedScrollLayout(scrollEl, layout) {
  if (!scrollEl) return;
  if (!layout?.pageBreaks?.length) {
    layoutByScrollEl.delete(scrollEl);
    return;
  }
  layoutByScrollEl.set(scrollEl, {
    pageBreaks: normalizePageBreaks(layout.pageBreaks),
    contentHeight: Math.max(0, Number(layout.contentHeight) || 0),
  });
}

/**
 * @param {HTMLElement | null | undefined} scrollEl
 * @returns {{ pageBreaks: number[], contentHeight: number } | null}
 */
export function getPagedScrollLayout(scrollEl) {
  if (!scrollEl) return null;
  return layoutByScrollEl.get(scrollEl) || null;
}

/** @param {number} viewportHeight */
export function pageHeightFromViewport(viewportHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  return vh * PAGE_VIEWPORT_BLOCKS_DEFAULT;
}

/** @param {number[]} breaks */
export function normalizePageBreaks(breaks) {
  const sorted = [...new Set(
    (Array.isArray(breaks) ? breaks : [])
      .map((n) => Math.max(0, Math.round(Number(n) || 0))),
  )].sort((a, b) => a - b);
  if (!sorted.length || sorted[0] !== 0) sorted.unshift(0);
  return sorted;
}

/** @param {number[] | null | undefined} pageBreaks */
export function pageCountFromBreaks(pageBreaks) {
  const breaks = normalizePageBreaks(pageBreaks || [0]);
  return Math.max(1, breaks.length);
}

/** @param {number} contentHeight @param {number} pageHeight */
export function computePageCount(contentHeight, pageHeight) {
  const ph = Number(pageHeight) || 0;
  const ch = Math.max(0, Number(contentHeight) || 0);
  if (ph <= 0) return 1;
  return Math.max(1, Math.ceil(ch / ph));
}

/** @param {number} pageIndex @param {number} pageCount */
export function clampPageIndex(pageIndex, pageCount) {
  const count = Math.max(1, pageCount | 0);
  const idx = pageIndex | 0;
  return Math.max(0, Math.min(idx, count - 1));
}

/**
 * @param {number} scrollTop
 * @param {number[] | null | undefined} pageBreaks
 */
export function pageIndexFromBreaks(scrollTop, pageBreaks) {
  const breaks = normalizePageBreaks(pageBreaks || [0]);
  const top = Math.max(0, Number(scrollTop) || 0);
  let idx = 0;
  for (let i = 0; i < breaks.length; i += 1) {
    if (breaks[i] <= top) idx = i;
    else break;
  }
  return idx;
}

/**
 * @param {number} offsetY
 * @param {number[] | null | undefined} pageBreaks
 */
export function pageIndexForContentOffset(offsetY, pageBreaks) {
  return pageIndexFromBreaks(offsetY, pageBreaks);
}

/** @param {number} pageIndex @param {number[] | null | undefined} pageBreaks */
export function scrollTopForPageBreak(pageIndex, pageBreaks) {
  const breaks = normalizePageBreaks(pageBreaks || [0]);
  const idx = clampPageIndex(pageIndex, breaks.length);
  return breaks[idx] ?? 0;
}

/**
 * Content Y where page ends (start of next page or EOF).
 * @param {number} pageIndex
 * @param {number[] | null | undefined} pageBreaks
 * @param {number} contentHeight
 */
export function pageEndForBreak(pageIndex, pageBreaks, contentHeight) {
  const breaks = normalizePageBreaks(pageBreaks || [0]);
  const idx = clampPageIndex(pageIndex, breaks.length);
  const next = breaks[idx + 1];
  if (next != null) return next;
  return Math.max(breaks[idx], Math.max(0, Number(contentHeight) || 0));
}

/** Legacy fixed-height helpers (tests + fallback). */
export function scrollTopForPage(pageIndex, pageHeight) {
  const ph = Math.max(0, Number(pageHeight) || 0);
  return Math.max(0, pageIndex | 0) * ph;
}

export function pageIndexFromScrollTop(scrollTop, pageHeight) {
  const ph = Number(pageHeight) || 0;
  if (ph <= 0) return 0;
  return Math.floor(Math.max(0, Number(scrollTop) || 0) / ph);
}

export function pageIndexForContentOffsetFixed(offsetY, pageHeight) {
  return pageIndexFromScrollTop(offsetY, pageHeight);
}

export function lastBlockOffsetInPage(viewportHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  return vh * Math.max(0, PAGE_VIEWPORT_BLOCKS_DEFAULT - 1);
}

/**
 * Max scrollTop while viewing the bottom of the current page.
 * @param {number} pageIndex
 * @param {number} viewportHeight
 * @param {number[] | null | undefined} [pageBreaks]
 * @param {number} [contentHeight]
 */
export function maxScrollTopForPage(pageIndex, viewportHeight, pageBreaks, contentHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  if (vh <= 0) return 0;

  if (pageBreaks?.length) {
    const breaks = normalizePageBreaks(pageBreaks);
    const idx = clampPageIndex(pageIndex, breaks.length);
    const pageStart = breaks[idx] ?? 0;
    const pageEnd = pageEndForBreak(idx, breaks, contentHeight ?? 0);
    const pageSpan = Math.max(vh, pageEnd - pageStart);
    let maxScroll = pageStart + Math.max(0, pageSpan - vh);
    if (contentHeight != null && contentHeight > 0) {
      maxScroll = Math.min(maxScroll, Math.max(pageStart, contentHeight - vh));
    }
    return Math.max(pageStart, maxScroll);
  }

  const pageStart = scrollTopForPage(pageIndex, pageHeightFromViewport(vh));
  return pageStart + lastBlockOffsetInPage(vh);
}

/**
 * @param {number} scrollTop
 * @param {number} pageIndex
 * @param {number} viewportHeight
 * @param {number[] | null | undefined} [pageBreaks]
 * @param {number} [contentHeight]
 */
export function isLastBlockOfPage(
  scrollTop,
  pageIndex,
  viewportHeight,
  pageBreaks,
  contentHeight,
) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  if (vh <= 0) return false;
  const maxTop = maxScrollTopForPage(
    pageIndex,
    viewportHeight,
    pageBreaks,
    contentHeight,
  );
  return Math.max(0, Number(scrollTop) || 0) >= maxTop - 2;
}

/**
 * @param {number} scrollTop
 * @param {number} pageIndex
 * @param {number} viewportHeight
 * @param {number} [contentHeight]
 * @param {number[] | null | undefined} [pageBreaks]
 */
export function clampScrollTopToPage(
  scrollTop,
  pageIndex,
  viewportHeight,
  contentHeight,
  pageBreaks,
) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  const top = Number(scrollTop) || 0;

  if (pageBreaks?.length) {
    const breaks = normalizePageBreaks(pageBreaks);
    const idx = clampPageIndex(pageIndex, breaks.length);
    const pageStart = breaks[idx] ?? 0;
    const maxScroll = maxScrollTopForPage(idx, vh, breaks, contentHeight);
    return Math.max(pageStart, Math.min(top, maxScroll));
  }

  const pageStart = scrollTopForPage(pageIndex, pageHeightFromViewport(vh));
  let maxScroll = maxScrollTopForPage(pageIndex, vh);
  if (contentHeight != null && contentHeight > 0 && vh > 0) {
    maxScroll = Math.min(maxScroll, Math.max(0, contentHeight - vh));
  }
  maxScroll = Math.max(pageStart, maxScroll);
  return Math.max(pageStart, Math.min(top, maxScroll));
}

/**
 * @param {HTMLElement} scrollEl
 * @param {number} pageIndex
 * @param {number} viewportHeight
 * @param {number} [pageCount]
 * @param {number[] | null | undefined} [pageBreaks]
 */
export function applyPagedScrollTop(
  scrollEl,
  pageIndex,
  viewportHeight,
  pageCount,
  pageBreaks,
) {
  if (!scrollEl) return 0;

  if (pageBreaks?.length) {
    const breaks = normalizePageBreaks(pageBreaks);
    const count = pageCount != null
      ? Math.max(1, pageCount | 0)
      : breaks.length;
    const idx = clampPageIndex(pageIndex, count);
    const top = scrollTopForPageBreak(idx, breaks);
    if (scrollEl.scrollTop !== top) scrollEl.scrollTop = top;
    return idx;
  }

  const pageHeight = pageHeightFromViewport(viewportHeight);
  const count = pageCount != null
    ? Math.max(1, pageCount | 0)
    : computePageCount(scrollEl.scrollHeight, pageHeight);
  const idx = clampPageIndex(pageIndex, count);
  const top = scrollTopForPage(idx, pageHeight);
  if (scrollEl.scrollTop !== top) scrollEl.scrollTop = top;
  return idx;
}

export const DOC_PAGED_SCROLL_CLASS = "node-query-modal__content-scroll--paged";
export const DOC_PAGED_PAGER_SCROLL_CLASS = "node-query-modal__content-scroll--paged-pager";
export const DOC_PAGED_CHANGE_EVENT = "docpagedchange";
