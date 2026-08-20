import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems } from "../../hooks/useLibraryItems.js";

/** Active preview variant */
const ATTACHMENT_CLIPBOARD_VARIANT = "clipboard-v4";

const ATTACHMENT_CLIPBOARD_SRC = {
  clipboard: "/uploads/clipboard.png",
  "clipboard-expanded-shorter": "/uploads/clipboard-expanded-shorter.png",
  "clipbloard-expanded-larger": "/uploads/clipbloard-expanded-larger.png",
  "clipboard-v4": "/uploads/clipboard-v4.webp",
};

/**
 * Skill / PDF ficha detail — file row, description, clipboard preview, download.
 */
export function FolderLibrarySkillDetail({
  folderId,
  ownerKind = "folder",
  ownerId,
  itemId,
  onClose,
  onEdit,
  escapeEnabled = true,
}) {
  const { t } = useI18n();
  const items = useLibraryItems(ownerKind, ownerId || folderId);
  const item = useMemo(
    () => items.find((entry) => entry.id === itemId) || null,
    [items, itemId],
  );

  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!item) onClose?.();
  }, [item, onClose]);

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

  const clipboardSrc = ATTACHMENT_CLIPBOARD_SRC[ATTACHMENT_CLIPBOARD_VARIANT]
    || ATTACHMENT_CLIPBOARD_SRC.clipboard;
  const fileLabel = item.attachmentName || t("doc.library.noAttachment");

  const handleDownload = async () => {
    if (!item.attachmentUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(item.attachmentUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.attachmentName || `${item.tag || "skill"}.${item.attachmentKind || "bin"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(item.attachmentUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className={
        "folder-library-skill-detail"
        + ` folder-library-skill-detail--${ATTACHMENT_CLIPBOARD_VARIANT}`
      }
      role="dialog"
      aria-modal="true"
      aria-label={fileLabel}
    >
      <button
        type="button"
        className="folder-library-skill-detail__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-skill-detail__shell">
        <header className="folder-library-skill-detail__header">
          <div className="folder-library-skill-detail__file">
            <span className="folder-library-skill-detail__badge">
              {(item.attachmentKind || "FILE").toUpperCase()}
            </span>
            <span className="folder-library-skill-detail__filename">
              {fileLabel}
            </span>
          </div>
          <div className="folder-library-skill-detail__header-actions">
            <button
              type="button"
              className="folder-library-skill-detail__edit"
              onClick={() => onEdit?.(item)}
            >
              {t("doc.library.edit")}
            </button>
            <button
              type="button"
              className="folder-library-skill-detail__close"
              onClick={onClose}
              aria-label={t("doc.library.close")}
            >
              ×
            </button>
          </div>
        </header>

        <div className="folder-library-skill-detail__body">
          <p className="folder-library-skill-detail__description">
            {item.description?.trim()
              ? item.description
              : t("doc.library.noSkillDescription")}
          </p>

          <div className="folder-library-skill-detail__clipboard-wrap">
            <img
              className="folder-library-skill-detail__clipboard"
              src={clipboardSrc}
              alt=""
              draggable={false}
            />
          </div>

          <button
            type="button"
            className="folder-library-skill-detail__download"
            onClick={handleDownload}
            disabled={!item.attachmentUrl || downloading}
          >
            {downloading
              ? t("doc.library.downloading")
              : t("doc.library.download")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
