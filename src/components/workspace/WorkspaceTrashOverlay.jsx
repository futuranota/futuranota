import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import {
  listTrashItems,
  restoreTrashEntry,
  TRASH_CHANGED_EVENT,
} from "../../lib/workspaceTrashArchive.js";

function formatDeletedAt(iso, locale) {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "";
  try {
    return new Date(t).toLocaleString(locale === "es" ? "es" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(t).toLocaleString();
  }
}

function kindLabel(kind, t) {
  if (kind === "company_bundle") return t("trash.kindCompany");
  if (kind === "folder") return t("trash.kindFolder");
  return t("trash.kindDocument");
}

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function WorkspaceTrashOverlay({ open, onClose }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [restoringId, setRestoringId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const onTrashChanged = () => setRevision((value) => value + 1);
    window.addEventListener(TRASH_CHANGED_EVENT, onTrashChanged);
    return () => window.removeEventListener(TRASH_CHANGED_EVENT, onTrashChanged);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(
    () => listTrashItems({ query }),
    [query, revision],
  );

  const handleRestore = async (entryId) => {
    if (!entryId || restoringId) return;
    setRestoringId(entryId);
    setMessage("");
    try {
      const result = restoreTrashEntry(entryId);
      if (!result.ok) {
        setMessage(t("trash.restoreFailed"));
        return;
      }
      setMessage(t("trash.restoreSuccess", { title: result.title || "" }));
      setRevision((value) => value + 1);
    } finally {
      setRestoringId(null);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="workspace-trash-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("trash.title")}
    >
      <div className="workspace-trash-overlay__shell">
        <header className="workspace-trash-overlay__header">
          <div className="workspace-trash-overlay__title-wrap">
            <h2 className="workspace-trash-overlay__title">{t("trash.title")}</h2>
            <p className="workspace-trash-overlay__subtitle">{t("trash.subtitle")}</p>
          </div>
          <div className="workspace-trash-overlay__search-wrap">
            <span className="workspace-trash-overlay__search-icon" aria-hidden />
            <input
              type="search"
              className="workspace-trash-overlay__search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("trash.searchPlaceholder")}
              aria-label={t("trash.searchPlaceholder")}
            />
          </div>
          <button
            type="button"
            className="workspace-trash-overlay__close"
            onClick={onClose}
            aria-label={t("trash.close")}
          >
            ×
          </button>
        </header>

        <div className="workspace-trash-overlay__body scroll-match-bg">
          {message ? (
            <p className="workspace-trash-overlay__message">{message}</p>
          ) : null}
          {filtered.length ? (
            <ul className="workspace-trash-list">
              {filtered.map((item) => (
                <li key={item.id} className="workspace-trash-list__row">
                  <div className="workspace-trash-list__main">
                    <span className="workspace-trash-list__kind">
                      {kindLabel(item.kind, t)}
                    </span>
                    <span className="workspace-trash-list__title">{item.title}</span>
                    <span className="workspace-trash-list__meta">
                      {item.subtitle}
                      {item.documentCount > 0
                        ? ` · ${t("trash.filesCount", { count: item.documentCount })}`
                        : ""}
                      {item.deletedAt
                        ? ` · ${formatDeletedAt(item.deletedAt, locale)}`
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="workspace-trash-list__restore"
                    disabled={restoringId === item.id}
                    onClick={() => handleRestore(item.id)}
                  >
                    {restoringId === item.id ? t("trash.restoring") : t("trash.restore")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="workspace-trash-overlay__empty">
              <p>{t("trash.emptyTitle")}</p>
              <p className="dim">{t("trash.emptyHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
