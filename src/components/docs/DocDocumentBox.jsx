import { useCallback, useLayoutEffect, useRef } from "react";
import {
  DOC_EXPAND_ICON,
  DOC_FILE_TXT_ICON,
  DOC_PARENT_ICON,
  DOC_TIMER_ICON,
} from "../../lib/docMediumAssets.js";

const DEFAULT_DOC_LABEL = "New document";

/**
 * Document medium box — layout from Figma node 291:494 (datos).
 * Outer dimensions stay 537×356 via .doc-new-modal / .doc-overlay-global-card.
 */
export function DocDocumentBox({
  title,
  onTitleChange,
  titleRef,
  titlePlaceholder = "Write your description",
  body,
  onBodyChange,
  bodyPlaceholder = 'Type your text here "/"create command',
  createdDate,
  onCreatedDateChange,
  parentId,
  onParentIdChange,
  objects = null,
  onDelete,
  onSave,
  onCloseExpand,
  onTitleKeyDown,
  onBodyKeyDown,
}) {
  const showParent = objects && onParentIdChange;
  const docLabel = title.trim() ? title : DEFAULT_DOC_LABEL;
  const bodyRef = useRef(null);

  const syncBodyHeight = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxPx = parseFloat(getComputedStyle(el).maxHeight);
    const cap = Number.isFinite(maxPx) && maxPx > 0 ? maxPx : 200;
    const next = Math.min(el.scrollHeight, cap);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncBodyHeight();
  }, [body, syncBodyHeight]);

  return (
    <div className="doc-new-inner">
      <header className="doc-new-head">
        <div className="doc-new-head-top">
          <img className="doc-new-head-icon" src={DOC_FILE_TXT_ICON} alt="" aria-hidden />
          <span className="doc-new-doc-label">{docLabel}</span>
          {onCloseExpand && (
            <button
              type="button"
              className="doc-new-head-expand-btn"
              onClick={onCloseExpand}
              aria-label="Close"
            >
              <img className="doc-new-head-expand" src={DOC_EXPAND_ICON} alt="" aria-hidden />
            </button>
          )}
        </div>
        <input
          ref={titleRef}
          type="text"
          className="doc-new-head-title"
          value={title}
          placeholder={titlePlaceholder}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={onTitleKeyDown}
          aria-label="Document title"
        />
      </header>

      <div className="doc-new-meta">
        <div className="doc-new-row">
          <img className="doc-new-meta-icon" src={DOC_TIMER_ICON} alt="" aria-hidden />
          <span className="doc-new-key">Created</span>
          <input
            type="date"
            className="doc-new-date"
            value={createdDate}
            onChange={(e) => onCreatedDateChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {showParent && (
          <div className="doc-new-row">
            <img
              className="doc-new-meta-icon doc-new-meta-icon--parent"
              src={DOC_PARENT_ICON}
              alt=""
              aria-hidden
            />
            <span className="doc-new-key doc-new-key--parent">Parent</span>
            <select
              className="doc-new-select"
              value={parentId}
              onChange={(e) => onParentIdChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">— sin padre —</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="doc-new-content-box">
        <textarea
          ref={bodyRef}
          className="doc-new-body-field"
          value={body}
          placeholder={bodyPlaceholder}
          rows={1}
          onChange={(e) => {
            onBodyChange(e.target.value);
            requestAnimationFrame(syncBodyHeight);
          }}
          onKeyDown={onBodyKeyDown}
        />
      </div>

      <div className="doc-new-actions">
        <button type="button" className="doc-new-action doc-new-action--delete" onClick={onDelete}>
          delete
        </button>
        <button type="button" className="doc-new-action doc-new-action--save" onClick={onSave}>
          save
        </button>
      </div>
    </div>
  );
}
