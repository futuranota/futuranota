import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import {
  KNOWLEDGE_FILE_ACCEPT,
  importKnowledgeFile,
  formatKnowledgeFileSize,
} from "../../lib/knowledgeImport.js";
import { resolveKnowledgeDocDisplayTitle } from "../../lib/templateDoc.js";

/**
 * Dashboard overlay for Gina Knowledge — upload file + context per document.
 *
 * @param {{
 *   knowledgeDocs?: object[],
 *   isAdmin?: boolean,
 *   onOpenDocument?: (docId: string) => void,
 *   onCreateKnowledge?: (payload: {
 *     title: string,
 *     body: string,
 *     knowledgeImport?: object | null,
 *   }) => void | Promise<void>,
 *   onDeleteKnowledge?: (docId: string) => void,
 *   onClose: () => void,
 * }} props
 */
export function GinaKnowledgeOverlay({
  knowledgeDocs = [],
  isAdmin = false,
  onOpenDocument,
  onCreateKnowledge,
  onDeleteKnowledge,
  onClose,
}) {
  const { t } = useI18n();
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [pendingFile, setPendingFile] = useState(
    /** @type {{ title: string, knowledgeImport: object, textContent?: string } | null} */ (null),
  );
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const canSave = Boolean(
    isAdmin
    && onCreateKnowledge
    && (pendingFile || context.trim() || title.trim()),
  );

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setHint(null);
    setBusy(true);
    try {
      const data = await importKnowledgeFile(file);
      setPendingFile(data);
      if (!title.trim() && data.title) setTitle(data.title);
    } catch (err) {
      setHint(err?.message || t("gina.knowledgeUploadFailed"));
      setPendingFile(null);
    } finally {
      setBusy(false);
    }
  };

  const saveKnowledge = async () => {
    if (!canSave) return;
    setBusy(true);
    setHint(null);
    try {
      const fileText = String(pendingFile?.textContent || "").trim();
      const notes = context.trim();
      const parts = [];
      if (notes) {
        parts.push(`${t("gina.knowledgeContextHeading")}\n${notes}`);
      }
      if (fileText) {
        const fname = pendingFile?.knowledgeImport?.fileName || "file";
        parts.push(`${t("gina.knowledgeFileHeading").replace("{name}", fname)}\n${fileText}`);
      } else if (pendingFile?.knowledgeImport?.fileName) {
        parts.push(
          t("gina.knowledgeFileAttachedOnly").replace(
            "{name}",
            pendingFile.knowledgeImport.fileName,
          ),
        );
      }
      const body = parts.join("\n\n").trim();
      const docTitle = title.trim()
        || pendingFile?.title
        || t("gina.knowledgeUntitled");

      if (!body && !pendingFile?.knowledgeImport) {
        setHint(t("gina.knowledgeNeedContent"));
        return;
      }

      await onCreateKnowledge?.({
        title: docTitle,
        body: body || notes || docTitle,
        knowledgeImport: pendingFile?.knowledgeImport || null,
      });
      setTitle("");
      setContext("");
      setPendingFile(null);
      setHint(t("gina.knowledgeSavedOk").replace("{title}", docTitle));
    } catch (err) {
      setHint(err?.message || t("gina.knowledgeUploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="gina-knowledge-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="gina-knowledge-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("gina.knowledgeDialogAria")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="gina-knowledge-overlay__header">
          <div>
            <p className="gina-knowledge-overlay__eyebrow">{t("gina.name")}</p>
            <h2 className="gina-knowledge-overlay__title">{t("gina.knowledgeTitle")}</h2>
            <p className="gina-knowledge-overlay__desc">{t("gina.knowledgeOverlayDesc")}</p>
          </div>
          <button
            type="button"
            className="gina-knowledge-overlay__close"
            onClick={() => onClose?.()}
            aria-label={t("gina.closeAria")}
          >
            ×
          </button>
        </header>

        <div className="gina-knowledge-overlay__body">
          <div className="gina-knowledge-overlay__list-wrap">
            <h3 className="gina-knowledge-overlay__section-title">
              {t("gina.knowledgeLibrary")}
            </h3>
            <ul className="gina-knowledge-overlay__list">
              {knowledgeDocs.map((doc) => {
                const label = resolveKnowledgeDocDisplayTitle(doc);
                const fileName = doc.knowledgeImport?.fileName;
                return (
                  <li key={doc.id} className="gina-knowledge-overlay__item">
                    <button
                      type="button"
                      className="gina-knowledge-overlay__item-open"
                      onClick={() => {
                        onOpenDocument?.(doc.id);
                        onClose?.();
                      }}
                    >
                      <span className="gina-knowledge-overlay__item-title">{label}</span>
                      <span className="gina-knowledge-overlay__item-meta">
                        {fileName || t("gina.knowledgeSourceContext")}
                      </span>
                    </button>
                    {isAdmin && onDeleteKnowledge ? (
                      <button
                        type="button"
                        className="gina-knowledge-overlay__item-remove"
                        onClick={() => onDeleteKnowledge(doc.id)}
                      >
                        {t("gina.knowledgeRemove")}
                      </button>
                    ) : null}
                  </li>
                );
              })}
              {!knowledgeDocs.length ? (
                <li className="gina-knowledge-overlay__empty">{t("gina.knowledgeEmpty")}</li>
              ) : null}
            </ul>
          </div>

          {isAdmin ? (
            <div className="gina-knowledge-overlay__compose">
              <h3 className="gina-knowledge-overlay__section-title">
                {t("gina.knowledgeAddNew")}
              </h3>
              <input
                className="gina-knowledge-overlay__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("gina.knowledgeTitlePlaceholder")}
                disabled={busy}
              />
              <textarea
                className="gina-knowledge-overlay__textarea"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={t("gina.knowledgeBodyPlaceholder")}
                rows={5}
                disabled={busy}
              />

              {pendingFile?.knowledgeImport ? (
                <div className="gina-knowledge-overlay__file">
                  <span>
                    {pendingFile.knowledgeImport.fileName}
                    {pendingFile.knowledgeImport.sizeBytes
                      ? ` · ${formatKnowledgeFileSize(pendingFile.knowledgeImport.sizeBytes)}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    className="gina-knowledge-overlay__item-remove"
                    onClick={() => setPendingFile(null)}
                  >
                    {t("gina.knowledgeRemove")}
                  </button>
                </div>
              ) : null}

              <div className="gina-knowledge-overlay__actions">
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {t("gina.knowledgeUpload")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={KNOWLEDGE_FILE_ACCEPT}
                  hidden
                  onChange={pickFile}
                />
                <button
                  type="button"
                  className="btn sm primary"
                  disabled={!canSave || busy}
                  onClick={saveKnowledge}
                >
                  {t("gina.knowledgeSave")}
                </button>
              </div>
              {hint ? <p className="gina-knowledge-overlay__hint">{hint}</p> : null}
            </div>
          ) : (
            <p className="gina-knowledge-overlay__hint dim">{t("gina.knowledgeAdminOnly")}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default GinaKnowledgeOverlay;
