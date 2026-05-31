import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Plus control beside highlighted regular text — opens Bold menu. */
export function DocTextSelectionBubble({
  position,
  onBold,
  onDismiss,
}) {
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [position?.left, position?.top, position?.btnSize]);

  useEffect(() => {
    let armed = false;
    const armId = requestAnimationFrame(() => {
      armed = true;
    });

    const onPointerDown = (event) => {
      if (!armed) return;
      if (rootRef.current?.contains(event.target)) return;
      if (event.target?.closest?.(".doc-text-selection-toolbar")) return;
      onDismiss?.();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") onDismiss?.();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(armId);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  if (!position) return null;

  const { left, top, btnSize } = position;
  const safeBtnSize = Number.isFinite(btnSize) ? btnSize : 18;
  const menuWidth = 112;
  const menuOpensLeft = left + safeBtnSize + 4 + menuWidth > window.innerWidth - 8;
  const menuStyle = menuOpensLeft
    ? { top: 0, right: safeBtnSize + 4, left: "auto" }
    : { top: 0, left: safeBtnSize + 4 };

  return createPortal(
    <div
      ref={rootRef}
      className="doc-text-selection-toolbar"
      style={{
        position: "fixed",
        top,
        left,
        width: safeBtnSize,
        height: safeBtnSize,
        zIndex: 99999,
      }}
    >
      <button
        type="button"
        className="doc-text-selection-toolbar__plus"
        aria-label="Text formatting"
        aria-expanded={menuOpen}
        style={{
          width: safeBtnSize,
          height: safeBtnSize,
          fontSize: Math.max(10, safeBtnSize - 6),
        }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((open) => !open);
        }}
      >
        +
      </button>
      {menuOpen ? (
        <div
          className="doc-text-selection-toolbar__menu"
          role="menu"
          style={menuStyle}
        >
          <button
            type="button"
            className="doc-text-selection-toolbar__item"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onBold?.();
            }}
          >
            Bold
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
