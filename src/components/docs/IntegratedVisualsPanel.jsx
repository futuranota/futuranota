import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import {
  filterIntegratedVisuals,
  listIntegratedVisualsFromBlocks,
} from "../../lib/listIntegratedVisuals.js";
import { LibrarySponsoredTag } from "./LibrarySponsoredTag.jsx";

/**
 * Side panel: visual Prompts already linked in the open document body.
 * Rows = [thumb | name]. Opens detail via onOpenItem.
 */
export function IntegratedVisualsPanel({
  open,
  blocks = [],
  documentId = "",
  folderId = "",
  /** When set, a companion preview card is open — panel stays bright. */
  previewItemId = "",
  onClose,
  onOpenItem,
}) {
  const previewOpen = Boolean(String(previewItemId || "").trim());
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => listIntegratedVisualsFromBlocks(blocks, documentId, folderId),
    [blocks, documentId, folderId],
  );
  const filtered = useMemo(
    () => filterIntegratedVisuals(rows, query),
    [rows, query],
  );

  useEffect(() => {
    if (!open || previewOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, previewOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={
        "integrated-visuals-overlay"
        + (previewOpen ? " integrated-visuals-overlay--preview-open" : "")
      }
      role="presentation"
    >
      <button
        type="button"
        className="integrated-visuals-overlay__backdrop"
        aria-label={t("doc.library.integratedVisualsClose")}
        aria-hidden={previewOpen}
        onClick={previewOpen ? undefined : onClose}
      />
      <aside
        className="integrated-visuals-panel"
        role="dialog"
        aria-label={t("doc.library.integratedVisualsTitle")}
      >
        <header className="integrated-visuals-panel__head">
          <h2 className="integrated-visuals-panel__title">
            {t("doc.library.integratedVisualsTitle")}
          </h2>
          <button
            type="button"
            className="integrated-visuals-panel__close"
            onClick={onClose}
            aria-label={t("doc.library.integratedVisualsClose")}
          >
            ×
          </button>
        </header>

        <div className="integrated-visuals-panel__search">
          <input
            className="integrated-visuals-panel__search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("doc.library.integratedVisualsSearch")}
            aria-label={t("doc.library.integratedVisualsSearch")}
            autoFocus
          />
        </div>

        <div className="integrated-visuals-panel__list scroll-match-bg">
          {filtered.length === 0 ? (
            <p className="integrated-visuals-panel__empty">
              {rows.length === 0
                ? t("doc.library.integratedVisualsEmpty")
                : t("doc.library.integratedVisualsEmptyFilter")}
            </p>
          ) : (
            filtered.map((row) => (
              <button
                key={row.itemId}
                type="button"
                className={
                  "integrated-visuals-panel__row"
                  + (previewOpen && row.itemId === previewItemId ? " is-active" : "")
                }
                onClick={() => onOpenItem?.(row)}
              >
                <span className="integrated-visuals-panel__thumb-wrap">
                  <img
                    className="integrated-visuals-panel__thumb"
                    src={row.mediaUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                  />
                  {row.sponsored ? (
                    <LibrarySponsoredTag
                      label={t("doc.library.sponsoredTag")}
                      className="library-sponsored-tag--overlay"
                    />
                  ) : null}
                </span>
                <span className="integrated-visuals-panel__meta">
                  <span className="integrated-visuals-panel__name-row">
                    <span className="integrated-visuals-panel__name">{row.tag}</span>
                    {row.sponsored ? (
                      <LibrarySponsoredTag label={t("doc.library.sponsoredTag")} />
                    ) : null}
                  </span>
                  {row.aliases?.length ? (
                    <span className="integrated-visuals-panel__aliases">
                      {row.aliases.join(" · ")}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
