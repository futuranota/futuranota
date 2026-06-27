import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  DOC_TIMER_ICON,
  NODE_ICON,
  NODE_SAVE_ARCHIVE_ICON,
} from "../../lib/docMediumAssets.js";
import { IntelSearchButton } from "../shared/IntelSearchButton.jsx";
import { runIntelSearch } from "../../lib/intelSearch.js";
import { DATA_TYPE_LABELS } from "../../lib/nodeDataTypes.js";
import { MetricFieldsEditor } from "../shared/MetricFieldsEditor.jsx";
import { BlockAnchorFields } from "../docs/blocks/BlockAnchorFields.jsx";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { parseCalendarEventNodeContent } from "../../lib/eventCalendarSearch.js";
import { CalendarEventNodeView } from "../intel/CalendarEventNodeView.jsx";
import {
  listAdoptableDocs,
  resolveAdoptableDocLabel,
  resolveNodeParentDocId,
} from "../../lib/nodeParentAdoption.js";
import { useI18n } from "../../i18n/useI18n.js";

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
  parentObjectId = null,
  onClose,
  onSave,
  onBackToDocument,
  onSendToIntelSearch,
  onInsertToCanvas: _onInsertToCanvas,
  intelSearchMeta = null,
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
}) {
  const { t } = useI18n();
  const bodyRef = useRef(null);
  const queryInputRef = useRef(null);
  const displayQuery = (query || "").trim() || "Untitled";
  const queryEditable = Boolean(onQueryChange);
  const typeEditable = Boolean(onDataTypeChange);
  const parentSelectable = Boolean(onParentDocIdChange);
  const adoptableDocs = listAdoptableDocs(docs, { parentObjectId });
  const adoptableDocsById = Object.fromEntries(adoptableDocs.map((d) => [d.id, d]));
  const resolvedParentDocId = resolveNodeParentDocId(
    parentDocId ? { parentDocId } : null,
    null,
    adoptableDocsById,
    { parentObjectId },
  );
  const dateEditable = Boolean(onCreatedDateChange);
  const handleDismiss = onBackToDocument || onClose;
  const showCloseButton = Boolean(handleDismiss);
  const setActiveNodeQueryDraft = useUIStateStore((s) => s.setActiveNodeQueryDraft);
  const triggerIntelSearchFromNode = useUIStateStore((s) => s.triggerIntelSearchFromNode);
  const intelSearchStatus = useUIStateStore((s) => s.intelSearchStatus);

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

  const calendarPayload =
    dataType === NODE_DATA_TYPES.TEXT ? parseCalendarEventNodeContent(content) : null;

  useEffect(() => {
    bodyRef.current?.focus();
  }, [dataType]);

  const syncQueryInputHeight = useCallback(() => {
    const el = queryInputRef.current;
    if (!el) return;
    const maxHeight = 128;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    syncQueryInputHeight();
  }, [query, syncQueryInputHeight]);

  useEffect(() => {
    setActiveNodeQueryDraft(displayQuery);
    return () => setActiveNodeQueryDraft("");
  }, [displayQuery, setActiveNodeQueryDraft]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDismiss]);

  const handleSearchClick = () => {
    const queryText = (displayQuery || "").trim() || displayQuery;
    if (!queryText || intelSearchStatus === "loading") return;
    triggerIntelSearchFromNode(queryText);
    runIntelSearch({
      query: queryText,
      queryNodeEntityId: intelSearchMeta?.queryNodeEntityId ?? null,
      queryCanvasNodeId: intelSearchMeta?.queryCanvasNodeId ?? null,
      docId: intelSearchMeta?.docId ?? null,
      blockIndex: intelSearchMeta?.blockIndex ?? null,
    });
    if (onSendToIntelSearch) {
      onSendToIntelSearch();
      return;
    }
    onClose?.();
  };

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
          <div
            className={
              "node-query-modal__head-top"
              + (showCloseButton ? " node-query-modal__head-top--closable" : "")
            }
          >
            <img className="node-query-modal__node-icon" src={NODE_ICON} alt="" aria-hidden />
            {parentSelectable ? (
              <select
                className="node-query-modal__parent-select"
                value={resolvedParentDocId}
                onChange={(e) => onParentDocIdChange(e.target.value || null)}
                aria-label={t("canvas.parentDocLabel")}
              >
                <option value="">{t("canvas.noParentDoc")}</option>
                {adoptableDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {resolveAdoptableDocLabel(d)}
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
            {showCloseButton ? (
              <button
                type="button"
                className="doc-new-head-expand-btn node-query-modal__close"
                onClick={handleDismiss}
                aria-label="Close"
              >
                <span className="doc-new-head-close-x" aria-hidden>×</span>
              </button>
            ) : null}
          </div>

          {queryEditable ? (
            <div className="node-query-modal__query-edit" id="node-query-modal-title">
              <textarea
                ref={queryInputRef}
                className="node-query-modal__query-input"
                value={query}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  syncQueryInputHeight();
                }}
                rows={1}
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
        </header>

        <div
          className={
            "node-query-modal__content-box"
            + (calendarPayload ? " node-query-modal__content-box--calendar" : "")
          }
        >
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
          ) : calendarPayload ? (
            <CalendarEventNodeView
              content={content}
              className="node-query-modal__calendar-body"
            />
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
        </div>

        {showScheduleAnchor ? (
          <BlockAnchorFields
            className="node-query-modal__schedule"
            anchorDate={anchorDate}
            anchorTime={anchorTime}
            onAnchorDateChange={onAnchorDateChange}
            onAnchorTimeChange={onAnchorTimeChange}
          />
        ) : null}

        <footer className="node-query-modal__actions">
          {onSave && !onBackToDocument ? (
            <button
              type="button"
              className="node-query-modal__action node-query-modal__action--save"
              onClick={onSave}
            >
              <img src={NODE_SAVE_ARCHIVE_ICON} alt="" aria-hidden />
              <span className="node-query-modal__save-text">save</span>
            </button>
          ) : null}
          <IntelSearchButton
            variant="modal"
            loading={intelSearchStatus === "loading"}
            onClick={handleSearchClick}
            title="Send query to Intel search and close"
          />
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
