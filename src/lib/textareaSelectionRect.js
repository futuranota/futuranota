import {
  maxScrollTopForPage,
  pageHeightFromViewport,
  pageIndexFromBreaks,
  pageIndexFromScrollTop,
  scrollTopForPage,
  scrollTopForPageBreak,
  getPagedScrollLayout,
} from "./docPagedWriting.js";

export function copyTextareaTypography(textarea, mirror) {
  const style = window.getComputedStyle(textarea);
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.border = style.border;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.fontOpticalSizing = style.fontOpticalSizing || "";
  mirror.style.fontKerning = style.fontKerning;
  mirror.style.textIndent = style.textIndent;
  mirror.style.padding = style.padding;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = style.wordBreak || "break-word";
  mirror.style.overflowWrap = style.overflowWrap || "break-word";
  mirror.style.wordWrap = "break-word";
  mirror.style.tabSize = style.tabSize;
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

export function readTextareaSelection(el) {
  if (!el || el.tagName !== "TEXTAREA") return null;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) return null;

  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const selected = (el.value ?? "").slice(lo, hi);
  if (!selected.trim()) return null;

  return { start: lo, end: hi };
}

/** Default dimensions aligned with `.doc-tag-command-picker` in left-panel.css */
export const FLOATING_MENU_DEFAULT_WIDTH = 320;
export const FLOATING_MENU_DEFAULT_MAX_HEIGHT = 360;
export const FLOATING_MENU_GAP = 6;
export const FLOATING_MENU_VIEWPORT_PAD = 12;

/**
 * Chooses above/below placement for @ pickers and command menus.
 * When opening above, uses translateY(-100%) so content grows upward from the caret.
 *
 * @param {DOMRect|{ top: number, bottom: number, left: number, right?: number }} caretRect
 * @param {{
 *   width?: number,
 *   maxHeight?: number,
 *   gap?: number,
 *   pad?: number,
 *   viewportWidth?: number,
 *   viewportHeight?: number,
 * }} [options]
 * @returns {{
 *   top: number,
 *   left: number,
 *   placement: "above"|"below",
 *   transform?: string,
 *   maxHeight: number,
 * }}
 */
export function resolveFloatingMenuAnchor(caretRect, options = {}) {
  const width = options.width ?? FLOATING_MENU_DEFAULT_WIDTH;
  const maxHeight = options.maxHeight ?? FLOATING_MENU_DEFAULT_MAX_HEIGHT;
  const gap = options.gap ?? FLOATING_MENU_GAP;
  const pad = options.pad ?? FLOATING_MENU_VIEWPORT_PAD;
  const viewportWidth = options.viewportWidth
    ?? (typeof window !== "undefined" ? window.innerWidth : width + pad * 2);
  const viewportHeight = options.viewportHeight
    ?? (typeof window !== "undefined" ? window.innerHeight : maxHeight + pad * 2);

  const effectiveMaxHeight = Math.min(maxHeight, Math.max(120, viewportHeight - pad * 2));

  const spaceBelow = viewportHeight - pad - (caretRect.bottom + gap);
  const spaceAbove = caretRect.top - gap - pad;
  const openBelow = spaceBelow >= effectiveMaxHeight || spaceBelow >= spaceAbove;

  let top;
  let placement;
  let transform;

  if (openBelow) {
    placement = "below";
    top = caretRect.bottom + gap;
    const overflow = top + effectiveMaxHeight - (viewportHeight - pad);
    if (overflow > 0) {
      top = Math.max(pad, top - overflow);
    }
  } else {
    placement = "above";
    top = caretRect.top - gap;
    transform = "translateY(-100%)";
    const menuTop = top - effectiveMaxHeight;
    if (menuTop < pad) {
      top = pad + effectiveMaxHeight;
    }
  }

  let left = caretRect.left;
  if (left + width > viewportWidth - pad) {
    left = Math.max(pad, viewportWidth - pad - width);
  }
  left = Math.max(pad, left);

  return {
    top,
    left,
    placement,
    ...(transform ? { transform } : {}),
    maxHeight: effectiveMaxHeight,
  };
}

/**
 * @param {ReturnType<typeof resolveFloatingMenuAnchor>|null|undefined} anchor
 * @param {number} [zIndex=10065]
 */
