import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { copyToClipboard } from "../../lib/copyToClipboard.js";
import {
  normalizeFolderLibraryItems,
  resolveWallColor,
} from "../../lib/folderLibrary.js";

/**
 * @param {string} tag
 * @param {string} [url]
 * @returns {string}
 */
function downloadFilename(tag, url = "") {
  const fromUrl = String(url || "").split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = fromUrl ? fromUrl[1].toLowerCase() : "mp4";
  const base = String(tag || "video")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "video";
  return `${base}.${ext}`;
}

/**
 * Video ficha detail — TXT-Placeholder | Video, wallColor pane, download.
 */
export function FolderLibraryVideoDetail({
  folderId,
  itemId,
  onClose,
  onEdit,
  escapeEnabled = true,
}) {
  const { t } = useI18n();
  const libraryItems = useDocsStore((s) => s.docs?.[folderId]?.libraryItems);
  const item = useMemo(() => {
    const list = normalizeFolderLibraryItems(libraryItems);
    return list.find((entry) => entry.id === itemId) || null;
  }, [libraryItems, itemId]);

  const hasRef = Boolean(item?.description?.trim());
  const hasVideo = Boolean(item?.mediaUrl);
  const showSwitch = hasRef && hasVideo;

  const [mode, setMode] = useState(() => {
    if (hasVideo && !hasRef) return "video";
    return "ref";
  });
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!item) {
      onClose?.();
      return;
    }
    if (showSwitch) return;
    setMode(hasVideo && !hasRef ? "video" : "ref");
  }, [item, showSwitch, hasVideo, hasRef, onClose]);

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

  const activeMode = showSwitch ? mode : (hasVideo && !hasRef ? "video" : "ref");

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
      const res = await fetch(item.mediaUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename(item.tag, item.mediaUrl);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(item.mediaUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className="folder-library-video-detail"
      role="dialog"
      aria-modal="true"
      aria-label={item.tag || t("doc.library.title")}
    >
      <button
        type="button"
        className="folder-library-video-detail__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-video-detail__shell">
        <header className="folder-library-video-detail__header">
          <h2 className="folder-library-video-detail__tag">{item.tag || "—"}</h2>
          <div className="folder-library-video-detail__header-actions">
            <button
              type="button"
              className="folder-library-video-detail__edit"
              onClick={() => onEdit?.(item)}
            >
              {t("doc.library.edit")}
            </button>
            <button
              type="button"
              className="folder-library-video-detail__close"
              onClick={onClose}
              aria-label={t("doc.library.close")}
            >
              ×
            </button>
          </div>
        </header>

        {showSwitch ? (
          <div
            className="folder-library-video-detail__switch"
            role="tablist"
            aria-label={t("doc.library.viewSwitchVideoAria")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "ref"}
              className={
                "folder-library-video-detail__switch-btn"
                + (activeMode === "ref" ? " is-active" : "")
              }
              onClick={() => setMode("ref")}
            >
              {t("doc.library.viewRef")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "video"}
              className={
                "folder-library-video-detail__switch-btn"
                + (activeMode === "video" ? " is-active" : "")
              }
              onClick={() => setMode("video")}
            >
              {t("doc.library.viewVideo")}
            </button>
          </div>
        ) : null}

        <div className="folder-library-video-detail__body">
          {activeMode === "ref" ? (
            <div className="folder-library-video-detail__ref">
              {hasRef ? (
                <p className="folder-library-video-detail__description">
                  {item.description}
                </p>
              ) : (
                <p className="folder-library-video-detail__empty">
                  {t("doc.library.noReference")}
                </p>
              )}
              <button
                type="button"
                className="folder-library-video-detail__copy"
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
              className="folder-library-video-detail__video-pane"
              style={{ backgroundColor: resolveWallColor(item.wallColor) }}
            >
              {hasVideo ? (
                <>
                  <video
                    className="folder-library-video-detail__player"
                    src={item.mediaUrl}
                    controls
                    playsInline
                  />
                  <button
                    type="button"
                    className="folder-library-video-detail__download"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading
                      ? t("doc.library.downloading")
                      : t("doc.library.download")}
                  </button>
                </>
              ) : (
                <p className="folder-library-video-detail__empty">
                  {t("doc.library.noVideo")}
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
