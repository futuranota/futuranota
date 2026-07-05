import { DOC_BLOCK_TYPES, normalizeDocBlocks } from "./docBlocks.js";
import { collectCopyableDocPlainText, isCopyableDocTextBlock } from "./docProseUnified.js";
import { copyTextareaTypography } from "./textareaSelectionRect.js";

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

const INPLACE_SELECT_ACTIVE = "data-doc-inplace-select-active";
const BLOCK_SELECTED_CLASS = "doc-block-stack__item--doc-selected";
const MIRROR_ATTR = "data-doc-inplace-select-mirror";

/** @type {WeakMap<HTMLElement, () => void>} */
const inplaceSelectCleanups = new WeakMap();

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
 * @param {HTMLElement} field
 * @returns {boolean}
 */
export function isTextFieldFullySelected(field) {
  if (!field || typeof field !== "object") return false;
  const { value, selectionStart, selectionEnd } = field;
  if (typeof selectionStart !== "number" || typeof selectionEnd !== "number") return false;
  const length = String(value ?? "").length;
  if (length === 0) return true;
  return selectionStart === 0 && selectionEnd === length;
}

/**
 * @param {import("./docBlocks.js").DocBlock | undefined} block
 * @returns {boolean}
 */
export function isDocSelectAllProseField(block) {
  return block?.type === DOC_BLOCK_TYPES.H1 || block?.type === DOC_BLOCK_TYPES.TEXT;
}

/**
 * @param {HTMLElement|null} containerEl
 */
export function clearDocInPlaceSelectAll(containerEl) {
  if (!containerEl) return;

  const cleanup = inplaceSelectCleanups.get(containerEl);
  if (cleanup) {
    cleanup();
    inplaceSelectCleanups.delete(containerEl);
  }

  delete containerEl.dataset.docInplaceSelectActive;
  containerEl.querySelectorAll(`.${BLOCK_SELECTED_CLASS}`).forEach((node) => {
    node.classList.remove(BLOCK_SELECTED_CLASS);
  });
  containerEl.querySelectorAll(".doc-inplace-select-wrap").forEach((node) => {
    node.classList.remove("doc-inplace-select-wrap");
  });
  containerEl.querySelectorAll(".doc-inplace-select-all__input").forEach((node) => {
    node.classList.remove("doc-inplace-select-all__input");
  });
  containerEl.querySelectorAll(`[${MIRROR_ATTR}]`).forEach((node) => {
    node.remove();
  });
}

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} mirror
 */
function syncInPlaceSelectMirror(textarea, mirror) {
  copyTextareaTypography(textarea, mirror);
  mirror.scrollTop = textarea.scrollTop;
  const textNode = mirror.querySelector(".doc-inplace-select-mirror__text");
  if (textNode) {
    textNode.textContent = textarea.value ?? "";
  }
}

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} wrap
 * @returns {HTMLElement}
 */
function createInPlaceSelectMirror(textarea, wrap) {
  const mirror = document.createElement("div");
  mirror.setAttribute(MIRROR_ATTR, "true");
  mirror.className = "doc-inplace-select-mirror";
  mirror.setAttribute("aria-hidden", "true");

  const textNode = document.createElement("span");
  textNode.className = "doc-inplace-select-mirror__text";
  textNode.textContent = textarea.value ?? "";
  mirror.appendChild(textNode);

  wrap.classList.add("doc-inplace-select-wrap");
  wrap.appendChild(mirror);
  syncInPlaceSelectMirror(textarea, mirror);
  return mirror;
}

/**
 * Highlight copyable blocks in place (mirrors over each textarea) for document-wide select.
 * @param {HTMLElement|null} containerEl
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {HTMLElement|null} [anchorField]
 * @returns {boolean}
 */
