import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DOC_TEXT_MARKER_COLORS } from "../../../lib/docTextMarkerColors.js";

const TEXT_FORMAT_ITEMS = [
  { id: "bold", label: "Bold" },
  { id: "macronodo", label: "Create node" },
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
];

const HEADING_FORMAT_ITEMS = [
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
];

/** Plus control beside highlighted text — opens formatting menu. */
export function DocTextSelectionBubble({
  position,
  blockKind = "text",
  onBold,
  onSelectFormat,
  onDismiss,
  markerEnabled = false,
}) {
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItems = blockKind === "heading" ? HEADING_FORMAT_ITEMS : TEXT_FORMAT_ITEMS;

  useEffect(() => {
    setMenuOpen(false);
  }, [position?.left, position?.top, position?.btnSize, blockKind]);

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
  const menuWidth = 176;
  const menuOpensLeft = left + safeBtnSize + 4 + menuWidth > window.innerWidth - 8;
  const menuStyle = menuOpensLeft
    ? { top: 0, right: safeBtnSize + 4, left: "auto" }
    : { top: 0, left: safeBtnSize + 4 };

  const handleItemClick = (formatId) => {
    if (formatId === "bold") {
      if (onBold) {
        onBold();
        return;
      }
    }
    onSelectFormat?.(formatId);
  };

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
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="doc-text-selection-toolbar__item"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item.id);
                setMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
          {markerEnabled && blockKind !== "heading" ? (
            <div className="doc-text-selection-toolbar__marker-row">
              <span className="doc-text-selection-toolbar__marker-label">Marker</span>
              <div className="doc-node-link-colors" role="group" aria-label="Marker colors">
                {DOC_TEXT_MARKER_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    aria-label={`Marker ${color.label}`}
                    title={color.label}
                    className="doc-node-link-color doc-text-selection-toolbar__marker-swatch"
                    style={{ "--node-link-swatch": color.swatch }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFormat?.(`marker:${color.id}`);
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
