import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  NODE_ICON,
  NODE_SAVE_ARCHIVE_ICON,
  ARROWS_OUT_ICON,
} from "../../lib/docMediumAssets.js";
import { IntelSearchButton } from "../shared/IntelSearchButton.jsx";
import { runIntelSearch } from "../../lib/intelSearch.js";
import { MetricFieldsEditor } from "../shared/MetricFieldsEditor.jsx";
import { BlockAnchorFields } from "../docs/blocks/BlockAnchorFields.jsx";
import { SlashAwareTextarea } from "../docs/blocks/SlashAwareTextarea.jsx";
import { DocSlashCommandPicker } from "../docs/blocks/DocSlashCommandPicker.jsx";
import { DocTodoPlanBlockView } from "../docs/blocks/DocTodoPlanBlockView.jsx";
import { NodeInlineTodoStack } from "./NodeInlineTodoStack.jsx";
import { createTodoItem } from "../../lib/docBlocks.js";
import {
  applySlashTailToNodeField,
  initialNodeShapeFromSlash,
  isNodeSlashCommandEnabled,
  NODE_SLASH_COMMANDS,
  parseNodeSlashQuery,
  splitBodyForSlash,
} from "../../lib/docBlockSlash.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  createInlineTodoBlock,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../../lib/nodeInlineContent.js";
import {
  normalizeNodeTodoContent,
} from "../../lib/nodeTodoContent.js";
import { mergeVideoNodeContent } from "../../lib/videoEmbed.js";
import { VideoEmbedBar } from "../intel/VideoEmbedBar.jsx";
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
  initialContentFocus = false,
  onSendToIntelSearch,
  onInsertToCanvas: _onInsertToCanvas,
  entityNodeId = null,
  intelSearchMeta = null,
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  embedded = false,
}) {
  const { t } = useI18n();
  const bodyRef = useRef(null);
  const queryInputRef = useRef(null);
  const contentScrollRef = useRef(null);
  const [contentFocusMode, setContentFocusMode] = useState(initialContentFocus);
  const [todoFocusItemId, setTodoFocusItemId] = useState(null);
  const [inlineTodoFocusTarget, setInlineTodoFocusTarget] = useState(null);
  const displayQuery = (query || "").trim() || "Untitled";
  const queryEditable = Boolean(onQueryChange);
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
  const showCloseButton = Boolean(onClose && !onBackToDocument);
  const showReturnLink = Boolean(onBackToDocument);
  const showExpandButton = !contentFocusMode;
  const toggleContentFocus = useCallback(() => {
    setContentFocusMode((value) => !value);
  }, []);
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

  const checkboxTodoContent =
    dataType === "checkbox"
      ? normalizeNodeTodoContent(content, displayQuery || "Todo list:")
      : null;

  const updateTodoContent = useCallback((patch) => {
    if (!checkboxTodoContent) return;
    onContentChange({ ...checkboxTodoContent, ...patch });
  }, [checkboxTodoContent, onContentChange]);

  const handleTodoItemKeyDown = useCallback((itemIndex, e) => {
    if (!checkboxTodoContent) return;
    const items = checkboxTodoContent.items || [];
    const item = items[itemIndex];
    if (!item) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newItem = createTodoItem({ text: "" });
      const nextItems = [
        ...items.slice(0, itemIndex + 1),
        newItem,
        ...items.slice(itemIndex + 1),
      ];
      updateTodoContent({ items: nextItems });
      setTodoFocusItemId(newItem.id);
    }
  }, [checkboxTodoContent, updateTodoContent]);

  const showScheduleAnchor =
    Boolean(onAnchorDateChange)
    && (dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX);

  const calendarPayload =
    dataType === NODE_DATA_TYPES.TEXT ? parseCalendarEventNodeContent(content) : null;

  const textWritingBody =
    dataType === NODE_DATA_TYPES.TEXT && !calendarPayload
      ? parseNodeWritingBody(content)
      : null;

  const slashCommandsEnabled = Boolean(onDataTypeChange);

  const updateWritingBody = useCallback((patch) => {
    const current = parseNodeWritingBody(content);
    onContentChange(serializeNodeWritingBody({
      text: patch.text ?? current.text,
      todoBlocks: patch.todoBlocks ?? current.todoBlocks,
    }));
  }, [content, onContentChange]);

  const appendInlineTodoBlock = useCallback((textOverride) => {
    const current = parseNodeWritingBody(content);
    const nextBlock = createInlineTodoBlock();
    const nextBlocks = [...current.todoBlocks, nextBlock];
    updateWritingBody({
      text: textOverride ?? current.text,
      todoBlocks: nextBlocks,
    });
    setInlineTodoFocusTarget({
      blockIndex: nextBlocks.length - 1,
      itemId: nextBlock.items[0]?.id ?? null,
    });
  }, [content, updateWritingBody]);

  const applySlashFromAlias = useCallback((alias, textPrefix = "") => {
    const parsed = parseNodeSlashQuery(alias);
    if (
      parsed?.nodeDataType === NODE_DATA_TYPES.CHECKBOX
      && dataType === NODE_DATA_TYPES.TEXT
      && !calendarPayload
    ) {
      appendInlineTodoBlock(textPrefix);
      return;
    }
    if (!onDataTypeChange) return;
    const shape = initialNodeShapeFromSlash(alias, textPrefix);
    if (!shape) return;
    onDataTypeChange(shape.dataType);
    onContentChange(shape.content);
    if (shape.defaultTitle && onQueryChange && !(query || "").trim()) {
      onQueryChange(shape.defaultTitle);
    }
  }, [
    appendInlineTodoBlock,
    calendarPayload,
    dataType,
    onContentChange,
    onDataTypeChange,
    onQueryChange,
    query,
  ]);

  const confirmSlashInText = useCallback(() => {
    const current = parseNodeWritingBody(content);
    const { prefix, slash } = splitBodyForSlash(current.text);
    if (!slash) return false;
    const parsed = parseNodeSlashQuery(slash.slice(1));
    if (!parsed) return false;
    if (
      parsed.nodeDataType === NODE_DATA_TYPES.CHECKBOX
      && dataType === NODE_DATA_TYPES.TEXT
      && !calendarPayload
    ) {
      appendInlineTodoBlock(prefix);
      return true;
    }
    const shape = applySlashTailToNodeField(current.text);
    if (!shape) return false;
    onDataTypeChange?.(shape.dataType);
    onContentChange(shape.content);
    if (shape.defaultTitle && onQueryChange && !(query || "").trim()) {
      onQueryChange(shape.defaultTitle);
    }
    return true;
  }, [
    appendInlineTodoBlock,
    calendarPayload,
    content,
    dataType,
    onContentChange,
    onDataTypeChange,
    onQueryChange,
    query,
  ]);

  const handleTextSlashKeyDown = useCallback((e) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const text = textWritingBody?.text ?? "";
    const { slash } = splitBodyForSlash(text);
    if (!slash) return;
    const parsed = parseNodeSlashQuery(slash.slice(1));
    if (!parsed) return;
    e.preventDefault();
    confirmSlashInText();
  }, [confirmSlashInText, textWritingBody?.text]);

  useEffect(() => {
    if (dataType === "checkbox") return;
    bodyRef.current?.focus();
  }, [dataType]);

  useEffect(() => {
    setContentFocusMode(initialContentFocus);
  }, [initialContentFocus]);

  useEffect(() => {
    if (!contentFocusMode) return undefined;
    const frame = requestAnimationFrame(() => {
      contentScrollRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [contentFocusMode]);

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

  const modalCard = (
      <div
        className={
          "lp-modal node-query-modal"
          + (contentFocusMode ? " node-query-modal--content-focus" : "")
        }
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="node-query-modal-title"
      >
        <header className="node-query-modal__head">
          <div
            className={
              "node-query-modal__head-top"
              + ((showCloseButton || showReturnLink || showExpandButton) ? " node-query-modal__head-top--closable" : "")
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
                <option value="">{t("canvas.parentDocPlaceholder")}</option>
                {adoptableDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {resolveAdoptableDocLabel(d)}
                  </option>
                ))}
              </select>
            ) : parentDocLabel ? (
              <span className="node-query-modal__parent-doc">{parentDocLabel}</span>
            ) : null}
            <div className="node-query-modal__head-actions">
              {showReturnLink ? (
                <button
                  type="button"
                  className="node-query-modal__back-link"
                  onClick={onBackToDocument}
                >
                  {t("canvas.returnToDocument")}
                </button>
              ) : null}
              {showExpandButton ? (
                <button
                  type="button"
                  className="node-query-modal__expand-btn"
                  onClick={toggleContentFocus}
                  title={t("canvas.expandNode")}
                  aria-label={t("canvas.expandNode")}
                >
                  <img
                    className="node-query-modal__expand-btn-icon"
                    src={ARROWS_OUT_ICON}
                    alt=""
                    aria-hidden
                  />
                </button>
              ) : null}
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

          <div className="node-query-modal__created-row">
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
        </header>

        <div
          className={
            "node-query-modal__content-box"
            + (calendarPayload ? " node-query-modal__content-box--calendar" : "")
            + (slashCommandsEnabled ? " node-query-modal__content-box--slash" : "")
            + (dataType === "checkbox" ? " node-query-modal__content-box--todo" : "")
            + (contentFocusMode ? " node-query-modal__content-box--focus" : "")
          }
        >
          <div
            ref={contentScrollRef}
            tabIndex={-1}
            className={
              "node-query-modal__content-scroll"
              + (contentFocusMode ? " node-query-modal__content-scroll--focus" : "")
            }
          >
            <button
              type="button"
              className={
                "doc-new-content-expand-btn node-query-modal__content-expand-btn"
                + (contentFocusMode ? " is-focus" : "")
              }
              onClick={toggleContentFocus}
              aria-label={contentFocusMode ? t("canvas.collapseNode") : t("canvas.expandNode")}
              aria-pressed={contentFocusMode}
              title={contentFocusMode ? t("canvas.collapseNode") : t("canvas.expandNode")}
            >
              <span className="doc-new-content-expand-btn__icon" aria-hidden />
            </button>
          {dataType === NODE_DATA_TYPES.VIDEO ? (
            <VideoEmbedBar
              nodeId={entityNodeId}
              onEmbedChange={(parsed) => {
                onContentChange(mergeVideoNodeContent(content, {
                  rawInput: parsed.rawInput,
                  provider: parsed.provider,
                  videoId: parsed.videoId,
                  embedSrc: parsed.embedSrc,
                }));
              }}
            />
          ) : dataType === "date" ? (
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
            <div className="node-query-modal__todo">
              <DocTodoPlanBlockView
                listTitle={checkboxTodoContent.listTitle}
                onListTitleChange={(listTitle) => updateTodoContent({ listTitle })}
                linksEnabled={false}
                showDragHandle={false}
                items={checkboxTodoContent.items}
                focusItemId={todoFocusItemId}
                onItemsChange={(items) => updateTodoContent({ items })}
                onItemKeyDown={handleTodoItemKeyDown}
                onAddItem={() => {
                  const newItem = createTodoItem({ text: "" });
                  updateTodoContent({ items: [...checkboxTodoContent.items, newItem] });
                  setTodoFocusItemId(newItem.id);
                }}
              />
            </div>
          ) : dataType === NODE_DATA_TYPES.TEXT && !calendarPayload ? (
            <div className="node-query-modal__field-shell">
              {textWritingBody?.todoBlocks?.length ? (
                <NodeInlineTodoStack
                  className="node-query-modal__todo-stack"
                  todoBlocks={textWritingBody.todoBlocks}
                  onTodoBlocksChange={(todoBlocks) => updateWritingBody({ todoBlocks })}
                  focusTarget={inlineTodoFocusTarget}
                  onFocusTargetChange={setInlineTodoFocusTarget}
                />
              ) : null}
              <SlashAwareTextarea
                inputRef={bodyRef}
                className="node-query-modal__body node-query-modal__body--embedded"
                wrapClassName="node-query-modal__slash-wrap node-query-modal__slash-wrap--embedded"
                value={textWritingBody?.text ?? ""}
                placeholder={slashCommandsEnabled ? "Type your text here, or /todo for lists" : "Type your text here"}
                onChange={(value) => updateWritingBody({ text: value })}
                onKeyDown={slashCommandsEnabled ? handleTextSlashKeyDown : undefined}
                minHeightPx={72}
                maxHeightPx={320}
                ariaLabel="Contenido del nodo"
              />
            </div>
          ) : calendarPayload ? (
            <CalendarEventNodeView
              content={content}
              className="node-query-modal__calendar-body"
            />
          ) : (
            <SlashAwareTextarea
              inputRef={bodyRef}
              className="node-query-modal__body"
              wrapClassName="node-query-modal__slash-wrap"
              value={typeof content === "string" ? content : ""}
              placeholder="Type your text here"
              onChange={onContentChange}
              minHeightPx={120}
              maxHeightPx={320}
              ariaLabel="Contenido del nodo"
            />
          )}
          </div>
          {slashCommandsEnabled ? (
            <DocSlashCommandPicker
              variant="floating"
              commands={NODE_SLASH_COMMANDS}
              onSelectCommand={applySlashFromAlias}
              isCommandEnabled={isNodeSlashCommandEnabled}
            />
          ) : null}
        </div>

        <footer className="node-query-modal__footer-row">
          <div className="node-query-modal__footer-start">
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
          <div className="node-query-modal__footer-search">
            <IntelSearchButton
              variant="modal"
              loading={intelSearchStatus === "loading"}
              onClick={handleSearchClick}
              title="Send query to Intel search and close"
            />
          </div>
        </footer>
      </div>
  );

  if (embedded) {
    return modalCard;
  }

  const overlayClass = [
    "node-query-overlay",
    "lp-overlay--solid",
    "lp-overlay--center",
    contentFocusMode ? "node-query-overlay--content-focus" : "",
  ].filter(Boolean).join(" ");

  return createPortal(
    <div className={overlayClass} role="presentation">
      {modalCard}
    </div>,
    document.body,
  );
}
