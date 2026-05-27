import { useEffect, useRef, useState } from "react";
import { DOC_SLASH_GHOST_HINTS } from "../../../lib/docBlockSlash.js";

/**
 * Inline slash input with ghost hints:
 * value === "/" → cycles Title → Checkbox → date → metric.
 */
export function SlashCommandPreview({
  value,
  onChange,
  onKeyDown,
  enableGhostHints = false,
  autoFocus = false,
  className = "",
}) {
  const inputRef = useRef(null);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    if (!enableGhostHints || value !== "/") {
      setHintIndex(0);
      return;
    }
    setHintIndex(0);
    const interval = setInterval(() => {
      setHintIndex((i) => (i + 1) % DOC_SLASH_GHOST_HINTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [value, enableGhostHints]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const showGhost = enableGhostHints && value === "/";
  const ghostHint = DOC_SLASH_GHOST_HINTS[hintIndex] ?? DOC_SLASH_GHOST_HINTS[0];
  const slashIndex = value.indexOf("/");
  const prefix = slashIndex >= 0 ? value.slice(0, slashIndex + 1) : value;
  const typedAfterSlash = slashIndex >= 0 ? value.slice(slashIndex + 1) : "";

  return (
    <div className={`doc-slash-preview ${className}`.trim()}>
      <div className="doc-slash-preview__mirror" aria-hidden>
        <span className="doc-slash-preview__prefix">{prefix}</span>
        {typedAfterSlash ? (
          <span className="doc-slash-preview__typed">{typedAfterSlash}</span>
        ) : null}
        {showGhost ? <span className="doc-slash-preview__suffix">{ghostHint}</span> : null}
      </div>
      <input
        ref={inputRef}
        type="text"
        className="doc-slash-preview__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoComplete="off"
        aria-label="Slash command"
      />
    </div>
  );
}
