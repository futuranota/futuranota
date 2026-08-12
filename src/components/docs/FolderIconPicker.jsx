import { useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../lib/docImageStorage.js";

export const FOLDER_ICON_EMPTY_SRC = "/uploads/Tag.svg";

/**
 * Circular folder icon upload for content-mode document banners.
 * Empty state shows Tag.svg; custom icon is a Storage public URL (legacy data-URLs still render).
 */
export function FolderIconPicker({
  icon = "",
  onIconChange,
  /** Doc / folder id — Storage path `{user}/{scopeId}/{FICON-…}.webp` */
  scopeId = "folder-icon",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const customSrc = typeof icon === "string" ? icon.trim() : "";
  const hasCustom = Boolean(customSrc);
  const displaySrc = hasCustom ? customSrc : FOLDER_ICON_EMPTY_SRC;
  const canEdit = typeof onIconChange === "function";

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file || !canEdit) return;
    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    setError("");
    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "FICON",
        scopeId,
        maxWidth: 128,
        maxHeight: 128,
        quality: 0.88,
      });
      if (converted?.src) {
        onIconChange(converted.src);
      }
    } catch (err) {
      setError(err?.message || "Upload failed");
      console.warn("[folder-icon] upload failed:", err?.message || err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit || !hasCustom) return;
    setError("");
    onIconChange("");
  };

  return (
    <div className="doc-folder-icon-picker">
      <button
        type="button"
        className={
          "doc-folder-icon-picker__btn"
          + (hasCustom ? " is-custom" : " is-empty")
          + (uploading ? " is-uploading" : "")
        }
        onClick={() => {
          if (canEdit && !uploading) inputRef.current?.click();
        }}
        onContextMenu={handleClear}
        disabled={!canEdit || uploading}
        aria-label={hasCustom ? "Change folder icon" : "Add folder icon"}
        title={
          error
            || (hasCustom ? "Click to replace · right-click to clear" : "Upload folder icon")
        }
      >
        <img
          className={
            "doc-folder-icon-picker__img"
            + (hasCustom ? "" : " doc-folder-icon-picker__img--placeholder")
          }
          src={displaySrc}
          alt=""
          aria-hidden
        />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
