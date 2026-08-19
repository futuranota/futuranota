import { createPortal } from "react-dom";
import { useMemo } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems } from "../../hooks/useLibraryItems.js";
import { fichaHasVisual, libraryTilePrefer, LIBRARY_MEDIA_BADGE_SRC, fichaShowsMediaBadge, promptPreviewText, resolveFichaPreviewKind } from "../../lib/libraryFichaPreview.js";
import { isImageCardLibraryPick } from "../../lib/libraryImageCardPick.js";

function renderPickFace(item) {
  const prefer = libraryTilePrefer("folder");
  const kind = resolveFichaPreviewKind(item, prefer);
  if (kind === "image" && fichaHasVisual(item)) {
    return (
      <img
        className="folder-library-overlay__cell-img"
        src={item.mediaUrl}
        alt=""
      />
    );
  }
  return (
    <>
      <span className="folder-library-overlay__cell-prompt">
        {promptPreviewText(item)}
      </span>
      {fichaShowsMediaBadge(item, prefer) ? (
        <img
          className="folder-library-overlay__cell-media-badge"
          src={LIBRARY_MEDIA_BADGE_SRC}
          alt=""
          aria-hidden
          draggable={false}
        />
      ) : null}
    </>
  );
}

function PickSection({ title, items, ownerKind, ownerId, onPick }) {
  if (!items.length) return null;
  return (
    <section className="library-image-card-picker__section">
      {title ? (
        <h3 className="library-image-card-picker__section-title">{title}</h3>
      ) : null}
      <ul className="folder-library-overlay__grid library-image-card-picker__grid">
        {items.map((item) => (
          <li key={`${ownerKind}:${item.id}`} className="folder-library-overlay__cell">
            <button
              type="button"
              className="folder-library-overlay__cell-main"
              onClick={() => onPick(item, ownerKind, ownerId)}
            >
              {renderPickFace(item)}
              <span className="folder-library-overlay__cell-tag">{item.tag}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Pick a folder/document Prompt ficha into an Image card (photo + metadata).
 */
export function LibraryImageCardPicker({
  folderId = "",
  documentId = "",
  onPick,
  onClose,
}) {
  const { t } = useI18n();
  const folderItems = useLibraryItems("folder", folderId);
  const documentItems = useLibraryItems("document", documentId);
  const folderPicks = useMemo(
    () => folderItems.filter(isImageCardLibraryPick),
    [folderItems],
  );
  const documentPicks = useMemo(
    () => documentItems.filter(isImageCardLibraryPick),
    [documentItems],
  );
  const showFolderLabel = Boolean(folderId && documentId);
  const empty = folderPicks.length === 0 && documentPicks.length === 0;

  return createPortal(
    <div
      className="library-image-card-picker"
      role="dialog"
      aria-modal="true"
      aria-label={t("doc.imageSplit.libraryPickerTitle")}
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
            {t("doc.imageSplit.libraryPickerTitle")}
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
        {empty ? (
          <p className="library-image-card-picker__empty">
            {t("doc.imageSplit.libraryPickerEmpty")}
          </p>
        ) : (
          <div className="library-image-card-picker__body">
            <PickSection
              title={showFolderLabel ? t("doc.imageSplit.libraryPickerFolder") : ""}
              items={folderPicks}
              ownerKind="folder"
              ownerId={folderId}
              onPick={onPick}
            />
            <PickSection
              title={showFolderLabel || documentId ? t("doc.imageSplit.libraryPickerDocument") : ""}
              items={documentPicks}
              ownerKind="document"
              ownerId={documentId}
              onPick={onPick}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
