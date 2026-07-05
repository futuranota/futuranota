import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DOC_SLASH_GHOST_HINTS, getSlashTail, splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import {
  resolveSlashGhostOverlayPosition,
  scrollTextareaCaretIntoCameraView,
} from "../../../lib/textareaSelectionRect.js";

const CARET_CAMERA_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function collapseDuplicateSlashTail(value) {
  const tail = getSlashTail(value);
  if (!tail || !tail.startsWith("//")) return value;
  const { prefix } = splitBodyForSlash(value);
  const fixedTail = "/" + tail.replace(/^\/+/, "");
  return prefix + fixedTail;
}

/**
 * Textarea for slash commands at end of a line.
 * Text always renders in the field (single source of truth). Ghost hints float
 * beside the caret via resolveSlashGhostOverlayPosition — no mirror layer.
 */
export function SlashAwareTextarea({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
  onPaste,
  placeholder,
  className = "",
  wrapClassName = "",
  autoFocus = false,
  showPlaceholder = true,
  minHeightPx = 20,
  maxHeightPx = 120,
  inputRef: externalRef,
  ariaLabel,
  onAfterInput,
}) {
  const internalRef = useRef(null);
  const wrapRef = useRef(null);
  const textareaRef = externalRef || internalRef;
  const caretCameraRafRef = useRef(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [ghostPos, setGhostPos] = useState(null);

  const { slash } = splitBodyForSlash(value);
  const showGhost = Boolean(slash) && /^\/\s*$/.test(slash);

  const scheduleCaretCameraScroll = useCallback(() => {
    if (caretCameraRafRef.current) {
      cancelAnimationFrame(caretCameraRafRef.current);
    }
    caretCameraRafRef.current = requestAnimationFrame(() => {
      caretCameraRafRef.current = null;
      const el = textareaRef.current;
      if (!el) return;
      scrollTextareaCaretIntoCameraView(el, { behavior: "instant" });
    });
  }, [textareaRef]);

  const syncGhostPosition = useCallback(() => {
    if (!showGhost) {
      setGhostPos(null);
      return;
    }
    const el = textareaRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    setGhostPos(resolveSlashGhostOverlayPosition(el, wrap));
  }, [showGhost, textareaRef]);

  useEffect(() => () => {
    if (caretCameraRafRef.current) cancelAnimationFrame(caretCameraRafRef.current);
  }, []);

  useEffect(() => {
    if (!showGhost) {
      setHintIndex(0);
      return;
    }
    setHintIndex(0);
    const interval = setInterval(() => {
      setHintIndex((i) => (i + 1) % DOC_SLASH_GHOST_HINTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [showGhost, slash]);

  useLayoutEffect(() => {
    syncGhostPosition();
  }, [value, showGhost, hintIndex, syncGhostPosition]);

  useLayoutEffect(() => {
    if (!showGhost) return undefined;
    const el = textareaRef.current;
    if (!el) return undefined;

    const onScroll = () => syncGhostPosition();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    let ro;
    if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
      ro = new ResizeObserver(onScroll);
      ro.observe(wrapRef.current);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, [showGhost, syncGhostPosition, textareaRef]);

  const ghostHint = DOC_SLASH_GHOST_HINTS[hintIndex] ?? DOC_SLASH_GHOST_HINTS[0];

  const focusField = useCallback(
    (placeCaretAtEnd = false) => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (placeCaretAtEnd && "setSelectionRange" in el) {
        const pos = el.value.length;
        el.setSelectionRange(pos, pos);
      }
    },
    [textareaRef],
  );

  const handleWrapPointerDown = useCallback(
    (event) => {
      const el = textareaRef.current;
      if (!el || event.target === el) return;
      event.preventDefault();
      focusField(true);
    },
    [focusField, textareaRef],
  );

  const isFieldVisible = useCallback((el) => {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const rects = el.getClientRects();
    return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
  }, []);

  const heightCap = maxHeightPx == null ? Number.POSITIVE_INFINITY : maxHeightPx;

  const syncHeight = useCallback((force = false) => {
    const el = textareaRef.current;
    if (!el) return;
    if (!force && !isFieldVisible(el)) return;
    el.style.height = "auto";
    const measured = el.scrollHeight;
    const next = Math.min(Math.max(measured, minHeightPx), heightCap);
    if (Math.abs(el.offsetHeight - next) > 1) {
      el.style.height = `${next}px`;
    }
    el.style.overflowY = measured > next + 1 ? "auto" : "hidden";
  }, [heightCap, isFieldVisible, minHeightPx, textareaRef]);

  useLayoutEffect(() => {
    syncHeight(true);
    syncGhostPosition();
  }, [value, syncHeight, syncGhostPosition]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      syncHeight(true);
      syncGhostPosition();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncHeight, syncGhostPosition, textareaRef]);

  useLayoutEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus, textareaRef]);

  const fieldClass = ["doc-slash-field__input", className].filter(Boolean).join(" ");

  return (
    <div
      ref={wrapRef}
      className={`doc-slash-field ${wrapClassName}`.trim()}
      onMouseDown={handleWrapPointerDown}
    >
      <textarea
        ref={textareaRef}
        className={fieldClass}
        value={value}
        placeholder={showPlaceholder ? placeholder : ""}
        rows={1}
        onChange={(e) => {
          onChange(collapseDuplicateSlashTail(e.target.value));
          onAfterInput?.();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!e.defaultPrevented && CARET_CAMERA_KEYS.has(e.key)) {
            scheduleCaretCameraScroll();
          }
        }}
        onSelect={syncGhostPosition}
        onKeyUp={syncGhostPosition}
        onClick={syncGhostPosition}
        onPaste={onPaste}
        onBlur={onBlur}
        onFocus={(e) => {
          onFocus?.(e);
          syncGhostPosition();
        }}
        spellCheck={false}
        aria-label={ariaLabel}
      />
      {showGhost && ghostPos ? (
        <span
          className="doc-slash-field__ghost-overlay"
          aria-hidden
          style={{
            left: `${ghostPos.left}px`,
            top: `${ghostPos.top}px`,
            lineHeight: `${ghostPos.lineHeight}px`,
          }}
        >
          {ghostHint}
        </span>
      ) : null}
    </div>
  );
}