export function floatingMenuStyleFromAnchor(anchor, zIndex = 10065) {
  if (!anchor) return {};
  return {
    position: "fixed",
    top: anchor.top,
    left: anchor.left,
    zIndex,
    ...(anchor.transform ? { transform: anchor.transform } : {}),
    ...(anchor.maxHeight ? { maxHeight: anchor.maxHeight } : {}),
  };
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
  const caretTop = caretRect.top;
  const isPaged = contentScroll.classList.contains("node-query-modal__content-scroll--paged");

  if (isPaged) {
    const viewportH = contentScroll.clientHeight;
    if (viewportH > 0) {
      const layout = getPagedScrollLayout(contentScroll);
      const pageBreaks = layout?.pageBreaks;
      const contentHeight = layout?.contentHeight || contentScroll.scrollHeight;
      const pageHeight = pageHeightFromViewport(viewportH);
      const needsDown = caretBottom > box.bottom - clipPadding;
      const needsUp = caretTop < box.top + clipPadding;
      if (needsDown || needsUp) {
        const caretContentY = caretTop - box.top + contentScroll.scrollTop
          + (needsDown ? lineHeight : 0);
        const targetPage = pageBreaks?.length
          ? pageIndexFromBreaks(caretContentY, pageBreaks)
          : pageIndexFromScrollTop(caretContentY, pageHeight);
        const pageStart = pageBreaks?.length
          ? scrollTopForPageBreak(targetPage, pageBreaks)
          : scrollTopForPage(targetPage, pageHeight);
        const pageScrollMax = maxScrollTopForPage(
          targetPage,
          viewportH,
          pageBreaks,
          contentHeight,
        );
        const currentPage = pageBreaks?.length
          ? pageIndexFromBreaks(contentScroll.scrollTop, pageBreaks)
          : pageIndexFromScrollTop(contentScroll.scrollTop, pageHeight);

        let nextTop = contentScroll.scrollTop;
        if (targetPage !== currentPage) {
          nextTop = needsDown
            ? pageStart
            : maxScrollTopForPage(
              targetPage,
              viewportH,
              pageBreaks,
              contentHeight,
            );
        } else if (needsDown) {
          nextTop = contentScroll.scrollTop
            + (caretBottom - (box.bottom - clipPadding));
          nextTop = Math.max(pageStart, Math.min(nextTop, pageScrollMax));
        } else {
          nextTop = contentScroll.scrollTop
            - ((box.top + clipPadding) - caretTop);
          nextTop = Math.max(pageStart, Math.min(nextTop, pageScrollMax));
        }

        if (contentScroll.scrollTop !== nextTop) {
          contentScroll.scrollTop = nextTop;
        }
        contentScroll.dispatchEvent(
          new CustomEvent("docpagedchange", {
            detail: { pageIndex: targetPage },
            bubbles: true,
          }),
        );
      }
    }
    return;
  }

  if (caretBottom > box.bottom - clipPadding) {
    const delta = caretBottom - (box.bottom - clipPadding);
    contentScroll.scrollBy({ top: delta, behavior: "instant" });
  }
}

const WRITING_SCROLL_PARENT_SELECTORS = [
  ".doc-new-content-scroll",
  ".note-taker__content-scroll",
  ".node-query-modal__content-scroll",
];

/**
 * Nearest doc/writing scroll container whose scrollTop must survive height sync.
 * @param {HTMLElement|null|undefined} el
 * @returns {HTMLElement|null}
 */
export function findWritingScrollParent(el) {
  if (!el || typeof el.closest !== "function") return null;
  for (const selector of WRITING_SCROLL_PARENT_SELECTORS) {
    const parent = el.closest(selector);
    if (parent) return parent;
  }
  return null;
}

/**
 * Run a layout mutation that temporarily collapses height without losing scroll.
 * Always restores the prior scrollTop — never stick-to-bottom (docs are not chat).
 * @param {HTMLElement|null|undefined} el
 * @param {() => void} mutate
 */
export function withPreservedWritingScroll(el, mutate) {
  const scrollParent = findWritingScrollParent(el);
  const parentScrollTop = scrollParent?.scrollTop ?? null;

  mutate();

  if (!scrollParent || parentScrollTop === null) return;
  scrollParent.scrollTop = parentScrollTop;
}

/**
 * Like withPreservedWritingScroll, but also restores textarea caret + inner scroll.
 * Required when height:auto remeasures large bodies (many blank lines) — otherwise
 * `@` / QLoop can park the caret on the last line while glyphs stay above.
 * @param {HTMLElement|null|undefined} el
 * @param {() => void} mutate
 */
export function withPreservedTextareaLayout(el, mutate) {
  const isTextarea = el?.tagName === "TEXTAREA";
  const selStart = isTextarea && "selectionStart" in el ? el.selectionStart : null;
  const selEnd = isTextarea && "selectionEnd" in el ? el.selectionEnd : null;
  const innerScrollTop = isTextarea ? el.scrollTop : null;

  withPreservedWritingScroll(el, mutate);

  if (!isTextarea || !("setSelectionRange" in el)) return;

  const len = String(el.value ?? "").length;
  if (selStart != null && selEnd != null) {
    const start = Math.max(0, Math.min(selStart, len));
    const end = Math.max(start, Math.min(selEnd, len));
    el.setSelectionRange(start, end);
  }
  if (innerScrollTop != null) {
    el.scrollTop = innerScrollTop;
  }
}

/** Auto-grow textarea height without jumping the outer scroll container. */
export function syncAutoGrowTextareaHeight(textarea) {
  if (!textarea) return;

  withPreservedTextareaLayout(textarea, () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
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
