import { useCallback } from "react";
import {
  createQLoopEntry,
  finalizeQLoopSequence,
  normalizeQLoopQueries,
  qloopEntryHasContent,
} from "../../lib/docBlocks.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {Object} props
 * @param {string} props.blockId
 * @param {string} props.title
 * @param {import("../../lib/docBlocks.js").QLoopEntry[]} props.queries
 * @param {boolean} [props.saved]
 * @param {(title: string) => void} [props.onTitleChange]
 * @param {(queries: import("../../lib/docBlocks.js").QLoopEntry[]) => void} [props.onQueriesChange]
 * @param {(queries: import("../../lib/docBlocks.js").QLoopEntry[]) => void} [props.onSaved]
 */
export function QLoopSequenceEditor({
  blockId,
  title,
  queries,
  saved = false,
  onTitleChange,
  onQueriesChange,
  onSaved,
}) {
  const { t } = useI18n();
  const normalized = normalizeQLoopQueries(queries || []);

  const updateQueries = useCallback((next) => {
    onQueriesChange?.(normalizeQLoopQueries(next));
  }, [onQueriesChange]);

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

  const handleMoveQuery = (entryId, direction) => {
    const index = normalized.findIndex((entry) => entry.id === entryId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= normalized.length) return;
    const next = [...normalized];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateQueries(next);
  };

  const handleSave = () => {
    const finalized = finalizeQLoopSequence(normalized);
    const hasContent = String(title ?? "").trim() || finalized.some(qloopEntryHasContent);
    if (!hasContent) return;
    onSaved?.(finalized);
  };

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="qloop-sequence-editor" data-block-id={blockId}>
      <div className="qloop-sequence-editor__head">
        <label className="qloop-sequence-editor__loop-label" htmlFor={`qloop-loop-title-${blockId}`}>
          {t("qloopEditor.loopTitleLabel")}
        </label>
        <input
          id={`qloop-loop-title-${blockId}`}
          type="text"
          className="qloop-sequence-editor__loop-title"
          value={title}
          placeholder={t("qloopEditor.loopTitlePlaceholder")}
          onChange={(e) => onTitleChange?.(e.target.value)}
          onKeyDown={stopBubble}
          onKeyUp={stopBubble}
          onMouseDown={stopBubble}
        />
      </div>

      <div className="qloop-sequence-editor__slots">
        {normalized.map((entry) => (
          <div key={entry.id} className="qloop-sequence-editor__slot">
            <div className="qloop-sequence-editor__slot-head">
              <span className="qloop-sequence-editor__index" aria-hidden>
                {entry.index}
              </span>
              <div className="qloop-sequence-editor__slot-actions">
                <button
                  type="button"
                  className="btn xs ghost qloop-sequence-editor__move"
                  onClick={() => handleMoveQuery(entry.id, -1)}
                  disabled={entry.index <= 1}
                  aria-label={t("qloopEditor.moveUp")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn xs ghost qloop-sequence-editor__move"
                  onClick={() => handleMoveQuery(entry.id, 1)}
                  disabled={entry.index >= normalized.length}
                  aria-label={t("qloopEditor.moveDown")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn xs ghost qloop-sequence-editor__remove"
                  onClick={() => handleRemoveQuery(entry.id)}
                  disabled={normalized.length <= 1}
                  aria-label={t("qloopEditor.removeQuery")}
                >
                  ×
                </button>
              </div>
            </div>
            <input
              type="text"
              className="qloop-sequence-editor__query-title"
              value={entry.title}
              placeholder={t("qloopEditor.queryTitlePlaceholder")}
              onChange={(e) => handleTitleChange(entry.id, e.target.value)}
              onKeyDown={stopBubble}
              onKeyUp={stopBubble}
              onMouseDown={stopBubble}
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
            />
          </div>
        ))}
      </div>

      <div className="qloop-sequence-editor__footer">
        <button
          type="button"
          className="qloop-sequence-editor__add"
          onClick={handleAddQuery}
          aria-label={t("qloopEditor.addQueryAria")}
          title={t("qloopEditor.addQueryAria")}
        >
          +
        </button>
        <button
          type="button"
          className="doc-new-action doc-new-action--save qloop-sequence-editor__save"
          onClick={handleSave}
          disabled={saved}
        >
          {saved ? t("qloopEditor.saved") : t("qloopEditor.save")}
        </button>
      </div>
    </div>
  );
}
