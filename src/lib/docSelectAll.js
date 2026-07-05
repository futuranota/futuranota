import { DOC_BLOCK_TYPES, normalizeDocBlocks } from "./docBlocks.js";
import {
  findProseUnitForBlockIndex,
  proseSegmentToEditableText,
} from "./docProseUnified.js";

/**
 * Plain-text snapshot of user-facing document content (for copy / select-all).
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {string}
 */
export function collectDocPlainText(blocks) {
  const parts = [];

  for (const block of normalizeDocBlocks(blocks || [])) {
    if (block.type === DOC_BLOCK_TYPES.H1) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(title);
      continue;
    }

    if (block.type === DOC_BLOCK_TYPES.TEXT) {
      const text = String(block.text ?? "").trim();
      if (text) parts.push(text);
      continue;
    }

    if (block.type === DOC_BLOCK_TYPES.TODO) {
      const listTitle = String(block.listTitle ?? "").trim();
      if (listTitle) parts.push(listTitle);
      for (const item of block.items || []) {
        const itemText = String(item?.text ?? "").trim();
        if (itemText) parts.push(`• ${itemText}`);
      }
    }
  }

  return parts.join("\n\n");
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {number}
 */
export function countDocContentBlocks(blocks) {
  let count = 0;

  for (const block of normalizeDocBlocks(blocks || [])) {
    if (block.type === DOC_BLOCK_TYPES.H1 && String(block.title ?? "").trim()) {
      count += 1;
      continue;
    }
    if (block.type === DOC_BLOCK_TYPES.TEXT && String(block.text ?? "").trim()) {
      count += 1;
      continue;
    }
    if (block.type === DOC_BLOCK_TYPES.TODO) {
      const hasTitle = Boolean(String(block.listTitle ?? "").trim());
      const hasItems = (block.items || []).some((item) => String(item?.text ?? "").trim());
      if (hasTitle || hasItems) count += 1;
    }
  }

  return count;
}

const SELECT_ALL_SCROLL_SELECTOR = [
  ".doc-new-content-scroll",
  ".node-query-modal__content-scroll",
  ".note-taker__content-scroll",
].join(", ");

/**
 * @param {HTMLElement} fromEl
 * @returns {HTMLElement|null}
 */
export function findDocContentScrollRoot(fromEl) {
  return fromEl?.closest?.(SELECT_ALL_SCROLL_SELECTOR) ?? null;
}

/**
 * @param {KeyboardEvent} event
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {number}
 */
export function findBlockIndexFromEventTarget(event, blocks) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return -1;
  const item = target.closest("[data-block-id]");
  if (!item) return -1;
  const blockId = item.getAttribute("data-block-id");
  if (!blockId) return -1;
  return normalizeDocBlocks(blocks).findIndex((block) => block.id === blockId);
}

/**
 * Resolve H1 + body (or consecutive TEXT) plain text for the block under focus.
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {number} blockIndex
 * @returns {{ unit: { start: number, end: number }, text: string } | null}
 */
export function resolveProseUnitSelectAll(blocks, blockIndex) {
  if (blockIndex < 0) return null;
  const unit = findProseUnitForBlockIndex(blocks, blockIndex);
  if (!unit || unit.end <= unit.start) return null;

  const text = proseSegmentToEditableText(blocks, unit.start, unit.end);
  if (!text.trim()) return null;

  return { unit, text };
}

/**
 * @param {HTMLElement} containerEl
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {{ start: number, end: number }} unit
 * @returns {{ top: number, left: number, width: number, height: number } | null}
 */
export function getProseUnitOverlayRect(containerEl, blocks, unit) {
  if (!containerEl || !unit) return null;

  const normalized = normalizeDocBlocks(blocks);
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;

  for (let index = unit.start; index <= unit.end; index += 1) {
    const blockId = normalized[index]?.id;
    if (!blockId) continue;
    const itemEl = containerEl.querySelector(`[data-block-id="${blockId}"]`);
    if (!itemEl) continue;
    const rect = itemEl.getBoundingClientRect();
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    bottom = Math.max(bottom, rect.bottom);
    right = Math.max(right, rect.right);
  }

  if (top === Infinity) return null;

  const rootRect = containerEl.getBoundingClientRect();
  return {
    top: top - rootRect.top + containerEl.scrollTop,
    left: left - rootRect.left + containerEl.scrollLeft,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  };
}

