import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Autocomplete for document library image Names (invoke in prose).
 */
export function DocLibraryNameMenu({
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
    const el = menuRef.current?.querySelector(`[data-library-name-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open || !anchor || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className="doc-mention-menu"
      role="listbox"
      aria-label="Library names"
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        zIndex: 10060,
      }}
    >
      {items.length === 0 ? null : items.map((item, index) => {
        const name = String(item.tag || item.name || "").trim();
        const prompt = String(item.description || "").trim();
        const preview = prompt
          ? (prompt.length > 72 ? `${prompt.slice(0, 72)}…` : prompt)
          : "";
        return (
          <button
            key={item.id || `${name}-${index}`}
            type="button"
            role="option"
            data-library-name-index={index}
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
            <span className="doc-mention-menu__name">{name}</span>
            {preview ? (
              <span className="doc-mention-menu__desc">{preview}</span>
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
