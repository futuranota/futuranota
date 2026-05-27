import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DOC_EXPAND_ICON,
  DOC_TIMER_ICON,
  NODE_ICON,
  NODE_SAVE_ARCHIVE_ICON,
  NODE_SEARCH_ICON,
} from "../../lib/docMediumAssets.js";

/**
 * Node editor modal — Figma 296:627 (datos).
 * Breadcrumb = parent document name; main title = H1 query; textarea = answer below H1 on save.
 */
export function NodeQueryModal({
  query,
  content,
  onContentChange,
  createdDate,
  parentDocLabel,
  onSave,
  onDelete,
  onClose,
}) {
  const bodyRef = useRef(null);
  const displayQuery = (query || "").trim() || "Untitled query";

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const modal = (
    <div
      className="node-query-overlay lp-overlay--solid lp-overlay--center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="lp-modal node-query-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="node-query-modal-title"
      >
        <header className="node-query-modal__head">
          <div className="node-query-modal__head-top">
            <img className="node-query-modal__node-icon" src={NODE_ICON} alt="" aria-hidden />
            <span className="node-query-modal__parent-doc">{parentDocLabel}</span>
            <button
              type="button"
              className="node-query-modal__close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <img src={DOC_EXPAND_ICON} alt="" aria-hidden />
            </button>
          </div>

          <h2 id="node-query-modal-title" className="node-query-modal__query-title">
            query: {displayQuery}
          </h2>
        </header>

        <div className="node-query-modal__meta">
          <div className="node-query-modal__row">
            <img className="node-query-modal__meta-icon" src={NODE_ICON} alt="" aria-hidden />
            <span className="node-query-modal__key">Type:</span>
            <span className="node-query-modal__val">text</span>
          </div>
          <div className="node-query-modal__row">
            <img className="node-query-modal__meta-icon" src={DOC_TIMER_ICON} alt="" aria-hidden />
            <span className="node-query-modal__key">Created:</span>
            <input
              type="date"
              className="node-query-modal__date"
              value={createdDate}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
            />
          </div>
        </div>

        <div className="node-query-modal__content-box">
          <textarea
            ref={bodyRef}
            className="node-query-modal__body"
            value={content}
            placeholder="Type your text here"
            onChange={(e) => onContentChange(e.target.value)}
            spellCheck={false}
            aria-label="Contenido del nodo"
          />
        </div>

        <footer className="node-query-modal__actions">
          <button
            type="button"
            className="node-query-modal__action node-query-modal__action--delete"
            onClick={onDelete}
          >
            delete
          </button>
          <button
            type="button"
            className="node-query-modal__action node-query-modal__action--save"
            onClick={onSave}
          >
            save
            <img src={NODE_SAVE_ARCHIVE_ICON} alt="" aria-hidden />
          </button>
          <button
            type="button"
            className="node-query-modal__action node-query-modal__action--search"
            disabled
            aria-disabled="true"
            title="Próximamente"
          >
            Search
            <img src={NODE_SEARCH_ICON} alt="" aria-hidden />
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
