import { useEffect, useRef } from "react";
import { DOC_QUERY_HANDLE_ICON } from "../../../lib/docMediumAssets.js";

export function H1BlockView({
  value,
  onChange,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="doc-h1-block">
      <div className="doc-h1-block__header">
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
        <input
          ref={inputRef}
          type="text"
          className="doc-h1-block__input"
          value={value}
          placeholder="Insert Query (?) or title"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="Heading title or query"
        />
      </div>
    </div>
  );
}
