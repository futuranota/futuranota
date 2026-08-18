import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems, useLibrarySets } from "../../hooks/useLibraryItems.js";
import {
  libraryAssetHasPack,
  triggerBlobDownload,
  zipLibraryAssetImages,
} from "../../lib/libraryAssetZip.js";
import { LibraryAssetMetadataGrid } from "./LibraryAssetMetadataGrid.jsx";
import { LibraryAssetReadonlyField } from "./LibraryAssetReadonlyField.jsx";

/**
 * Document asset detail — modal layout: Name + Script (copy) | metadata grid.
 */
export function FolderLibraryAssetDetail({
  ownerKind = "document",
  ownerId,
  assetId,
  onClose,
  onEdit,
  onOpenItem,
  pendingClone = null,
  onSavePendingClone = null,
  escapeEnabled = true,
}) {
  const { t } = useI18n();
  const assets = useLibrarySets(ownerKind, ownerId);
  const items = useLibraryItems(ownerKind, ownerId);
  const asset = useMemo(
    () => assets.find((entry) => entry.id === assetId) || null,
    [assets, assetId],
  );
  const imageItems = useMemo(
    () => items.filter((item) => item.setId === assetId && item.category === "image"),
    [items, assetId],
  );
  const pendingTag = String(pendingClone?.tag || "").trim();
  const hasPendingClone = Boolean(pendingTag);
  const canDownload = libraryAssetHasPack(asset, imageItems);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!asset) onClose?.();
  }, [asset, onClose]);

  useEffect(() => {
    if (!escapeEnabled) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, escapeEnabled]);

  if (!asset) return null;

  const handleDownload = async () => {
    if (!canDownload || downloading) return;
    setDownloading(true);
    try {
      const pack = await zipLibraryAssetImages(asset, imageItems);
      if (!pack) return;
      triggerBlobDownload(pack.blob, pack.filename);
    } finally {
      setDownloading(false);
    }
  };

  const title = asset.tag || t("doc.library.assetInputTitle");

  return createPortal(
    <div
      className="folder-library-element-overlay folder-library-asset-detail"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal folder-library-asset-detail__modal">
        <header className="folder-library-element-modal__head">
          <div className="library-asset-modal__title-row">
            <img
              className="library-asset-modal__title-icon"
              src="/uploads/assets.svg"
              alt=""
              aria-hidden
              draggable={false}
            />
            <h2 className="folder-library-element-modal__title">{title}</h2>
          </div>
          <button
            type="button"
            className="folder-library-element-modal__close"
            onClick={onClose}
            aria-label={t("doc.library.close")}
          >
            ×
          </button>
        </header>

        <div className="folder-library-element-modal__body">
          <div className="folder-library-element-modal__fields">
            <LibraryAssetReadonlyField
              label={t("doc.library.assetNameLabel")}
              value={asset.tag}
            />
            <LibraryAssetReadonlyField
              value={asset.description}
              copyLabel={t("doc.library.copy")}
              copyable
              multiline
            />
          </div>

          <div className="folder-library-element-modal__media">
            <LibraryAssetMetadataGrid
              items={imageItems}
              onOpenItem={onOpenItem}
              interactive
            />
          </div>
        </div>

        <footer className="folder-library-element-modal__footer folder-library-asset-detail__footer">
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--cancel"
            onClick={onClose}
          >
            {t("doc.library.cancel")}
          </button>
          <div className="folder-library-asset-detail__footer-actions">
            <button
              type="button"
              className="folder-library-element-modal__btn folder-library-element-modal__btn--cancel"
              onClick={() => onEdit?.(asset)}
            >
              {t("doc.library.edit")}
            </button>
            <button
              type="button"
              className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
              onClick={handleDownload}
              disabled={!canDownload || downloading}
            >
              {downloading
                ? t("doc.library.downloading")
                : t("doc.library.assetDownload")}
            </button>
            {hasPendingClone ? (
              <button
                type="button"
                className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
                onClick={() => onSavePendingClone?.()}
              >
                {t("doc.library.save")}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
