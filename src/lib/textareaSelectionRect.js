function copyTextareaStyle(textarea, mirror) {
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

function getCaretClientRect(textarea, position) {
  const value = textarea.value ?? "";
  const pos = Math.max(0, Math.min(position, value.length));
  const fieldRect = textarea.getBoundingClientRect();

  const mirror = document.createElement("div");
  copyTextareaStyle(textarea, mirror);
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

function isVerticallyScrollable(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  return (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")
    && el.scrollHeight > el.clientHeight + 1;
}

function resolveScrollBehavior(requested) {
  if (requested === "instant") return "instant";
  if (typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return "instant";
  }
  return requested || "smooth";
}

/**
 * Keeps the textarea caret in a comfortable viewport band — smooth "camera" scroll
 * through inner fields, content scroll areas, and the doc overlay.
 */
export function scrollTextareaCaretIntoCameraView(textarea, options = {}) {
  if (!textarea?.isConnected || textarea.tagName !== "TEXTAREA") return;

  const behavior = resolveScrollBehavior(options.behavior);
  const bandTopRatio = options.bandTopRatio ?? 0.3;
  const bandBottomRatio = options.bandBottomRatio ?? 0.58;
  const targetRatio = options.targetRatio ?? 0.38;
  const clipPadding = options.clipPadding ?? 24;

  const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
  const pos = textarea.selectionStart ?? textarea.value.length;

  const readCaretRect = () => getCaretClientRect(textarea, pos);
  let caretRect = readCaretRect();

  if (textarea.scrollHeight > textarea.clientHeight) {
    const fieldRect = textarea.getBoundingClientRect();
    const caretBottom = caretRect.top + lineHeight;
    if (caretBottom > fieldRect.bottom - 10) {
      textarea.scrollTop += caretBottom - fieldRect.bottom + 16;
    } else if (caretRect.top < fieldRect.top + 10) {
      textarea.scrollTop -= fieldRect.top - caretRect.top + 16;
    }
    caretRect = readCaretRect();
  }

  let node = textarea.parentElement;
  while (node) {
    if (!isVerticallyScrollable(node)) {
      node = node.parentElement;
      continue;
    }
    const box = node.getBoundingClientRect();
    const caretBottom = caretRect.top + lineHeight;
    let delta = 0;
    if (caretBottom > box.bottom - clipPadding) {
      delta = caretBottom - (box.bottom - clipPadding);
    } else if (caretRect.top < box.top + clipPadding) {
      delta = caretRect.top - (box.top + clipPadding);
    }
    if (delta !== 0) {
      node.scrollBy({ top: delta, behavior });
      return;
    }
    node = node.parentElement;
  }

  const caretCenter = caretRect.top + lineHeight / 2;
  const bandTop = window.innerHeight * bandTopRatio;
  const bandBottom = window.innerHeight * bandBottomRatio;
  if (caretCenter >= bandTop && caretCenter <= bandBottom) return;

  const delta = caretCenter - window.innerHeight * targetRatio;
  if (Math.abs(delta) < 6) return;

  const overlay = textarea.closest(".doc-overlay-global");
  if (overlay && isVerticallyScrollable(overlay)) {
    overlay.scrollBy({ top: delta, behavior });
  }
}
