import { useCallback, useMemo, useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedQLoops,
  filterQLoops,
  removeQLoopFromDoc,
} from "../../lib/qloopsLibrary.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(loop: import("../../lib/qloopsLibrary.js").QLoopRef) => void} props.onOpenLoop
 * @param {() => void} props.onNew
 * @param {(payload: { docId: string, blockId: string, docRemoved: boolean }) => void} [props.onLoopDeleted]
 */
export function QLoopsLibraryPanel({
  objectId = null,
  onClose,
  onOpenLoop,
  onNew,
  onLoopDeleted,
}) {
  const { t } = useI18n();
  const docs = useDocsStore((s) => s.docs);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const loops = useMemo(
    () => collectSavedQLoops(docs, { objectId }),
    [docs, objectId],
  );

  const filtered = useMemo(
    () => filterQLoops(loops, query),
    [loops, query],
  );

  const exitBulkSelectMode = useCallback(() => {
    setBulkSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectMode((active) => {
      if (active) {
        setSelectedIds([]);
        return false;
      }
      setSelectedIds([]);
      return true;
    });
  }, []);

  const toggleSelect = useCallback((id) => {
    if (!id) return;
    setSelectedIds((prev) => (
      prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
    ));
  }, []);

  const handleDeleteSelected = async () => {
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) return;
    const confirmed = await askConfirm({
      title: t("qloopsLibrary.deleteSelectedTitle"),
      message: t("qloopsLibrary.deleteSelectedConfirm", { count: ids.length }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    const selected = filtered.filter((loop) => ids.includes(loop.id));
    for (const loop of selected) {
      const doc = useDocsStore.getState().docs[loop.docId];
      if (!doc) continue;
      const { docRemoved } = removeQLoopFromDoc(loop, doc, updateDoc, deleteDoc);
      onLoopDeleted?.({
        docId: loop.docId,
        blockId: loop.blockId,
        docRemoved,
      });
    }
    exitBulkSelectMode();
  };

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="lp-pack-import-detail steps-library-panel qloops-library-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head steps-library-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={onClose}
            aria-label={`Back — ${t("pack.qloopsTitle")}`}
            title={`Back — ${t("pack.qloopsTitle")}`}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
            <span className="lp-click-folder-back-label is-lowercase">
              {t("pack.qloopsTitle")}
            </span>
          </button>
          {objectId ? (
            <button
              type="button"
              className={
                "lp-folder-density__btn lp-folder-select-btn"
                + (bulkSelectMode ? " is-active" : "")
              }
              onClick={toggleBulkSelectMode}
              title={
                bulkSelectMode
                  ? t("qloopsLibrary.selectActive")
                  : t("qloopsLibrary.selectTitle")
              }
              aria-label={t("qloopsLibrary.selectTitle")}
              aria-pressed={bulkSelectMode}
            >
              {t("qloopsLibrary.select")}
            </button>
          ) : null}
        </div>

        <div className="pack-wizard__body steps-library-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("qloopsLibrary.enterCompanyFirst")}</p>
          ) : (
            <>
              <div className="lp-library-toolbar">
                <div className="lp-library-search-wrap">
                  <span className="lp-library-search-icon" aria-hidden />
                  <input
                    type="search"
                    className="lp-library-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("qloopsLibrary.searchPlaceholder")}
                    aria-label={t("qloopsLibrary.searchPlaceholder")}
                    onKeyDown={stopBubble}
                    onKeyUp={stopBubble}
                    onMouseDown={stopBubble}
                  />
                </div>
                <button
                  type="button"
                  className="lp-library-new-btn"
                  onClick={onNew}
                  disabled={bulkSelectMode}
                >
                  {t("qloopsLibrary.new")}
                </button>
              </div>

              {bulkSelectMode ? (
                <div className="lp-folder-bulk-bar" role="status">
                  <span className="lp-folder-bulk-bar__count">
                    {t("qloopsLibrary.selectCount", { count: selectedIds.length })}
                  </span>
                  <div className="lp-folder-bulk-bar__actions">
                    <button
                      type="button"
                      className="btn xs ghost"
                      onClick={exitBulkSelectMode}
                    >
                      {t("qloopsLibrary.selectDone")}
                    </button>
                    <button
                      type="button"
                      className="btn xs lp-folder-bulk-bar__delete"
                      disabled={selectedIds.length === 0}
                      onClick={handleDeleteSelected}
                    >
                      {t("qloopsLibrary.deleteSelected")}
                    </button>
                  </div>
                </div>
              ) : null}

              {filtered.length ? (
                <ul
                  className={
                    "steps-library-panel__list"
                    + (bulkSelectMode ? " steps-library-panel__list--selecting" : "")
                  }
                >
                  {filtered.map((loop) => {
                    const selected = selectedIds.includes(loop.id);
                    return (
                      <li
                        key={loop.id}
                        className={
                          "steps-library-panel__row"
                          + (bulkSelectMode ? " steps-library-panel__row--select-mode" : "")
                          + (selected ? " is-selected" : "")
                        }
                      >
                        {bulkSelectMode ? (
                          <button
                            type="button"
                            className={
                              "steps-library-panel__card steps-library-panel__card--select"
                              + (selected ? " is-selected" : "")
                            }
                            onClick={() => toggleSelect(loop.id)}
                            aria-pressed={selected}
                          >
                            <span
                              className={
                                "lp-doc-nodes-block__check"
                                + (selected ? " is-checked" : "")
                              }
                              aria-hidden
                            />
                            <img
                              src="/uploads/RepeatOnce.svg"
                              alt=""
                              aria-hidden
                              className="steps-library-panel__card-icon"
                            />
                            <span className="steps-library-panel__card-body">
                              <span className="steps-library-panel__card-title">
                                {loop.title}
                              </span>
                              {loop.preview ? (
                                <span className="qloops-library-panel__card-preview dim">
                                  {loop.preview}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="steps-library-panel__card"
                            onClick={() => onOpenLoop?.(loop)}
                          >
                            <img
                              src="/uploads/RepeatOnce.svg"
                              alt=""
                              aria-hidden
                              className="steps-library-panel__card-icon"
                            />
                            <span className="steps-library-panel__card-body">
                              <span className="steps-library-panel__card-title">
                                {loop.title}
                              </span>
                              {loop.preview ? (
                                <span className="qloops-library-panel__card-preview dim">
                                  {loop.preview}
                                </span>
                              ) : null}
                            </span>
                            <span className="steps-library-panel__card-chevron" aria-hidden>
                              ›
                            </span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="lp-empty steps-library-panel__empty">
                  <p>{t("qloopsLibrary.emptyTitle")}</p>
                  <p className="dim">{t("qloopsLibrary.emptyHint")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
