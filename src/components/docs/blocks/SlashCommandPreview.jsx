import { useEffect, useRef, useState } from "react";

/**
 * Inline slash input with ghost hints (slash-instructions.png):
 * value === "/" → hint "H1", then after 2s hint "to-do".
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
  const [ghostHint, setGhostHint] = useState("H1");

  useEffect(() => {
    if (!enableGhostHints || value !== "/") {
      setGhostHint("H1");
      return;
    }
    setGhostHint("H1");
    const timer = setTimeout(() => setGhostHint("to-do"), 2000);
    return () => clearTimeout(timer);
  }, [value, enableGhostHints]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const showGhost = enableGhostHints && value === "/";
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
