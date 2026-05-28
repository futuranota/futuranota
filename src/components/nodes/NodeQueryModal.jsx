import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DOC_TIMER_ICON,
  NODE_ICON,
  NODE_SAVE_ARCHIVE_ICON,
  NODE_SEARCH_ICON,
} from "../../lib/docMediumAssets.js";
import { DATA_TYPE_LABELS } from "../../lib/nodeDataTypes.js";
import { MetricFieldsEditor } from "../shared/MetricFieldsEditor.jsx";
import { BlockAnchorFields } from "../docs/blocks/BlockAnchorFields.jsx";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";

const DEFAULT_DATA_TYPES = ["text", "date", "metric", "checkbox"];

/**
 * Node editor modal — Figma 296:627.
 * Doc H1 flow: read-only query/parent/type. Standalone: editable query, type, optional parent doc.
 */
export function NodeQueryModal({
  query,
  onQueryChange,
  content,
  onContentChange,
  dataType = "text",
  onDataTypeChange,
  dataTypes = DEFAULT_DATA_TYPES,
  createdDate,
  onCreatedDateChange,
  parentDocLabel,
  parentDocId = "",
  onParentDocIdChange,
  docs = [],
  onClose,
  onBackToDocument,
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
}) {
  const bodyRef = useRef(null);
  const displayQuery = (query || "").trim() || "Untitled";
  const queryEditable = Boolean(onQueryChange);
  const typeEditable = Boolean(onDataTypeChange);
  const parentSelectable = Boolean(onParentDocIdChange);
  const dateEditable = Boolean(onCreatedDateChange);

  const normalizedDateContent =
    dataType === "date"
      ? typeof content === "string"
        ? { date: content, time: "" }
        : content && typeof content === "object"
          ? { date: content.date || "", time: content.time || "" }
          : { date: "", time: "" }
      : { date: "", time: "" };

  const normalizedMetricContent =
    dataType === "metric"
      ? content && typeof content === "object"
        ? {
            value: content.value != null && content.value !== "" ? String(content.value) : "",
            unit: content.unit || "",
          }
        : { value: content != null && content !== "" ? String(content) : "", unit: "" }
      : { value: "", unit: "" };

  const checkboxChecked =
    dataType === "checkbox"
      ? content === true || String(content).toLowerCase() === "true"
      : false;

  const showScheduleAnchor =
    Boolean(onAnchorDateChange)
    && (dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX);

  useEffect(() => {
    bodyRef.current?.focus();
  }, [dataType]);

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
            {parentSelectable ? (
              <select
                className="node-query-modal__parent-select"
                value={parentDocId || ""}
                onChange={(e) => onParentDocIdChange(e.target.value || null)}
                aria-label="Assign to document"
              >
                <option value="">node</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <span className="node-query-modal__parent-doc">{parentDocLabel}</span>
                {onBackToDocument ? (
                  <button
                    type="button"
                    className="node-query-modal__back-link"
                    onClick={onBackToDocument}
                  >
                    ← return
                  </button>
                ) : null}
              </>
            )}
          </div>

          {queryEditable ? (
            <div className="node-query-modal__query-edit" id="node-query-modal-title">
              <input
                type="text"
                className="node-query-modal__query-input"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Untitled"
                spellCheck={false}
                aria-label="Query or title"
              />
            </div>
          ) : (
            <h2 id="node-query-modal-title" className="node-query-modal__query-title">
              {displayQuery}
            </h2>
          )}
        </header>

        <div className="node-query-modal__meta">
          <div className="node-query-modal__row">
            <img className="node-query-modal__meta-icon" src={NODE_ICON} alt="" aria-hidden />
            <span className="node-query-modal__key">Type:</span>
            {typeEditable ? (
              <select
                className="node-query-modal__type-select"
                value={dataType}
                onChange={(e) => onDataTypeChange(e.target.value)}
                aria-label="Data type"
              >
                {dataTypes.map((t) => (
                  <option key={t} value={t}>
                    {DATA_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            ) : (
              <span className="node-query-modal__val">{DATA_TYPE_LABELS[dataType] || dataType}</span>
            )}
          </div>
          <div className="node-query-modal__row">
            <img className="node-query-modal__meta-icon" src={DOC_TIMER_ICON} alt="" aria-hidden />
            <span className="node-query-modal__key">Created:</span>
            <input
              type="date"
              className="node-query-modal__date"
              value={createdDate}
              readOnly={!dateEditable}
              tabIndex={dateEditable ? 0 : -1}
              aria-readonly={!dateEditable}
              onChange={dateEditable ? (e) => onCreatedDateChange(e.target.value) : undefined}
            />
          </div>
        </div>

        <div className="node-query-modal__content-box">
          {dataType === "date" ? (
            <div className="node-query-modal__date-editor">
              <input
                ref={bodyRef}
                type="date"
                className="node-query-modal__date-input"
                value={normalizedDateContent.date}
                onChange={(e) => onContentChange({ ...normalizedDateContent, date: e.target.value })}
                aria-label="Date"
              />
              <input
                type="time"
                className="node-query-modal__time-input"
                value={normalizedDateContent.time}
                onChange={(e) => onContentChange({ ...normalizedDateContent, time: e.target.value })}
                aria-label="Time"
              />
            </div>
          ) : dataType === "metric" ? (
            <MetricFieldsEditor
              valueInputRef={bodyRef}
              className="node-query-modal__metric-editor"
              value={normalizedMetricContent.value}
              unit={normalizedMetricContent.unit}
              onValueChange={(value) =>
                onContentChange({ ...normalizedMetricContent, value })
              }
              onUnitChange={(unit) =>
                onContentChange({ ...normalizedMetricContent, unit })
              }
            />
          ) : dataType === "checkbox" ? (
            <label className="node-query-modal__checkbox-row">
              <input
                ref={bodyRef}
                type="checkbox"
                checked={checkboxChecked}
                onChange={(e) => onContentChange(e.target.checked)}
                aria-label="Checkbox value"
              />
              <span>Checked</span>
            </label>
          ) : (
            <textarea
              ref={bodyRef}
              className="node-query-modal__body"
              value={typeof content === "string" ? content : ""}
              placeholder="Type your text here"
              onChange={(e) => onContentChange(e.target.value)}
              spellCheck={false}
              aria-label="Contenido del nodo"
            />
          )}
          {showScheduleAnchor ? (
            <BlockAnchorFields
              className="node-query-modal__schedule"
              anchorDate={anchorDate}
              anchorTime={anchorTime}
              onAnchorDateChange={onAnchorDateChange}
              onAnchorTimeChange={onAnchorTimeChange}
            />
          ) : null}
        </div>

        <footer className="node-query-modal__actions">
          <button
            type="button"
            className="node-query-modal__action node-query-modal__action--search"
            disabled
            aria-disabled="true"
            title="Coming soon"
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
