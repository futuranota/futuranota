import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems } from "../../hooks/useLibraryItems.js";
import { listAllLibraryCatalogs } from "../../lib/folderLibrary.js";
import { fichaHasVisual } from "../../lib/libraryFichaPreview.js";
import { flattenVisualPicksFromCatalogs } from "../../lib/libraryImageCardPick.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";

function pickRowKey(ownerKind, ownerId, itemId) {
  return `${ownerKind}:${ownerId}:${itemId}`;
}

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

function PickGrid({ title, items, emptyMessage, onPick, selectedKey }) {
  return (
    <section className="library-image-card-picker__section">
      {title ? (
        <h3 className="library-image-card-picker__section-title">{title}</h3>
      ) : null}
      {items.length === 0 ? (
        <p className="library-image-card-picker__grid-empty">{emptyMessage}</p>
      ) : (
        <ul className="folder-library-overlay__grid library-image-card-picker__grid">
          {items.map((row) => {
            const key = pickRowKey(row.ownerKind, row.ownerId, row.item.id);
            const isSelected = selectedKey === key;
            return (
              <li
                key={key}
                className={
                  "folder-library-overlay__cell"
                  + (isSelected ? " is-selected" : "")
                }
              >
                <button
                  type="button"
                  className={
                    "folder-library-overlay__cell-main"
                    + (isSelected ? " is-selected" : "")
                  }
                  aria-pressed={isSelected}
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
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Pick a visual library ficha into an Image card or Moodboard frame.
 * Vertical grid: parent-folder assets, then remaining workspace images (no duplicates).
 *
 * When `onNext` is provided (moodboard), clicks stage a selection and Next continues.
 * Without `onNext` (ImageSplit), click commits immediately via `onPick`.
 */
export function LibraryImageCardPicker({
  folderId = "",
  documentId = "",
  layout = "segmentedStrip",
  titleKey = "doc.imageSplit.libraryPickerTitle",
  onPick,
  onClose,
  onNext,
  nextLabelKey = "doc.moodboard.libraryNext",
  /** Allow Next without a fresh pick (slot already has an image). */
  nextEnabled = false,
}) {
  void layout;
  const { t } = useI18n();
  const docs = useDocsStore((s) => s.docs);
  const nodes = useNodesStore((s) => s.nodes);
  const stageMode = typeof onNext === "function";
  const [selectedKey, setSelectedKey] = useState(null);

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

  const handlePick = (item, ownerKind, ownerId) => {
    if (stageMode) {
      setSelectedKey(pickRowKey(ownerKind, ownerId, item?.id));
      onPick?.(item, ownerKind, ownerId);
      return;
    }
    onPick?.(item, ownerKind, ownerId);
  };

  const canNext = stageMode && (Boolean(selectedKey) || nextEnabled);

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
                  onPick={handlePick}
                  selectedKey={stageMode ? selectedKey : null}
                />
                <hr className="library-image-card-picker__divider" />
              </>
            ) : null}
            <PickGrid
              title={t("doc.imageSplit.libraryPickerAllImages")}
              items={allStrip}
              emptyMessage={t("doc.imageSplit.libraryPickerEmptyAll")}
              onPick={handlePick}
              selectedKey={stageMode ? selectedKey : null}
            />
          </div>
        )}

        {stageMode ? (
          <footer className="library-image-card-picker__footer">
            <button
              type="button"
              className="library-image-card-picker__next"
              disabled={!canNext}
              onClick={() => {
                if (!canNext) return;
                onNext?.();
              }}
            >
              {t(nextLabelKey)}
            </button>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
