import { useCallback, useMemo, useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedStepPlaybooks,
  filterStepPlaybooks,
  removeStepPlaybookFromDoc,
} from "../../lib/stepsLibrary.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(playbook: import("../../lib/stepsLibrary.js").StepPlaybookRef) => void} props.onRunPlaybook
 * @param {() => void} props.onNew
 * @param {(payload: { docId: string, blockId: string, docRemoved: boolean }) => void} [props.onPlaybookDeleted]
 */
export function StepsLibraryPanel({
  objectId = null,
  onClose,
  onRunPlaybook,
  onNew,
  onPlaybookDeleted,
}) {
  const { t } = useI18n();
  const docs = useDocsStore((s) => s.docs);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const playbooks = useMemo(
    () => collectSavedStepPlaybooks(docs, { objectId }),
    [docs, objectId],
  );

  const filtered = useMemo(
    () => filterStepPlaybooks(playbooks, query),
    [playbooks, query],
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

  const handleDeletePlaybook = async (playbook) => {
    const doc = docs[playbook.docId];
    if (!doc) return;

    const confirmed = await askConfirm({
      title: t("stepsLibrary.deleteTitle"),
      message: t("stepsLibrary.deleteConfirm", { title: playbook.title }),
      confirmLabel: t("stepsLibrary.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    const { docRemoved } = removeStepPlaybookFromDoc(playbook, doc, updateDoc, deleteDoc);
    onPlaybookDeleted?.({
      docId: playbook.docId,
      blockId: playbook.blockId,
      docRemoved,
    });
  };

  const handleDeleteSelected = async () => {
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) return;
    const confirmed = await askConfirm({
      title: t("stepsLibrary.deleteSelectedTitle"),
      message: t("stepsLibrary.deleteSelectedConfirm", { count: ids.length }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    const selected = filtered.filter((playbook) => ids.includes(playbook.id));
    for (const playbook of selected) {
      const doc = useDocsStore.getState().docs[playbook.docId];
      if (!doc) continue;
      const { docRemoved } = removeStepPlaybookFromDoc(playbook, doc, updateDoc, deleteDoc);
      onPlaybookDeleted?.({
        docId: playbook.docId,
        blockId: playbook.blockId,
        docRemoved,
      });
    }
    exitBulkSelectMode();
  };

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="lp-pack-import-detail steps-library-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head steps-library-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={onClose}
            aria-label={`Back — ${t("pack.stepsLibraryTitle")}`}
            title={`Back — ${t("pack.stepsLibraryTitle")}`}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
            <span className="lp-click-folder-back-label is-lowercase">
              {t("pack.stepsLibraryTitle")}
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
                  ? t("stepsLibrary.selectActive")
                  : t("stepsLibrary.selectTitle")
              }
              aria-label={t("stepsLibrary.selectTitle")}
              aria-pressed={bulkSelectMode}
            >
              {t("stepsLibrary.select")}
            </button>
          ) : null}
        </div>

        <div className="pack-wizard__body steps-library-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("stepsLibrary.enterCompanyFirst")}</p>
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
                    placeholder={t("stepsLibrary.searchPlaceholder")}
                    aria-label={t("stepsLibrary.searchPlaceholder")}
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
                  {t("stepsLibrary.new")}
                </button>
              </div>

              {bulkSelectMode ? (
                <div className="lp-folder-bulk-bar" role="status">
                  <span className="lp-folder-bulk-bar__count">
                    {t("stepsLibrary.selectCount", { count: selectedIds.length })}
                  </span>
                  <div className="lp-folder-bulk-bar__actions">
                    <button
                      type="button"
                      className="btn xs ghost"
                      onClick={exitBulkSelectMode}
                    >
                      {t("stepsLibrary.selectDone")}
                    </button>
                    <button
                      type="button"
                      className="btn xs lp-folder-bulk-bar__delete"
                      disabled={selectedIds.length === 0}
                      onClick={handleDeleteSelected}
                    >
                      {t("stepsLibrary.deleteSelected")}
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
                  {filtered.map((playbook) => {
                    const selected = selectedIds.includes(playbook.id);
                    return (
                      <li
                        key={playbook.id}
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
                            onClick={() => toggleSelect(playbook.id)}
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
                              src="/uploads/step-by-step.svg"
                              alt=""
                              aria-hidden
                              className="steps-library-panel__card-icon"
                            />
                            <span className="steps-library-panel__card-body">
                              <span className="steps-library-panel__card-title">
                                {playbook.title}
                              </span>
                            </span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="steps-library-panel__card"
                              onClick={() => onRunPlaybook?.(playbook)}
                            >
                              <img
                                src="/uploads/step-by-step.svg"
                                alt=""
                                aria-hidden
                                className="steps-library-panel__card-icon"
                              />
                              <span className="steps-library-panel__card-body">
                                <span className="steps-library-panel__card-title">
                                  {playbook.title}
                                </span>
                              </span>
                              <span className="steps-library-panel__card-chevron" aria-hidden>
                                ›
                              </span>
                            </button>
                            <button
                              type="button"
                              className="steps-library-panel__delete-btn"
                              onClick={() => handleDeletePlaybook(playbook)}
                              aria-label={t("stepsLibrary.delete")}
                              title={t("stepsLibrary.delete")}
                            >
                              {t("stepsLibrary.delete")}
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="lp-empty steps-library-panel__empty">
                  <p>{t("stepsLibrary.emptyTitle")}</p>
                  <p className="dim">{t("stepsLibrary.emptyHint")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