export function activateDocInPlaceSelectAll(containerEl, blocks, anchorField = null) {
  const copyableText = collectCopyableDocPlainText(blocks);
  if (!containerEl || !copyableText.trim()) return false;

  clearDocInPlaceSelectAll(containerEl);
  containerEl.dataset.docInplaceSelectActive = "true";

  const normalized = normalizeDocBlocks(blocks);
  /** @type {{ textarea: HTMLTextAreaElement, mirror: HTMLElement | null, wrap: HTMLElement | null }[]} */
  const tracked = [];

  normalized.forEach((block, index) => {
    if (!isCopyableDocTextBlock(normalized, index)) return;

    const item = containerEl.querySelector(`[data-block-id="${block.id}"]`);
    if (!item) return;

    item.classList.add(BLOCK_SELECTED_CLASS);
    const textarea = item.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    const length = textarea.value?.length ?? 0;
    textarea.setSelectionRange(0, length);
    textarea.classList.add("doc-inplace-select-all__input");

    let mirror = null;
    let wrap = null;
    if (length > 0) {
      wrap = textarea.closest(".doc-slash-field");
      if (wrap instanceof HTMLElement) {
        mirror = createInPlaceSelectMirror(textarea, wrap);
      }
    }

    tracked.push({ textarea, mirror, wrap });
  });

  if (anchorField instanceof HTMLElement) {
    anchorField.focus({ preventScroll: true });
  } else {
    tracked[0]?.textarea.focus({ preventScroll: true });
  }

  const onCopy = (event) => {
    if (containerEl.dataset.docInplaceSelectActive !== "true") return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", copyableText);
  };

  const onKeyDown = (event) => {
    if (containerEl.dataset.docInplaceSelectActive !== "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      clearDocInPlaceSelectAll(containerEl);
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      clearDocInPlaceSelectAll(containerEl);
    }
  };

  const onMouseDown = (event) => {
    if (containerEl.dataset.docInplaceSelectActive !== "true") return;
    if (event.target instanceof HTMLTextAreaElement) {
      clearDocInPlaceSelectAll(containerEl);
    }
  };

  const onScroll = () => {
    tracked.forEach(({ textarea, mirror }) => {
      if (mirror) syncInPlaceSelectMirror(textarea, mirror);
    });
  };

  const resizeObservers = tracked
    .filter(({ textarea }) => textarea.isConnected)
    .map(({ textarea, mirror }) => {
      if (!mirror || typeof ResizeObserver === "undefined") return null;
      const observer = new ResizeObserver(() => {
        syncInPlaceSelectMirror(textarea, mirror);
      });
      observer.observe(textarea);
      if (textarea.parentElement) observer.observe(textarea.parentElement);
      return observer;
    })
    .filter(Boolean);

  tracked.forEach(({ textarea, mirror }) => {
    if (!mirror) return;
    textarea.addEventListener("scroll", onScroll, { passive: true });
  });

  containerEl.addEventListener("copy", onCopy);
  containerEl.addEventListener("keydown", onKeyDown);
  containerEl.addEventListener("mousedown", onMouseDown, true);
  containerEl.addEventListener("scroll", onScroll, { passive: true, capture: true });

  inplaceSelectCleanups.set(containerEl, () => {
    containerEl.removeEventListener("copy", onCopy);
    containerEl.removeEventListener("keydown", onKeyDown);
    containerEl.removeEventListener("mousedown", onMouseDown, true);
    containerEl.removeEventListener("scroll", onScroll, true);
    tracked.forEach(({ textarea }) => {
      textarea.removeEventListener("scroll", onScroll);
    });
    resizeObservers.forEach((observer) => observer.disconnect());
  });

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
 * Cmd/Ctrl+A in prose fields — 1× native block select, 2× in-document copyable text.
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

  if (container.dataset.docInplaceSelectActive === "true") {
    event.preventDefault();
    return true;
  }

  const blockIndex = findBlockIndexFromEventTarget(event, blocks);
  const block = normalizeDocBlocks(blocks)[blockIndex];
  if (!isDocSelectAllProseField(block)) return false;

  if (!isTextFieldFullySelected(target)) return false;

  const copyableText = collectCopyableDocPlainText(blocks);
  if (!copyableText.trim()) return false;

  event.preventDefault();
  event.stopPropagation();
  return activateDocInPlaceSelectAll(container, blocks, target);
}

/**
 * Select-all from a report/static block or fall back to full document text.
 * @param {HTMLElement} fromEl
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {boolean}
 */
export function requestDocSelectAll(fromEl, blocks) {
  if (!(fromEl instanceof HTMLElement)) return false;

  const copyableText = collectCopyableDocPlainText(blocks);
  if (!copyableText.trim()) {
    return selectElementTextContents(fromEl);
  }

  const container = findDocContentScrollRoot(fromEl);
  if (!container) return false;
  const anchor = fromEl.closest("[data-block-id]")?.querySelector("textarea");
  return activateDocInPlaceSelectAll(
    container,
    blocks,
    anchor instanceof HTMLTextAreaElement ? anchor : fromEl,
  );
}

export { collectCopyableDocPlainText, isCopyableDocTextBlock } from "./docProseUnified.js";
