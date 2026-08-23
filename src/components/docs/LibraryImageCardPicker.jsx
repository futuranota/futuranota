import { createPortal } from "react-dom";
import { useMemo } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems } from "../../hooks/useLibraryItems.js";
import { listAllLibraryCatalogs } from "../../lib/folderLibrary.js";
import { fichaHasVisual } from "../../lib/libraryFichaPreview.js";
import { flattenVisualPicksFromCatalogs } from "../../lib/libraryImageCardPick.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";

function renderPickFace(item) {
  if (fichaHasVisual(item)) {
    return (
      <img
        className="folder-library-overlay__cell-img"
        src={item.mediaUrl}
        alt=""
      />
    );
  }
  return (
    <span className="folder-library-overlay__cell-prompt">
      {String(item?.tag || "").trim() || "—"}
    </span>
  );
}

function PickGrid({ title, items, emptyMessage, onPick }) {
  return (
    <section className="library-image-card-picker__section">
      {title ? (
        <h3 className="library-image-card-picker__section-title">{title}</h3>
      ) : null}
      {items.length === 0 ? (
        <p className="library-image-card-picker__grid-empty">{emptyMessage}</p>
      ) : (
        <ul className="folder-library-overlay__grid library-image-card-picker__grid">
          {items.map((row) => (
            <li
              key={`${row.ownerKind}:${row.ownerId}:${row.item.id}`}
              className="folder-library-overlay__cell"
            >
              <button
                type="button"
                className="folder-library-overlay__cell-main"
                onClick={() => onPick(row.item, row.ownerKind, row.ownerId)}
              >
                {renderPickFace(row.item)}
                <span className="folder-library-overlay__cell-meta">
                  <span className="folder-library-overlay__cell-tag">{row.item.tag}</span>
                  {row.item.frameAspect ? (
                    <span className="folder-library-overlay__cell-frame">{row.item.frameAspect}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Pick a visual library ficha into an Image card or Moodboard frame.
 * Vertical grid: parent-folder assets, then remaining workspace images (no duplicates).
 */
export function LibraryImageCardPicker({
  folderId = "",
  documentId = "",
  layout = "segmentedStrip",
  titleKey = "doc.imageSplit.libraryPickerTitle",
  onPick,
  onClose,
}) {
  void layout;
  const { t } = useI18n();
  const docs = useDocsStore((s) => s.docs);
  const nodes = useNodesStore((s) => s.nodes);

  const resolvedDocumentId = String(documentId || "").trim();
  const resolvedFolderId = useMemo(() => {
    const fromProp = String(folderId || "").trim();
    if (fromProp) return fromProp;
    if (!resolvedDocumentId) return "";
    const node = nodes?.[resolvedDocumentId];
    return String(node?.parentDocId || "").trim();
  }, [folderId, resolvedDocumentId, nodes]);

  const folderItems = useLibraryItems("folder", resolvedFolderId);

  const folderStrip = useMemo(() => {
    const items = Array.isArray(folderItems) ? folderItems : [];
    return flattenVisualPicksFromCatalogs([
      { ownerKind: "folder", ownerId: resolvedFolderId, items },
    ]);
  }, [folderItems, resolvedFolderId]);

  const allStrip = useMemo(() => {
    return flattenVisualPicksFromCatalogs(listAllLibraryCatalogs(), {
      excludeFolderId: resolvedFolderId,
    });
  }, [docs, nodes, resolvedFolderId, folderItems]);

  const folderTitle = useMemo(() => {
    if (!resolvedFolderId) return t("doc.imageSplit.libraryPickerScopeFolder");
    const folder = docs?.[resolvedFolderId];
    return String(folder?.title || "").trim() || t("doc.imageSplit.libraryPickerScopeFolder");
  }, [resolvedFolderId, docs, t]);

  const segmentedEmpty = folderStrip.length === 0 && allStrip.length === 0;

  return createPortal(
    <div
      className="library-image-card-picker"
      role="dialog"
      aria-modal="true"
      aria-label={t(titleKey)}
    >
      <button
        type="button"
        className="library-image-card-picker__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="library-image-card-picker__shell">
        <header className="library-image-card-picker__header">
          <h2 className="library-image-card-picker__title">
            {t(titleKey)}
          </h2>
          <button
            type="button"
            className="library-image-card-picker__close"
            onClick={onClose}
            aria-label={t("doc.library.close")}
          >
            ×
          </button>
        </header>

        {segmentedEmpty ? (
          <p className="library-image-card-picker__empty">
            {t("doc.imageSplit.libraryPickerEmptyStrips")}
          </p>
        ) : (
          <div className="library-image-card-picker__body">
            {resolvedFolderId ? (
              <>
                <PickGrid
                  title={t("doc.imageSplit.libraryPickerFolderAssets", { title: folderTitle })}
                  items={folderStrip}
                  emptyMessage={t("doc.imageSplit.libraryPickerEmptyFolderAssets")}
                  onPick={onPick}
                />
                <hr className="library-image-card-picker__divider" />
              </>
            ) : null}
            <PickGrid
              title={t("doc.imageSplit.libraryPickerAllImages")}
              items={allStrip}
              emptyMessage={t("doc.imageSplit.libraryPickerEmptyAll")}
              onPick={onPick}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
