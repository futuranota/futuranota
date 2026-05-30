import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DOC_SLASH_GHOST_HINTS, getSlashTail, splitBodyForSlash } from "../../../lib/docBlockSlash.js";

function collapseDuplicateSlashTail(value) {
  const tail = getSlashTail(value);
  if (!tail || !tail.startsWith("//")) return value;
  const { prefix } = splitBodyForSlash(value);
  const fixedTail = "/" + tail.replace(/^\/+/, "");
  return prefix + fixedTail;
}

/**
 * Textarea with mirror layer for slash commands at end of text (slash-instructions.png).
 * When a slash tail is active, typed text is drawn in the mirror; the field uses a transparent
 * color so ghost hints do not overlap the "/" character.
 */
export function SlashAwareTextarea({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
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
  const textareaRef = externalRef || internalRef;
  const [hintIndex, setHintIndex] = useState(0);

  const { prefix, slash } = splitBodyForSlash(value);
  const slashActive = Boolean(slash);
  const showGhost = slashActive && /^\/\s*$/.test(slash);

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

  const syncHeight = useCallback((force = false) => {
    const el = textareaRef.current;
    if (!el) return;
    const visible = isFieldVisible(el);
    if (!visible && !force) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${Math.max(next, minHeightPx)}px`;
    el.style.overflowY = el.scrollHeight > maxHeightPx ? "auto" : "hidden";
    // #region agent log
    fetch("http://127.0.0.1:7764/ingest/1d5b49ee-76e8-4907-8f7a-6cd7282ea736", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a58ec5" },
      body: JSON.stringify({
        sessionId: "a58ec5",
        runId: "post-fix-v2",
        location: "SlashAwareTextarea.jsx:syncHeight",
        message: "synced",
        data: {
          valueLen: el.value.length,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          visible,
          force,
        },
        hypothesisId: "D",
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [isFieldVisible, maxHeightPx, minHeightPx, textareaRef]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || !isFieldVisible(el)) return;
    el.style.height = "auto";
    requestAnimationFrame(() => syncHeight());
  }, [value, syncHeight, isFieldVisible]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => syncHeight());
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncHeight, textareaRef]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      el.style.height = "auto";
      requestAnimationFrame(() => syncHeight(true));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncHeight, textareaRef]);

  useLayoutEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus, textareaRef]);

  const fieldClass = [
    "doc-slash-field__input",
    slashActive ? "doc-slash-field__input--slash-mode" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`doc-slash-field ${wrapClassName}`.trim()}
      onMouseDown={handleWrapPointerDown}
    >
      {slashActive ? (
        <div className="doc-slash-field__mirror" aria-hidden>
          <span className="doc-slash-field__plain">{prefix}</span>
          <span className="doc-slash-field__command">{slash}</span>
          {showGhost ? (
            <span className="doc-slash-field__ghost">{ghostHint}</span>
          ) : null}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        className={fieldClass}
        value={value}
        placeholder={showPlaceholder ? placeholder : ""}
        rows={1}
        onChange={(e) => {
          onChange(collapseDuplicateSlashTail(e.target.value));
          requestAnimationFrame(() => {
            syncHeight();
            onAfterInput?.();
          });
        }}
        onPaste={() => {
          requestAnimationFrame(() => {
            syncHeight();
            onAfterInput?.();
          });
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={(e) => {
          syncHeight();
          onFocus?.(e);
        }}
        spellCheck={false}
        aria-label={ariaLabel}
      />
    </div>
  );
}
