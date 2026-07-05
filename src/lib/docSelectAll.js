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
 * Select plain text inside a scroll container via a transient textarea (multi-block docs).
 * @param {HTMLElement|null} containerEl
 * @param {string} text
 * @returns {boolean}
 */
export function selectAllDocPlainText(containerEl, text) {
  const value = String(text ?? "");
  if (!containerEl || !value.trim()) return false;

  let field = containerEl.querySelector("[data-doc-select-all-field]");
  if (!field) {
    field = document.createElement("textarea");
    field.dataset.docSelectAllField = "true";
    field.className = "doc-select-all-field";
    field.setAttribute("readonly", "true");
    field.setAttribute("aria-hidden", "true");
    containerEl.appendChild(field);
  }

  field.value = value;
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
  if (blockIndex >= 0) {
    const unit = findProseUnitForBlockIndex(blocks, blockIndex);
    if (unit && unit.end > unit.start) {
      const unitText = proseSegmentToEditableText(blocks, unit.start, unit.end);
      if (unitText.trim()) {
        event.preventDefault();
        return selectAllDocPlainText(container, unitText);
      }
    }
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

  const allText = collectDocPlainText(blocks);
  if (!allText.trim()) return false;

  if (countDocContentBlocks(blocks) <= 1) {
    return selectElementTextContents(fromEl);
  }

  const container = findDocContentScrollRoot(fromEl);
  if (!container) return false;
  return selectAllDocPlainText(container, allText);
}
