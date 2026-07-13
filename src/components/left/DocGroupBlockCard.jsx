import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { playClosedBoxSound } from "../../lib/closedBoxSound.js";

const CATEGORY_LONG_PRESS_MS = 550;

/**
 * Collapsible doc group — same visual pattern as DocNodesBlockCard.
 * Long-press the header to reveal delete (like company thumbs).
 * @param {object} props
 * @param {string} props.groupLabel
 * @param {string} [props.groupMeta]
 * @param {import("../../types/docs.js").Doc[]} props.docs
 * @param {boolean} [props.defaultExpanded]
 * @param {(doc: import("../../types/docs.js").Doc) => import("react").ReactNode} props.renderDoc
 * @param {() => void} [props.onDeleteCategory]
 */
export function DocGroupBlockCard({
  groupLabel,
  groupMeta = "",
  docs = [],
  defaultExpanded = false,
  renderDoc,
  onDeleteCategory,
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const rootRef = useRef(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPress(), []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  if (!docs.length) return null;

  const handlePointerDown = (e) => {
    if (e.button !== 0 || !onDeleteCategory) return;
    suppressClickRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      suppressClickRef.current = true;
      setMenuOpen(true);
    }, CATEGORY_LONG_PRESS_MS);
  };

  const handlePointerMove = (e) => {
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 8) clearLongPress();
  };

  const handlePointerUp = () => clearLongPress();

  const handleHeadClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    playClosedBoxSound();
    setExpanded((value) => !value);
  };

  return (
    <article
      ref={rootRef}
      className={
        "lp-doc-nodes-block lp-doc-nodes-block--docs"
        + (menuOpen ? " is-menu-open" : "")
      }
    >
      <div className="lp-doc-nodes-block__head">
        <button
          type="button"
          className="lp-doc-nodes-block__head-main"
          onClick={handleHeadClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          aria-expanded={expanded}
        >
          <span className={"lp-doc-icon lp-doc-icon--box" + (expanded ? " lp-doc-icon--box-open" : "")}>
            <img
              src={expanded ? "/uploads/open-box.svg" : "/uploads/box-closed.svg"}
              alt=""
              aria-hidden
              className="lp-item-icon-img lp-box-icon-img"
              key={expanded ? "open" : "closed"}
            />
          </span>
          <div className="fn-card-body">
            <span className="lp-doc-group-category">{groupLabel}</span>
            {groupMeta ? (
              <span className="fn-card-meta">{groupMeta}</span>
            ) : null}
          </div>
          <span
            className={"lp-doc-nodes-block__chevron" + (expanded ? "" : " is-collapsed")}
            aria-hidden
          >
            <img
              src="/uploads/control.svg"
              alt=""
              className="lp-doc-nodes-block__chevron-img"
            />
          </span>
        </button>
      </div>
      {menuOpen && onDeleteCategory ? (
        <div className="lp-doc-nodes-block__press-actions">
          <button
            type="button"
            className="btn xs ghost lp-doc-nodes-block__press-delete"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              onDeleteCategory();
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      ) : null}
      {expanded ? (
        <div className="lp-doc-nodes-block__body lp-doc-nodes-block__body--docs">
          {docs.map((doc) => renderDoc(doc))}
        </div>
      ) : null}
    </article>
  );
}
