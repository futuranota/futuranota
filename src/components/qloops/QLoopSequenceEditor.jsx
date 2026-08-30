import { useCallback, useLayoutEffect, useRef } from "react";
import {
  createQLoopEntry,
  finalizeQLoopSequence,
  normalizeQLoopQueries,
  qloopEntryHasContent,
  swapQLoopEntryTextAt,
} from "../../lib/docBlocks.js";
import { useI18n } from "../../i18n/useI18n.js";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";

function resizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * @param {Object} props
 * @param {string} props.blockId
 * @param {string} props.title
 * @param {import("../../lib/docBlocks.js").QLoopEntry[]} props.queries
 * @param {boolean} [props.saving]
 * @param {(title: string) => void} [props.onTitleChange]
 * @param {(queries: import("../../lib/docBlocks.js").QLoopEntry[]) => void} [props.onQueriesChange]
 * @param {(queries: import("../../lib/docBlocks.js").QLoopEntry[]) => void | Promise<void>} [props.onSaved]
 */
export function QLoopSequenceEditor({
  blockId,
  title,
  queries,
  saving = false,
  onTitleChange,
  onQueriesChange,
  onSaved,
}) {
  const { t } = useI18n();
  const editorRef = useRef(null);
  const normalized = normalizeQLoopQueries(queries || []);

  const updateQueries = useCallback((next) => {
    onQueriesChange?.(normalizeQLoopQueries(next));
  }, [onQueriesChange]);

  useLayoutEffect(() => {
    if (!editorRef.current) return;
    editorRef.current
      .querySelectorAll(".qloop-sequence-editor__loop-title, .qloop-sequence-editor__query-title")
      .forEach((el) => resizeTextarea(el));
  }, [title, normalized]);

  const handleTitleInput = (event) => {
    resizeTextarea(event.currentTarget);
    onTitleChange?.(event.target.value);
  };

  const handleTitleChange = (entryId, value) => {
    updateQueries(normalized.map((entry) => (
      entry.id === entryId ? { ...entry, title: value } : entry
    )));
  };

  const handleDescriptionChange = (entryId, value) => {
    updateQueries(normalized.map((entry) => (
      entry.id === entryId ? { ...entry, description: value } : entry
    )));
  };

  const handleAddQuery = () => {
    updateQueries([
      ...normalized,
      createQLoopEntry({ index: normalized.length + 1 }),
    ]);
  };

  const handleRemoveQuery = (entryId) => {
    if (normalized.length <= 1) return;
    updateQueries(normalized.filter((entry) => entry.id !== entryId));
  };

  const handleMoveQuery = (slotIndex, direction) => {
    updateQueries(swapQLoopEntryTextAt(normalized, slotIndex, direction));
  };

  const handleSave = () => {
    if (saving) return;
    const finalized = finalizeQLoopSequence(normalized);
    const hasContent = String(title ?? "").trim() || finalized.some(qloopEntryHasContent);
    if (!hasContent) return;
    onSaved?.(finalized);
  };

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  const handleQueryTitleInput = (entryId, event) => {
    resizeTextarea(event.currentTarget);
    handleTitleChange(entryId, event.target.value);
  };

  return (
    <div className="qloop-sequence-editor" data-block-id={blockId} ref={editorRef}>
      <div className="qloop-sequence-editor__head">
        <label className="qloop-sequence-editor__loop-label" htmlFor={`qloop-loop-title-${blockId}`}>
          {t("qloopEditor.loopTitleLabel")}
        </label>
        <textarea
          id={`qloop-loop-title-${blockId}`}
          className="qloop-sequence-editor__loop-title scroll-match-bg"
          value={title}
          placeholder={t("qloopEditor.loopTitlePlaceholder")}
          rows={1}
          onChange={handleTitleInput}
          onInput={handleTitleInput}
          onKeyDown={stopBubble}
          onKeyUp={stopBubble}
          onMouseDown={stopBubble}
          disabled={saving}
        />
      </div>

      <div className="qloop-sequence-editor__slots">
        {normalized.map((entry, slotIndex) => (
          <div key={entry.id} className="qloop-sequence-editor__slot">
            <div className="qloop-sequence-editor__slot-head">
              <span className="qloop-sequence-editor__index" aria-hidden>
                {slotIndex + 1}
              </span>
              <div className="qloop-sequence-editor__slot-actions">
                <button
                  type="button"
                  className="btn xs ghost qloop-sequence-editor__move"
                  onClick={() => handleMoveQuery(slotIndex, -1)}
                  disabled={saving || slotIndex <= 0}
                  aria-label={t("qloopEditor.moveUp")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn xs ghost qloop-sequence-editor__move"
                  onClick={() => handleMoveQuery(slotIndex, 1)}
                  disabled={saving || slotIndex >= normalized.length - 1}
                  aria-label={t("qloopEditor.moveDown")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn xs ghost qloop-sequence-editor__remove"
                  onClick={() => handleRemoveQuery(entry.id)}
                  disabled={saving || normalized.length <= 1}
                  aria-label={t("qloopEditor.removeQuery")}
                >
                  ×
                </button>
              </div>
            </div>
            <textarea
              className="qloop-sequence-editor__query-title scroll-match-bg"
              value={entry.title}
              placeholder={t("qloopEditor.queryTitlePlaceholder")}
              rows={1}
              onChange={(e) => handleQueryTitleInput(entry.id, e)}
              onInput={(e) => handleQueryTitleInput(entry.id, e)}
              onKeyDown={stopBubble}
              onKeyUp={stopBubble}
              onMouseDown={stopBubble}
              disabled={saving}
            />
            <textarea
              className="qloop-sequence-editor__query-description scroll-match-bg"
              value={entry.description}
              placeholder={t("qloopEditor.queryDescriptionPlaceholder")}
              rows={2}
              onChange={(e) => handleDescriptionChange(entry.id, e.target.value)}
              onKeyDown={stopBubble}
              onKeyUp={stopBubble}
              onMouseDown={stopBubble}
              disabled={saving}
            />
          </div>
        ))}
      </div>

      <div className="qloop-sequence-editor__footer">
        <button
          type="button"
          className="qloop-sequence-editor__add"
          onClick={handleAddQuery}
          disabled={saving}
          aria-label={t("qloopEditor.addQueryAria")}
          title={t("qloopEditor.addQueryAria")}
        >
          +
        </button>
        <button
          type="button"
          className={
            "doc-new-action doc-new-action--save qloop-sequence-editor__save"
            + (saving ? " doc-new-action--save-loading" : "")
          }
          onClick={handleSave}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? <SearchSpinner size={14} /> : null}
          {saving ? t("common.saving") : t("qloopEditor.save")}
        </button>
      </div>
    </div>
  );
}
