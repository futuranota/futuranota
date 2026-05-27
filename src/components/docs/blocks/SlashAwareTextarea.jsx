import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getSlashTail, splitBodyForSlash } from "../../../lib/docBlockSlash.js";

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
  placeholder,
  className = "",
  wrapClassName = "",
  autoFocus = false,
  showPlaceholder = true,
  minHeightPx = 20,
  maxHeightPx = 120,
  inputRef: externalRef,
}) {
  const internalRef = useRef(null);
  const textareaRef = externalRef || internalRef;
  const [ghostHint, setGhostHint] = useState("H1");

  const { prefix, slash } = splitBodyForSlash(value);
  const slashActive = Boolean(slash);
  const showGhost = slashActive && /^\/\s*$/.test(slash);

  useEffect(() => {
    if (!showGhost) {
      setGhostHint("H1");
      return;
    }
    setGhostHint("H1");
    const timer = setTimeout(() => setGhostHint("to-do"), 2000);
    return () => clearTimeout(timer);
  }, [showGhost, slash]);

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${Math.max(next, minHeightPx)}px`;
  }, [maxHeightPx, minHeightPx, textareaRef]);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

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
    <div className={`doc-slash-field ${wrapClassName}`.trim()}>
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
          requestAnimationFrame(syncHeight);
        }}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
    </div>
  );
}
