import { useMemo, useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedStepPlaybooks,
  filterStepPlaybooks,
} from "../../lib/stepsLibrary.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(playbook: import("../../lib/stepsLibrary.js").StepPlaybookRef) => void} props.onRunPlaybook
 * @param {() => void} props.onNew
 * @param {(docId: string, options?: { focusBlockId?: string }) => void} [props.onOpenDocument]
 */
export function StepsLibraryPanel({
  objectId = null,
  onClose,
  onRunPlaybook,
  onNew,
  onOpenDocument,
}) {
  const { t } = useI18n();
  const docs = useDocsStore((s) => s.docs);
  const [query, setQuery] = useState("");

  const playbooks = useMemo(
    () => collectSavedStepPlaybooks(docs, { objectId }),
    [docs, objectId],
  );

  const filtered = useMemo(
    () => filterStepPlaybooks(playbooks, query),
    [playbooks, query],
  );

  return (
    <div className="lp-pack-import-detail steps-library-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head steps-library-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={onClose}
            aria-label={t("common.back")}
            title={t("common.back")}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
          </button>
          <h3 className="pack-wizard__title steps-library-panel__title">{t("pack.stepsLibraryTitle")}</h3>
        </div>

        <div className="pack-wizard__body steps-library-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("stepsLibrary.enterCompanyFirst")}</p>
          ) : (
            <>
              <div className="steps-library-panel__toolbar">
                <input
                  type="search"
                  className="steps-library-panel__search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("stepsLibrary.searchPlaceholder")}
                  aria-label={t("stepsLibrary.searchPlaceholder")}
                />
                <button
                  type="button"
                  className="btn xs pack-actions__btn steps-library-panel__new-btn"
                  onClick={onNew}
                >
                  {t("stepsLibrary.new")}
                </button>
              </div>

              {filtered.length ? (
                <ul className="steps-library-panel__list">
                  {filtered.map((playbook) => (
                    <li key={playbook.id} className="steps-library-panel__item">
                      <div className="steps-library-panel__item-main">
                        <div className="steps-library-panel__item-head">
                          <span className="steps-library-panel__item-title">{playbook.title}</span>
                          <span className="steps-library-panel__item-meta mono-sm">
                            {t("stepsLibrary.stepCount", { count: playbook.stepCount })}
                          </span>
                        </div>
                        {playbook.preview ? (
                          <p className="steps-library-panel__item-preview">{playbook.preview}</p>
                        ) : null}
                        <div className="steps-library-panel__item-chips">
                          <span className="steps-library-panel__chip">{playbook.docKind}</span>
                          {playbook.category ? (
                            <span className="steps-library-panel__chip">{playbook.category}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="steps-library-panel__item-actions">
                        <button
                          type="button"
                          className="btn xs pack-actions__btn steps-library-panel__run-btn"
                          onClick={() => onRunPlaybook?.(playbook)}
                        >
                          {t("stepsLibrary.run")}
                        </button>
                        {onOpenDocument ? (
                          <button
                            type="button"
                            className="btn xs steps-library-panel__source-btn"
                            onClick={() => onOpenDocument(playbook.docId, { focusBlockId: playbook.blockId })}
                          >
                            {t("stepsLibrary.openSource")}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
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
