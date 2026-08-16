import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { normalizeFolderLibraryItems } from "../../lib/folderLibrary.js";

/**
 * Skill / PDF ficha detail — tag, description, download attachment.
 */
export function FolderLibrarySkillDetail({
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
      className="folder-library-skill-detail"
      role="dialog"
      aria-modal="true"
      aria-label={item.tag || t("doc.library.title")}
    >
      <button
        type="button"
        className="folder-library-skill-detail__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-skill-detail__shell">
        <header className="folder-library-skill-detail__header">
          <h2 className="folder-library-skill-detail__tag">{item.tag || "—"}</h2>
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

          <div className="folder-library-skill-detail__file">
            <span className="folder-library-skill-detail__badge">
              {(item.attachmentKind || "FILE").toUpperCase()}
            </span>
            <span className="folder-library-skill-detail__filename">
              {item.attachmentName || t("doc.library.noAttachment")}
            </span>
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
