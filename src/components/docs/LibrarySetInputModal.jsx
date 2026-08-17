import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { convertAndUploadDocImage } from "../../lib/docImageStorage.js";
import { generateId } from "../../lib/ids.js";
import { createLibraryItem, createLibrarySet } from "../../lib/folderLibrary.js";

const QUEUE_SLOTS = 4;
const PLACEHOLDER_KINDS = ["IMG", "FILE", "IMG", "FILE"];

function fileStem(fileName = "") {
  const name = String(fileName || "").trim();
  if (!name) return "";
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  return base.trim() || name;
}

/**
 * `#i` — name + description + image queue for a new document library asset.
 */
export function LibrarySetInputModal({
  ownerId,
  onClose,
  onSaved,
}) {
  const { t } = useI18n();
  const id = String(ownerId || "").trim();
  const fileInputRef = useRef(null);
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [queued, setQueued] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const queuedRef = useRef(queued);
  queuedRef.current = queued;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => () => {
    queuedRef.current.forEach((entry) => {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    });
  }, []);

  const enqueueFiles = (fileList) => {
    const next = [];
    for (const file of Array.from(fileList || [])) {
      if (!file?.type?.startsWith("image/")) {
        setError(t("doc.library.invalidImage"));
        continue;
      }
      next.push({
        id: generateId("Q"),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (!next.length) return;
    setError("");
    setQueued((prev) => [...prev, ...next]);
  };

  const removeQueued = (entryId) => {
    setQueued((prev) => {
      const target = prev.find((entry) => entry.id === entryId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((entry) => entry.id !== entryId);
    });
  };

  const handleSave = async () => {
    const name = tag.trim();
    if (!name) {
      setError(t("doc.library.nameRequired"));
      return;
    }
    if (!id) {
      setError(t("doc.library.captureNoOwner"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = createLibrarySet("document", id, {
        tag: name,
        description: description.trim(),
      });
      if (!saved) {
        setError(t("doc.library.nameRequired"));
        return;
      }
      const meta = description.trim();
      for (let index = 0; index < queued.length; index += 1) {
        const entry = queued[index];
        const converted = await convertAndUploadDocImage(entry.file, {
          idPrefix: "LIBIMG",
          scopeId: id,
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.88,
        });
        if (!converted?.src) continue;
        const itemTag = queued.length === 1
          ? name
          : `${name}_${index + 1}`;
        const fromFile = fileStem(entry.file?.name);
        createLibraryItem("document", id, {
          tag: itemTag || fromFile || name,
          description: meta,
          category: "image",
          mediaUrl: converted.src,
          setId: saved.id,
        });
      }
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.message || t("doc.library.uploadFailed"));
    } finally {
      setSaving(false);
    }
  };

  const emptySlots = Math.max(0, QUEUE_SLOTS - queued.length);

  return createPortal(
    <div
      className="folder-library-element-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("doc.library.assetInputTitle")}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.cancel")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal">
        <header className="folder-library-element-modal__head">
          <div className="library-asset-modal__title-row">
            <img
              className="library-asset-modal__title-icon"
              src="/uploads/FolderDashed.svg"
              alt=""
              aria-hidden
              draggable={false}
            />
            <h2 className="folder-library-element-modal__title">
              {t("doc.library.assetInputTitle")}
            </h2>
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
            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">
                {t("doc.library.assetNameLabel")}
              </span>
              <input
                className="folder-library-element-modal__input"
                type="text"
                value={tag}
                placeholder={t("doc.library.assetNamePlaceholder")}
                onChange={(e) => setTag(e.target.value)}
                autoFocus
              />
            </label>
            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">
                {t("doc.library.assetDescriptionLabel")}
              </span>
              <textarea
                className="folder-library-element-modal__textarea"
                value={description}
                placeholder={t("doc.library.assetDescriptionPlaceholder")}
                rows={5}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>

          <div className="folder-library-element-modal__media">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                enqueueFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              className={
                "library-asset-queue"
                + (dragOver ? " is-dragover" : "")
              }
              role="button"
              tabIndex={0}
              aria-label={t("doc.library.assetQueueAria")}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                enqueueFiles(e.dataTransfer?.files);
              }}
            >
              {queued.map((entry) => (
                <div key={entry.id} className="library-asset-queue__slot is-filled">
                  <img
                    className="library-asset-queue__thumb"
                    src={entry.previewUrl}
                    alt=""
                  />
                  <button
                    type="button"
                    className="library-asset-queue__remove"
                    aria-label={t("doc.library.delete")}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeQueued(entry.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {Array.from({ length: emptySlots }, (_, index) => (
                <div key={`ph-${index}`} className="library-asset-queue__slot" aria-hidden>
                  <span className="folder-library-overlay__cell-badge folder-library-overlay__cell-badge--image">
                    <span className="folder-library-overlay__cell-badge-lines" />
                    <span className="folder-library-overlay__cell-badge-fmt">
                      {PLACEHOLDER_KINDS[index % PLACEHOLDER_KINDS.length]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p className="folder-library-element-modal__error" role="alert">{error}</p>
        ) : null}

        <footer className="folder-library-element-modal__footer">
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--cancel"
            onClick={onClose}
            disabled={saving}
          >
            {t("doc.library.cancel")}
          </button>
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
            onClick={handleSave}
            disabled={saving}
          >
            {t("doc.library.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
