/**
 * Block-aware page breaks for paged writing (layout only — does not mutate blocks).
 *
 * Every writing block (text cells + widgets) stays whole — no mid-cell cuts.
 */

import { PAGE_VIEWPORT_BLOCKS_DEFAULT, PAGE_VIEWPORT_BLOCKS_MIN } from "./docPagedWriting.js";

/** All stack blocks are atomic for paging (text cells behave like cards). */
export function isAtomicWritingBlockType(_type) {
  return true;
}

const WRITING_BLOCK_CLASS_TO_TYPE = [
  ["node-writing-block-stack__moodboard", "moodboard"],
  ["node-writing-block-stack__banner", "banner"],
  ["node-writing-block-stack__image-split", "image_split"],
  ["node-writing-block-stack__image", "image"],
  ["node-writing-block-stack__product", "product_card"],
  ["node-writing-block-stack__steps", "step_sequence"],
  ["node-writing-block-stack__agent", "agent"],
  ["node-writing-block-stack__vault", "password_vault"],
  ["node-writing-block-stack__todo", "todo"],
  ["node-writing-block-stack__code", "code"],
  ["node-writing-block-stack__h1", "h1"],
  ["node-writing-block-stack__h2", "h2"],
  ["node-writing-block-stack__h3", "h3"],
  ["node-writing-block-stack__text", "text"],
];

/**
 * @param {Element | null | undefined} el
 * @returns {string}
 */
export function inferWritingBlockTypeFromElement(el) {
  if (!el?.classList) return "text";
  for (const [className, type] of WRITING_BLOCK_CLASS_TO_TYPE) {
    if (el.classList.contains(className)) return type;
  }
  return "text";
}

/**
 * @typedef {{ id: string, type: string, top: number, height: number, bottom: number, atomic: boolean }} MeasuredWritingBlock
 */

/**
 * Measure visible writing blocks inside a scroll container.
 * @param {HTMLElement | null | undefined} scrollRoot
 * @returns {MeasuredWritingBlock[]}
 */
export function measureWritingBlockRects(scrollRoot) {
  if (!scrollRoot?.querySelectorAll) return [];
  const scrollRect = scrollRoot.getBoundingClientRect();
  const scrollTop = scrollRoot.scrollTop;
  /** @type {MeasuredWritingBlock[]} */
  const out = [];

  scrollRoot.querySelectorAll("[data-writing-block-id]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const id = el.getAttribute("data-writing-block-id");
    if (!id) return;
    const type = inferWritingBlockTypeFromElement(el);
    const rect = el.getBoundingClientRect();
    const top = Math.max(0, Math.round(rect.top - scrollRect.top + scrollTop));
    const height = Math.max(0, Math.round(el.offsetHeight || rect.height || 0));
    if (height <= 0) return;
    out.push({
      id,
      type,
      top,
      height,
      bottom: top + height,
      atomic: true,
    });
  });

  return out.sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));
}

/**
 * @param {number[]} breaks
 * @returns {number[]}
 */
export function normalizePageBreaks(breaks) {
  const sorted = [...new Set(
    (Array.isArray(breaks) ? breaks : [])
      .map((n) => Math.max(0, Math.round(Number(n) || 0))),
  )].sort((a, b) => a - b);
  if (!sorted.length || sorted[0] !== 0) sorted.unshift(0);
  return sorted;
}

/**
 * Content height from measured blocks.
 * @param {MeasuredWritingBlock[]} blocks
 */
export function contentHeightFromBlocks(blocks) {
  if (!blocks.length) return 0;
  return Math.max(...blocks.map((b) => b.bottom));
}

/**
 * Adaptive page capacity: scales with document size (more content → more pages,
 * but each page is generously sized vs the old fixed 3× viewport).
 *
 * @param {MeasuredWritingBlock[]} blocks
 * @param {number} viewportHeight
 */
export function resolveAdaptiveTargetViewportBlocks(blocks, viewportHeight) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  if (!blocks.length || vh <= 0) return PAGE_VIEWPORT_BLOCKS_MIN;

  const contentHeight = contentHeightFromBlocks(blocks);
  const idealPages = Math.max(
    1,
    Math.ceil(contentHeight / (vh * PAGE_VIEWPORT_BLOCKS_DEFAULT)),
  );
  let targetBlocks = Math.max(
    PAGE_VIEWPORT_BLOCKS_MIN,
    contentHeight / (idealPages * vh),
  );

  let breaks = buildBlockAwarePageBreaks(blocks, vh, targetBlocks);
  let guard = 0;
  while (breaks.length > idealPages && guard < 10) {
    targetBlocks *= 1.12;
    breaks = buildBlockAwarePageBreaks(blocks, vh, targetBlocks);
    guard += 1;
  }

  return targetBlocks;
}

/**
 * Pack measured blocks into pages. Every block stays whole.
 *
 * @param {MeasuredWritingBlock[]} blocks
 * @param {number} viewportHeight
 * @param {number} [targetViewportBlocks]
 * @returns {number[]}
 */
export function buildBlockAwarePageBreaks(
  blocks,
  viewportHeight,
  targetViewportBlocks = PAGE_VIEWPORT_BLOCKS_DEFAULT,
) {
  const vh = Math.max(0, Number(viewportHeight) || 0);
  const targetH = vh * Math.max(1, targetViewportBlocks);
  if (!blocks.length || vh <= 0) return [0];

  /** @type {number[]} */
  const breaks = [0];
  let usedOnPage = 0;

  const pushBreak = (top) => {
    const t = Math.max(0, Math.round(top));
    if (breaks[breaks.length - 1] !== t) breaks.push(t);
    usedOnPage = 0;
  };

  for (const block of blocks) {
    const { top, height } = block;
    if (height <= 0) continue;

    if (usedOnPage > 0 && usedOnPage + height > targetH) {
      pushBreak(top);
    }
    usedOnPage += height;
    if (height >= targetH) {
      usedOnPage = targetH;
    }
  }

  return normalizePageBreaks(breaks);
}

/**
 * @param {HTMLElement | null | undefined} scrollRoot
 * @param {number} viewportHeight
 * @returns {{ pageBreaks: number[], measuredBlocks: MeasuredWritingBlock[], targetViewportBlocks: number }}
 */
export function buildPagedLayoutFromScrollRoot(scrollRoot, viewportHeight) {
  const measuredBlocks = measureWritingBlockRects(scrollRoot);
  const targetViewportBlocks = resolveAdaptiveTargetViewportBlocks(
    measuredBlocks,
    viewportHeight,
  );
  const pageBreaks = buildBlockAwarePageBreaks(
    measuredBlocks,
    viewportHeight,
    targetViewportBlocks,
  );
  return { pageBreaks, measuredBlocks, targetViewportBlocks };
}
