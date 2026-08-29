/**
 * Visual page windowing for document writing (layout only — does not split corpus).
 *
 * One page = PAGE_VIEWPORT_BLOCKS × visible viewport height.
 * Within a page the user may scroll across those blocks; pager chrome is for
 * crossing pages (and typically appears once the second block is in view).
 */

/** How many viewport-heights make one logical page. */
export const PAGE_VIEWPORT_BLOCKS = 2;

/** @param {number} viewportHeight */
export function pageHeightFromViewport(viewportHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  return vh * PAGE_VIEWPORT_BLOCKS;
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

/** @param {number} pageIndex @param {number} pageHeight */
export function scrollTopForPage(pageIndex, pageHeight) {
  const ph = Math.max(0, Number(pageHeight) || 0);
  return Math.max(0, pageIndex | 0) * ph;
}

/** @param {number} scrollTop @param {number} pageHeight */
export function pageIndexFromScrollTop(scrollTop, pageHeight) {
  const ph = Number(pageHeight) || 0;
  if (ph <= 0) return 0;
  return Math.floor(Math.max(0, Number(scrollTop) || 0) / ph);
}

/**
 * Page that contains a Y offset measured from the top of the content stack.
 * @param {number} offsetY
 * @param {number} pageHeight
 */
export function pageIndexForContentOffset(offsetY, pageHeight) {
  const ph = Number(pageHeight) || 0;
  if (ph <= 0) return 0;
  return Math.floor(Math.max(0, Number(offsetY) || 0) / ph);
}

/**
 * Max scrollTop while staying on `pageIndex` (viewing the last viewport-block).
 * @param {number} pageIndex
 * @param {number} viewportHeight
 */
export function maxScrollTopForPage(pageIndex, viewportHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  const pageStart = scrollTopForPage(pageIndex, pageHeightFromViewport(vh));
  return pageStart + vh;
}

/**
 * True when scroll position is on the second (or later) viewport-block of the page.
 * @param {number} scrollTop
 * @param {number} pageIndex
 * @param {number} viewportHeight
 */
export function isSecondBlockOfPage(scrollTop, pageIndex, viewportHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  if (vh <= 0) return false;
  const pageStart = scrollTopForPage(pageIndex, pageHeightFromViewport(vh));
  return Math.max(0, Number(scrollTop) || 0) - pageStart >= vh;
}

/**
 * Clamp scrollTop to the scrollable range of the current page (block 1 → block 2).
 * @param {number} scrollTop
 * @param {number} pageIndex
 * @param {number} viewportHeight
 * @param {number} [contentHeight]
 */
export function clampScrollTopToPage(scrollTop, pageIndex, viewportHeight, contentHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  const pageStart = scrollTopForPage(pageIndex, pageHeightFromViewport(vh));
  let maxScroll = maxScrollTopForPage(pageIndex, vh);
  if (contentHeight != null && contentHeight > 0 && vh > 0) {
    maxScroll = Math.min(maxScroll, Math.max(0, contentHeight - vh));
  }
  maxScroll = Math.max(pageStart, maxScroll);
  const top = Number(scrollTop) || 0;
  return Math.max(pageStart, Math.min(top, maxScroll));
}

/**
 * Jump to the start of a page (block 1) and return the clamped index.
 * @param {HTMLElement} scrollEl
 * @param {number} pageIndex
 * @param {number} viewportHeight
 * @param {number} [pageCount]
 */
export function applyPagedScrollTop(scrollEl, pageIndex, viewportHeight, pageCount) {
  if (!scrollEl) return 0;
  const pageHeight = pageHeightFromViewport(viewportHeight);
  const count = pageCount != null
    ? Math.max(1, pageCount | 0)
    : computePageCount(scrollEl.scrollHeight, pageHeight);
  const idx = clampPageIndex(pageIndex, count);
  const top = scrollTopForPage(idx, pageHeight);
  if (scrollEl.scrollTop !== top) {
    scrollEl.scrollTop = top;
  }
  return idx;
}

export const DOC_PAGED_SCROLL_CLASS = "node-query-modal__content-scroll--paged";
export const DOC_PAGED_CHANGE_EVENT = "docpagedchange";
