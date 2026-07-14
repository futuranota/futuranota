import { useRef, useState } from "react";
import { convertFileToWebpData } from "../../lib/convertImageToWebp.js";

export const FOLDER_ICON_EMPTY_SRC = "/uploads/Tag.svg";

/**
 * Circular folder icon upload for content-mode document banners.
 * Empty state shows Tag.svg; custom icon is a WebP data URL (or any string src).
 */
export function FolderIconPicker({
  icon = "",
  onIconChange,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const customSrc = typeof icon === "string" ? icon.trim() : "";
  const hasCustom = Boolean(customSrc);
  const displaySrc = hasCustom ? customSrc : FOLDER_ICON_EMPTY_SRC;
  const canEdit = typeof onIconChange === "function";

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file || !canEdit) return;
    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const converted = await convertFileToWebpData(file, {
        idPrefix: "FICON",
        maxWidth: 128,
        maxHeight: 128,
        quality: 0.88,
      });
      if (converted?.src) {
        onIconChange(converted.src);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit || !hasCustom) return;
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
        title={hasCustom ? "Click to replace · right-click to clear" : "Upload folder icon"}
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
