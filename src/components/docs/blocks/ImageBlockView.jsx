import { useEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import { useI18n } from "../../../i18n/useI18n.js";

export function ImageBlockView({ block, onChange, onDelete }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const imageSaved = Boolean(block?.imageSaved && block?.src);

  useEffect(() => {
    if (!block?.openFilePicker || imageSaved || uploading) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.click();
      onChange?.({ openFilePicker: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [block?.openFilePicker, block?.id, imageSaved, uploading, onChange]);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const converted = await convertFileToWebpData(file, { idPrefix: "DOCIMG" });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }

      onChange?.({
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
        imageSaved: true,
        openFilePicker: false,
      });
    } catch {
      setError(t("doc.imageBlock.convertFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleReplace = () => {
    inputRef.current?.click();
  };

  const handleClear = () => {
    onChange?.({
      src: "",
      name: "",
      alt: "",
      width: 0,
      height: 0,
      imageSaved: false,
      openFilePicker: false,
    });
    setError(null);
  };

  if (imageSaved) {
    return (
      <div className="doc-image-block">
        <input
          ref={inputRef}
          type="file"
          className="doc-image-block__input"
          accept="image/*"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <figure className="doc-image-block__preview">
          <img
            className="doc-image-block__img"
            src={block.src}
            alt={block.alt || block.name || t("doc.imageBlock.previewAlt")}
            width={block.width || undefined}
            height={block.height || undefined}
            draggable={false}
          />
          <figcaption className="doc-image-block__meta">
            {block.name || t("doc.imageBlock.previewAlt")}
          </figcaption>
        </figure>
        <div className="doc-image-block__actions">
          {onDelete ? (
            <button
              type="button"
              className="doc-image-block__delete"
              onClick={onDelete}
            >
              {t("common.delete")}
            </button>
          ) : null}
          <button
            type="button"
            className="doc-image-block__replace"
            onClick={handleReplace}
            disabled={uploading}
          >
            {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.replace")}
          </button>
          <button
            type="button"
            className="doc-image-block__clear"
            onClick={handleClear}
            disabled={uploading}
          >
            {t("doc.imageBlock.remove")}
          </button>
        </div>
        {error ? <p className="doc-image-block__error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="doc-image-block">
      <input
        ref={inputRef}
        type="file"
        className="doc-image-block__input"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        className={
          "doc-image-block__dropzone"
          + (dragOver ? " doc-image-block__dropzone--active" : "")
          + (uploading ? " doc-image-block__dropzone--busy" : "")
        }
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer?.files);
        }}
      >
        <span className="doc-image-block__dropzone-title">
          {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.uploadLabel")}
        </span>
        <span className="doc-image-block__dropzone-hint">
          {t("doc.imageBlock.uploadHint")}
        </span>
        <span className="doc-image-block__dropzone-formats">
          {t("doc.imageBlock.formats")}
        </span>
      </button>
      {error ? <p className="doc-image-block__error" role="alert">{error}</p> : null}
      {onDelete ? (
        <div className="doc-image-block__actions doc-image-block__actions--empty">
          <button
            type="button"
            className="doc-image-block__delete"
            onClick={onDelete}
          >
            {t("common.delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
