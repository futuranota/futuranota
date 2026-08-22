import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems } from "../../hooks/useLibraryItems.js";
import { copyToClipboard } from "../../lib/copyToClipboard.js";
import { resolveWallColor } from "../../lib/folderLibrary.js";
import { libraryFrameCssAspectRatio } from "../../lib/libraryFrameAspect.js";
import { libraryFichaDetailMode } from "../../lib/libraryFichaPreview.js";

/**
 * @param {string} tag
 * @returns {string}
 */
function downloadFilename(tag) {
  const base = String(tag || "image")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "image";
  return `${base}.webp`;
}

/**
 * Image ficha detail — tag, Ref|Image switch, copy description, download WebP.
 * Edit is handled by the parent (opens FolderLibraryElementModal).
 */
export function FolderLibraryImageDetail({
  folderId,
  ownerKind = "folder",
  ownerId,
  itemId,
  onClose,
  onEdit,
  /** When false, Escape is ignored (e.g. edit modal is on top). */
  escapeEnabled = true,
}) {
  const { t } = useI18n();
  const items = useLibraryItems(ownerKind, ownerId || folderId);
  const item = useMemo(
    () => items.find((entry) => entry.id === itemId) || null,
    [items, itemId],
  );

  const hasRef = Boolean(item?.description?.trim());
  const hasImage = Boolean(item?.mediaUrl);
  const showSwitch = hasRef && hasImage;

  const [mode, setMode] = useState(() => libraryFichaDetailMode(ownerKind, {
    hasImage,
    hasRef,
  }));
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    if (!item) {
      if (items.length > 0) onClose?.();
      return;
    }
    setMode(libraryFichaDetailMode(ownerKind, { hasImage, hasRef }));
  }, [item, itemId, items.length, ownerKind, hasImage, hasRef, onClose]);

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

  if (!item) return null;

  const activeMode = showSwitch
    ? mode
    : libraryFichaDetailMode(ownerKind, { hasImage, hasRef });

  const handleCopy = async () => {
    const text = item.description?.trim();
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleDownload = async () => {
    if (!item.mediaUrl || downloading) return;
    setDownloading(true);
    try {
      // Prefer framed product (mediaUrl). Never fall back to sourceMediaUrl.
      const res = await fetch(item.mediaUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const frame = String(item.frameAspect || "").trim().replace(":", "x");
      const base = downloadFilename(item.tag).replace(/\.webp$/i, "");
      a.download = frame ? `${base}_${frame}.webp` : `${base}.webp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Cross-origin fallback: open in new tab so user can save manually.
      window.open(item.mediaUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className="folder-library-image-detail"
      role="dialog"
      aria-modal="true"
      aria-label={item.tag || t("doc.library.title")}
    >
      <button
        type="button"
        className="folder-library-image-detail__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-image-detail__shell">
        <header className="folder-library-image-detail__header">
          <h2 className="folder-library-image-detail__tag">{item.tag || "—"}</h2>
          <div className="folder-library-image-detail__header-actions">
            <button
              type="button"
              className="folder-library-image-detail__edit"
              onClick={() => onEdit?.(item)}
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

        {showSwitch ? (
          <div
            className="folder-library-image-detail__switch"
            role="tablist"
            aria-label={t("doc.library.viewSwitchAria")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "ref"}
              className={
                "folder-library-image-detail__switch-btn"
                + (activeMode === "ref" ? " is-active" : "")
              }
              onClick={() => setMode("ref")}
            >
              {t("doc.library.viewRef")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "image"}
              className={
                "folder-library-image-detail__switch-btn"
                + (activeMode === "image" ? " is-active" : "")
              }
              onClick={() => setMode("image")}
            >
              {t("doc.library.viewImage")}
            </button>
          </div>
        ) : null}

        <div className="folder-library-image-detail__body">
          {activeMode === "ref" ? (
            <div className="folder-library-image-detail__ref">
              {hasRef ? (
                <p className="folder-library-image-detail__description">
                  {item.description}
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
                disabled={!hasRef}
                aria-label={copied ? t("doc.library.copied") : t("doc.library.copy")}
                title={copied ? t("doc.library.copied") : t("doc.library.copy")}
              >
                {copied ? "✓" : "⧉"}
              </button>
            </div>
          ) : (
            <div
              className={
                "folder-library-image-detail__image-pane"
                + (item.frameAspect ? " folder-library-image-detail__image-pane--framed" : "")
              }
              style={{
                backgroundColor: resolveWallColor(item.wallColor),
                ...(libraryFrameCssAspectRatio(item.frameAspect)
                  ? { aspectRatio: libraryFrameCssAspectRatio(item.frameAspect) }
                  : {}),
              }}
            >
              {hasImage ? (
                <>
                  <img
                    className="folder-library-image-detail__img"
                    src={item.mediaUrl}
                    alt={item.tag || ""}
                  />
                  <button
                    type="button"
                    className="folder-library-image-detail__download"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading
                      ? t("doc.library.downloading")
                      : t("doc.library.download")}
                  </button>
                </>
              ) : (
                <p className="folder-library-image-detail__empty-ref">
                  {t("doc.library.noImage")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
