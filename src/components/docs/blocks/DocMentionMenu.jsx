import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatMentionToken } from "../../../lib/urlTableTags.js";

/**
 * Portal autocomplete for company URL-table tags.
 * Duplicate tag text is disambiguated with Name · @tag.
 */
export function DocMentionMenu({
  open,
  items = [],
  activeIndex = 0,
  anchor = null,
  onHoverIndex,
  onSelect,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      onClose?.();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector(`[data-mention-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open || !anchor || typeof document === "undefined") return null;

  const style = {
    position: "fixed",
    top: anchor.top,
    left: anchor.left,
    zIndex: 10060,
  };

  return createPortal(
    <div
      ref={menuRef}
      className="doc-mention-menu"
      role="listbox"
      aria-label="Tag mentions"
      style={style}
    >
      <div className="doc-mention-menu__header">
        <span className="doc-mention-menu__title">Tags</span>
        <button
          type="button"
          className="doc-mention-menu__close"
          aria-label="Close tag picker"
          title="Keep typing with @"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose?.();
          }}
        >
          ×
        </button>
      </div>
      {items.length === 0 ? (
        <p className="doc-mention-menu__empty">No matching tags</p>
      ) : (
        items.map((item, index) => {
          const token = formatMentionToken(item.tag);
          const description = String(item.description || "").trim();
          const preview = description
            ? (description.length > 72 ? `${description.slice(0, 72)}…` : description)
            : "No description";
          return (
            <button
              key={item.entryId || `${token}-${index}`}
              type="button"
              role="option"
              data-mention-index={index}
              aria-selected={index === activeIndex}
              className={
                "doc-mention-menu__item"
                + (index === activeIndex ? " is-active" : "")
              }
              onMouseEnter={() => onHoverIndex?.(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect?.(item);
              }}
            >
              <span className="doc-mention-menu__name">
                {item.name || "Untitled"}
                {" · "}
                <span className="doc-mention-menu__tag-inline">{token}</span>
              </span>
              <span className="doc-mention-menu__desc">
                {item.tableTitle ? `${item.tableTitle} · ${preview}` : preview}
              </span>
            </button>
          );
        })
      )}
    </div>,
    document.body,
  );
}
