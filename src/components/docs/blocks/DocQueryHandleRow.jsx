import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { DOC_QUERY_HANDLE_ICON } from "../../../lib/docMediumAssets.js";

/** Shared query-handle + title row for linkable doc blocks. */
export function DocQueryHandleRow({
  value,
  onChange,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  placeholder = "Insert Query (?) or title",
  ariaLabel = "Block title or query",
  multiline = false,
  minHeightPx = 22,
  maxHeightPx = 200,
}) {
  const inputRef = useRef(null);

  const syncHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeightPx);
    el.style.height = `${Math.max(next, minHeightPx)}px`;
  }, [maxHeightPx, minHeightPx]);

  useLayoutEffect(() => {
    if (!multiline) return;
    syncHeight();
  }, [value, multiline, syncHeight]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const headerClass = multiline
    ? "doc-h1-block__header doc-h1-block__header--multiline"
    : "doc-h1-block__header";

  return (
    <div className={headerClass}>
      <button
        type="button"
        className="doc-query-handle"
        aria-label="Abrir nodo de query"
        title="Abrir nodo de query"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onQueryHandleClick?.();
        }}
      >
        <img src={DOC_QUERY_HANDLE_ICON} alt="" aria-hidden />
      </button>
      {multiline ? (
        <textarea
          ref={inputRef}
          className="doc-h1-block__input doc-h1-block__input--multiline"
          value={value}
          placeholder={placeholder}
          rows={1}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(syncHeight);
          }}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label={ariaLabel}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          className="doc-h1-block__input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label={ariaLabel}
        />
      )}
    </div>
  );
}
