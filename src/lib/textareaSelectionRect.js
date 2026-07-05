export function copyTextareaTypography(textarea, mirror) {
  const style = window.getComputedStyle(textarea);
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.border = style.border;
  mirror.style.font = style.font;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
}

export function getCaretClientRect(textarea, position) {
  const value = textarea.value ?? "";
  const pos = Math.max(0, Math.min(position, value.length));
  const fieldRect = textarea.getBoundingClientRect();

  const mirror = document.createElement("div");
  copyTextareaTypography(textarea, mirror);
  mirror.style.position = "fixed";
  mirror.style.top = `${fieldRect.top}px`;
  mirror.style.left = `${fieldRect.left}px`;
  mirror.style.width = `${fieldRect.width}px`;
  mirror.style.height = `${fieldRect.height}px`;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.zIndex = "-1";

  mirror.textContent = value.slice(0, pos);

  const marker = document.createElement("span");
  marker.textContent = value.slice(pos, pos + 1) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  mirror.scrollTop = textarea.scrollTop;
  const rect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);
  return rect;
}

/** Fixed position for the + button beside a textarea selection end. */
export function resolveTextSelectionToolbarPosition(textarea, selectionStart, selectionEnd) {
  if (!textarea || textarea.tagName !== "TEXTAREA") return null;

  const end = Math.max(selectionStart, selectionEnd);
  const caretRect = getCaretClientRect(textarea, end);
  const fieldRect = textarea.getBoundingClientRect();
  const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 18;
  const btnSize = Math.max(16, Math.min(Math.round(lineHeight), 22));

  let left = caretRect.right + 4;
  let top = caretRect.top + Math.max(0, (lineHeight - btnSize) / 2);

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    left = fieldRect.right + 4;
    top = fieldRect.top + 4;
  }

  if (left + btnSize > window.innerWidth - 8) {
    left = Math.max(8, caretRect.left - btnSize - 4);
  }

  if (top + btnSize > window.innerHeight - 8) {
    top = Math.max(8, fieldRect.top);
  }

  return { left, top, btnSize };
}

/** Position for slash ghost hint immediately after the caret, relative to wrapEl. */
export function resolveSlashGhostOverlayPosition(textarea, wrapEl) {
  if (!textarea?.isConnected || !wrapEl) return null;

  const pos = textarea.selectionStart ?? textarea.value.length;
  const caretRect = getCaretClientRect(textarea, pos);
  const wrapRect = wrapEl.getBoundingClientRect();
  const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 18;

  return {
    left: caretRect.right - wrapRect.left,
    top: caretRect.top - wrapRect.top,
    lineHeight,
  };
}

/**
 * Scrolls only within the doc content area — downward when caret is below viewport.
 */
export function scrollTextareaCaretIntoCameraView(textarea, options = {}) {
  if (!textarea?.isConnected || textarea.tagName !== "TEXTAREA") return;

  const clipPadding = options.clipPadding ?? 20;
  const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
  const pos = textarea.selectionStart ?? textarea.value.length;

  const readCaretRect = () => getCaretClientRect(textarea, pos);
  let caretRect = readCaretRect();

  if (textarea.scrollHeight > textarea.clientHeight) {
    const fieldRect = textarea.getBoundingClientRect();
    const caretBottom = caretRect.top + lineHeight;
    if (caretBottom > fieldRect.bottom - 10) {
      textarea.scrollTop += caretBottom - fieldRect.bottom + 16;
    }
    caretRect = readCaretRect();
  }

  const contentScroll = textarea.closest(".doc-new-content-scroll")
    || textarea.closest(".note-taker__content-scroll")
    || textarea.closest(".node-query-modal__content-scroll");
  if (!contentScroll) return;

  const box = contentScroll.getBoundingClientRect();
  const caretBottom = caretRect.top + lineHeight;
  if (caretBottom > box.bottom - clipPadding) {
    const delta = caretBottom - (box.bottom - clipPadding);
    contentScroll.scrollBy({ top: delta, behavior: "instant" });
  }
}

const WRITING_SCROLL_PARENT_SELECTORS = [
  ".note-taker__content-scroll",
  ".node-query-modal__content-scroll",
];

function findWritingScrollParent(textarea) {
  if (!textarea) return null;
  for (const selector of WRITING_SCROLL_PARENT_SELECTORS) {
    const parent = textarea.closest(selector);
    if (parent) return parent;
  }
  return null;
}

/** Auto-grow textarea height without jumping the outer scroll container. */
export function syncAutoGrowTextareaHeight(textarea) {
  if (!textarea) return;

  const scrollParent = findWritingScrollParent(textarea);
  const parentScrollTop = scrollParent?.scrollTop ?? null;
  const prevParentScrollHeight = scrollParent?.scrollHeight ?? 0;
  const wasPinnedToBottom = scrollParent
    ? parentScrollTop + scrollParent.clientHeight >= prevParentScrollHeight - 2
    : false;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;

  if (!scrollParent || parentScrollTop === null) return;

  if (wasPinnedToBottom) {
    scrollParent.scrollTop = scrollParent.scrollHeight;
    return;
  }

  scrollParent.scrollTop = parentScrollTop;
}

/** Reset inner + outer scroll after a large content deletion. */
export function resetDocOverlayScrollPosition(anchorEl) {
  if (!anchorEl) return;
  const contentScroll = anchorEl.closest(".doc-new-content-scroll");
  if (contentScroll?.scrollTop) contentScroll.scrollTop = 0;
  const lpOverlay = anchorEl.closest(".lp-overlay");
  if (lpOverlay?.scrollTop) lpOverlay.scrollTop = 0;
  const docOverlay = anchorEl.closest(".doc-overlay-global");
  if (docOverlay?.scrollTop) docOverlay.scrollTop = 0;
}
