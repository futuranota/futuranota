import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Portal autocomplete for moodboard #tag refs (bare label, no "#").
 */
export function DocTagRefMenu({
  open,
  items = [],
  activeIndex = 0,
  anchor = null,
  emptyLabel = "No matching moodboard tags",
  ariaLabel = "Moodboard tags",
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
    const el = menuRef.current?.querySelector(`[data-tagref-index="${activeIndex}"]`);
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
      className="doc-mention-menu doc-tagref-menu"
      role="listbox"
      aria-label={ariaLabel}
      style={style}
    >
      {items.length === 0 ? (
        <p className="doc-mention-menu__empty">{emptyLabel}</p>
      ) : (
        items.map((item, index) => (
          <button
            key={`${item.blockId}:${item.slotId}:${item.label}`}
            type="button"
            role="option"
            data-tagref-index={index}
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
            <span className="doc-tagref-menu__row">
              {item.thumbSrc ? (
                <img
                  className="doc-tagref-menu__thumb"
                  src={item.thumbSrc}
                  alt=""
                  draggable={false}
                />
              ) : (
                <span className="doc-tagref-menu__thumb doc-tagref-menu__thumb--empty" />
              )}
              <span className="doc-mention-menu__name">
                <span className="doc-slash-field__tagref doc-tagref-menu__label">
                  {item.label}
                </span>
              </span>
            </span>
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
