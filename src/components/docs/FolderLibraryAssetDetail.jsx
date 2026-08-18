import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems, useLibrarySets } from "../../hooks/useLibraryItems.js";
import { copyToClipboard } from "../../lib/copyToClipboard.js";
import {
  triggerBlobDownload,
  zipLibraryAssetImages,
} from "../../lib/libraryAssetZip.js";
import { LibraryAssetEmptyImgGrid } from "./LibraryAssetImgMark.jsx";

const EMPTY_SLOTS = 4;

/**
 * Document asset detail — Prompt | Image, empty IMG logos, zip download of the set.
 */
export function FolderLibraryAssetDetail({
  ownerKind = "document",
  ownerId,
  assetId,
  onClose,
  onEdit,
  onOpenItem,
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
  const downloadable = imageItems.filter((item) => String(item.mediaUrl || "").trim());

  const hasPrompt = Boolean(asset?.description?.trim());
  const [mode, setMode] = useState("ref");
  const [copied, setCopied] = useState(false);
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

  const handleCopy = async () => {
    const text = asset.description?.trim();
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleDownload = async () => {
    if (!downloadable.length || downloading) return;
    setDownloading(true);
    try {
      const pack = await zipLibraryAssetImages(asset, downloadable);
      if (!pack) return;
      triggerBlobDownload(pack.blob, pack.filename);
    } finally {
      setDownloading(false);
    }
  };

  const placeholders = Math.max(0, EMPTY_SLOTS - imageItems.length);

  return createPortal(
    <div
      className="folder-library-image-detail folder-library-asset-detail"
      role="dialog"
      aria-modal="true"
      aria-label={asset.tag || t("doc.library.assetInputTitle")}
    >
      <button
        type="button"
        className="folder-library-image-detail__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-image-detail__shell">
        <header className="folder-library-image-detail__header">
          <h2 className="folder-library-image-detail__tag">{asset.tag || "—"}</h2>
          <div className="folder-library-image-detail__header-actions">
            <button
              type="button"
              className="folder-library-image-detail__edit"
              onClick={() => onEdit?.(asset)}
            >
              {t("doc.library.edit")}
            </button>
            <button
              type="button"
              className="folder-library-image-detail__close"
              onClick={onClose}
              aria-label={t("doc.library.close")}
            >
              ×
            </button>
          </div>
        </header>

        <div
          className="folder-library-image-detail__switch"
          role="tablist"
          aria-label={t("doc.library.viewSwitchAria")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ref"}
            className={
              "folder-library-image-detail__switch-btn"
              + (mode === "ref" ? " is-active" : "")
            }
            onClick={() => setMode("ref")}
          >
            {t("doc.library.viewRef")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "image"}
            className={
              "folder-library-image-detail__switch-btn"
              + (mode === "image" ? " is-active" : "")
            }
            onClick={() => setMode("image")}
          >
            {t("doc.library.viewImage")}
          </button>
        </div>

        <div className="folder-library-image-detail__body">
          {mode === "ref" ? (
            <div className="folder-library-image-detail__ref">
              {hasPrompt ? (
                <p className="folder-library-image-detail__description">
                  {asset.description}
                </p>
              ) : (
                <p className="folder-library-image-detail__empty-ref">
                  {t("doc.library.noReference")}
                </p>
              )}
              <button
                type="button"
                className="folder-library-image-detail__copy"
                onClick={handleCopy}
                disabled={!hasPrompt}
                aria-label={copied ? t("doc.library.copied") : t("doc.library.copy")}
                title={copied ? t("doc.library.copied") : t("doc.library.copy")}
              >
                {copied ? "✓" : "⧉"}
              </button>
            </div>
          ) : (
            <div className="folder-library-asset-detail__image">
              <div className="library-asset-queue folder-library-asset-detail__queue">
                {imageItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="library-asset-queue__slot library-asset-queue__slot--hit"
                    onClick={() => onOpenItem?.(item)}
                    aria-label={item.tag || t("doc.library.viewImage")}
                  >
                    {item.mediaUrl ? (
                      <img
                        className="folder-library-asset-detail__thumb"
                        src={item.mediaUrl}
                        alt=""
                      />
                    ) : (
                      <span className="folder-library-overlay__cell-badge folder-library-overlay__cell-badge--image">
                        <span className="folder-library-overlay__cell-badge-fmt">IMG</span>
                      </span>
                    )}
                  </button>
                ))}
                {imageItems.length === 0
                  ? <LibraryAssetEmptyImgGrid />
                  : Array.from({ length: placeholders }, (_, index) => (
                    <div key={`ph-${index}`} className="library-asset-queue__slot">
                      <span className="folder-library-overlay__cell-badge folder-library-overlay__cell-badge--image">
                        <span className="folder-library-overlay__cell-badge-fmt">IMG</span>
                      </span>
                    </div>
                  ))}
              </div>
              <button
                type="button"
                className="folder-library-image-detail__download"
                onClick={handleDownload}
                disabled={!downloadable.length || downloading}
              >
                {downloading
                  ? t("doc.library.downloading")
                  : t("doc.library.assetDownload")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