/**
 * Select plain text inside a scroll container via a transient textarea (multi-block docs).
 * @param {HTMLElement|null} containerEl
 * @param {string} text
 * @param {{ blocks?: import("./docBlocks.js").DocBlock[], unit?: { start: number, end: number } } | null} [options]
 * @returns {boolean}
 */
export function selectAllDocPlainText(containerEl, text, options = null) {
  const value = String(text ?? "");
  if (!containerEl || !value.trim()) return false;

  containerEl.querySelectorAll("[data-doc-select-all-field]").forEach((node) => {
    node.remove();
  });

  const field = document.createElement("textarea");
  field.dataset.docSelectAllField = "true";
  field.className = "doc-select-all-field";
  field.setAttribute("readonly", "true");
  field.setAttribute("aria-hidden", "true");

  const rect = options?.blocks && options?.unit
    ? getProseUnitOverlayRect(containerEl, options.blocks, options.unit)
    : null;

  if (rect) {
    field.classList.add("doc-select-all-field--prose-unit");
    field.style.top = `${rect.top}px`;
    field.style.left = `${rect.left}px`;
    field.style.width = `${rect.width}px`;
    field.style.height = `${rect.height}px`;
    field.removeAttribute("aria-hidden");
  }

  field.value = value;
  containerEl.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();

  const onBlur = () => {
    field.remove();
  };
  field.addEventListener("blur", onBlur, { once: true });

  return true;
}

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function selectElementTextContents(element) {
  if (!element) return false;
  const selection = window.getSelection?.();
  if (!selection) return false;

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * Cmd/Ctrl+A — select prose unit (H1 + body) or full document when appropriate.
 * @param {KeyboardEvent} event
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {boolean} true when handled
 */
export function tryDocSelectAllKeyDown(event, blocks) {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "a") return false;

  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return false;

  const container = findDocContentScrollRoot(target);
  if (!container) return false;

  const blockIndex = findBlockIndexFromEventTarget(event, blocks);
  const proseUnit = resolveProseUnitSelectAll(blocks, blockIndex);
  if (proseUnit) {
    event.preventDefault();
    return selectAllDocPlainText(container, proseUnit.text, {
      blocks,
      unit: proseUnit.unit,
    });
  }

  const allText = collectDocPlainText(blocks);
  if (!allText.trim()) return false;

  if (countDocContentBlocks(blocks) <= 1) return false;

  event.preventDefault();
  return selectAllDocPlainText(container, allText);
}

/**
 * Select-all from a report/static block or fall back to full document text.
 * @param {HTMLElement} fromEl
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {boolean}
 */
export function requestDocSelectAll(fromEl, blocks) {
  if (!(fromEl instanceof HTMLElement)) return false;

  const blockItem = fromEl.closest("[data-block-id]");
  const blockId = blockItem?.getAttribute("data-block-id");
  const blockIndex = blockId
    ? normalizeDocBlocks(blocks).findIndex((block) => block.id === blockId)
    : -1;
  const proseUnit = resolveProseUnitSelectAll(blocks, blockIndex);
  const container = findDocContentScrollRoot(fromEl);

  if (proseUnit && container) {
    return selectAllDocPlainText(container, proseUnit.text, {
      blocks,
      unit: proseUnit.unit,
    });
  }

  const allText = collectDocPlainText(blocks);
  if (!allText.trim()) return false;

  if (countDocContentBlocks(blocks) <= 1) {
    return selectElementTextContents(fromEl);
  }

  if (!container) return false;
  return selectAllDocPlainText(container, allText);
}
