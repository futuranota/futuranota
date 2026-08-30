import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";
import {
  formatSpecsCardDimensions,
  formatSpecsCardWeight,
  IMAGE_SPLIT_BODY_MAX_LINES,
  normalizeSpecsCard,
} from "../../../lib/docBlocks.js";
import { DIMENSION_UNIT_OPTIONS, WEIGHT_UNIT_OPTIONS } from "../../../lib/metricUnits.js";
import { libraryItemToBannerPatch } from "../../../lib/libraryImageCardPick.js";
import { useLibraryImagePickerCreate } from "../../../hooks/useLibraryImagePickerCreate.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { FolderLibraryElementModal } from "../FolderLibraryElementModal.jsx";
import { LibraryImageCardPicker } from "../LibraryImageCardPicker.jsx";

const SPECS_EMPTY_ASPECT = 0.72;
const SPECS_CAP_LINE_HEIGHT_PX = 20.3;

function safeSpecsData(block) {
  return normalizeSpecsCard(block);
}

/**
 * Specs Card: image left + structured specs right (Banner shell, vault/table palette).
 */
export function SpecsCardBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onDelete,
  libraryOwnerKind = "folder",
  libraryOwnerId = "",
  folderLibraryId = "",
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const innerRef = useRef(null);
  const mediaRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  const data = safeSpecsData(block);
  const specs = data.specs;
  const imageSaved = Boolean(data.imageSaved && data.src);
  const specsSaved = Boolean(data.specsSaved && imageSaved);
  const isEdit = !specsSaved;

  const {
    pickerFolderId,
    pickerDocumentId,
    pickerPrimaryKind,
    pickerPrimaryId,
    canCreateFromPicker,
    createModalOpen,
    createMediaUrl,
    createFileInputRef,
    openCreateFromPicker,
    handleCreateFile,
    handleCreateSaved,
    closeCreateModal,
  } = useLibraryImagePickerCreate({
    isEdit,
    libraryOwnerKind,
    libraryOwnerId,
    folderLibraryId,
    onItemCreated: (item, ownerKind, ownerId) => {
      const patch = libraryItemToBannerPatch(item, ownerKind, ownerId);
      if (!patch) return;
      onChange?.({ ...patch, specsSaved: false });
      setError(null);
    },
    onAfterCreate: () => setLibraryPickerOpen(false),
    onError: setError,
  });

  useEffect(() => {
    if (!isEdit || !block?.openFilePicker || imageSaved) return;
    setLibraryPickerOpen(true);
    onChange?.({ openFilePicker: false });
  }, [block?.openFilePicker, block?.id, imageSaved, onChange, isEdit]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const inner = innerRef.current;
    const media = mediaRef.current;
    if (!card || !inner || !media || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      const mediaW = Math.max(1, media.clientWidth);
      const imgEl = media.querySelector("img.doc-specs-card__img");
      const iw = Number(data.width) || imgEl?.naturalWidth || 0;
      const ih = Number(data.height) || imgEl?.naturalHeight || 0;
      const ratio = (imageSaved && iw > 0 && ih > 0)
        ? (ih / iw)
        : SPECS_EMPTY_ASPECT;
      const naturalH = Math.round(mediaW * ratio);
      const lineHeight = SPECS_CAP_LINE_HEIGHT_PX;
      const portraitCap = Math.max(
        Math.round(lineHeight),
        Math.round(IMAGE_SPLIT_BODY_MAX_LINES * lineHeight),
      );
      const mediaH = Math.max(Math.round(lineHeight), Math.min(naturalH, portraitCap));

      media.style.height = `${mediaH}px`;
      media.style.minHeight = `${mediaH}px`;
      media.style.maxHeight = `${mediaH}px`;
      inner.style.height = `${mediaH}px`;
      inner.style.minHeight = `${mediaH}px`;
      inner.style.maxHeight = `${mediaH}px`;
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(card);
    ro.observe(inner);
    ro.observe(media);

    const imgEl = media.querySelector("img.doc-specs-card__img");
    const onImgLoad = () => sync();
    imgEl?.addEventListener("load", onImgLoad);

    return () => {
      ro.disconnect();
      imgEl?.removeEventListener("load", onImgLoad);
      media.style.height = "";
      media.style.minHeight = "";
      media.style.maxHeight = "";
      inner.style.height = "";
      inner.style.minHeight = "";
      inner.style.maxHeight = "";
    };
  }, [imageSaved, specsSaved, data.src, data.width, data.height]);

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, specsSaved: false });
  };

  const updateSpecs = (specPatch) => {
    handleFieldChange({
      specs: {
        ...specs,
        ...specPatch,
      },
    });
  };

  const updateDimension = (axis, value) => {
    updateSpecs({
      dimensions: {
        ...specs.dimensions,
        [axis]: value,
      },
    });
  };

  const handleFiles = async (files) => {
    if (!isEdit) return;
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "SCIMG",
        scopeId: block?.id,
      });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }

      handleFieldChange({
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
        imageSaved: true,
        libraryItemId: "",
        libraryOwnerKind: "",
        libraryOwnerId: "",
        openFilePicker: false,
      });
    } catch (err) {
      setError(err?.message || t("doc.imageBlock.convertFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClearImage = () => {
    if (!isEdit) return;
    handleFieldChange({
      src: "",
      name: "",
      alt: "",
      width: 0,
      height: 0,
      imageSaved: false,
      libraryItemId: "",
      libraryOwnerKind: "",
      libraryOwnerId: "",
      openFilePicker: false,
    });
    setError(null);
  };

  const handlePickLibraryItem = useCallback((item, ownerKind, ownerId) => {
    if (!isEdit) return;
    const patch = libraryItemToBannerPatch(item, ownerKind, ownerId);
    if (!patch) return;
    onChange?.({ ...patch, specsSaved: false });
    setLibraryPickerOpen(false);
  }, [isEdit, onChange]);

  const handleRemoveBlock = () => {
    if (onDelete) {
      onDelete();
      return;
    }
    handleClearImage();
  };

  const canSave = imageSaved && !uploading;

  const renderSpecRow = (labelKey, children, { rowClass = "", hideLabel = false } = {}) => (
    <div className={`doc-specs-card__row${rowClass ? ` ${rowClass}` : ""}`}>
      {!hideLabel ? (
        <span className="doc-specs-card__label">{t(labelKey)}</span>
      ) : null}
      <div className="doc-specs-card__value">
        {children}
      </div>
    </div>
  );

  const showName = isEdit || Boolean(String(specs.name ?? "").trim());
  const showDimensions = isEdit || [specs.dimensions?.x, specs.dimensions?.y, specs.dimensions?.z]
    .some((value) => Boolean(String(value ?? "").trim()));
  const showMaterial = isEdit || Boolean(String(specs.material ?? "").trim());
  const showWeight = isEdit || Boolean(String(specs.weight?.value ?? "").trim());
  const showPartNumber = isEdit || Boolean(String(specs.partNumber ?? "").trim());

  return (
    <div className={"doc-specs-card" + (specsSaved ? " doc-specs-card--saved" : "")}>
      <input
        ref={inputRef}
        type="file"
        className="doc-specs-card__input"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="doc-specs-card__card" ref={cardRef}>
        <div className="doc-specs-card__inner" ref={innerRef}>
          <div
            ref={mediaRef}
            className={"doc-specs-card__media" + (imageSaved ? "" : " doc-specs-card__media--empty")}
          >
            {imageSaved ? (
              isEdit ? (
                <button
                  type="button"
                  className="doc-specs-card__img-btn"
                  onClick={() => setLibraryPickerOpen(true)}
                  aria-label={t("doc.imageSplit.pickLibrary")}
                >
                  <img
                    className="doc-specs-card__img"
                    src={data.src}
                    alt={data.alt || data.name || t("doc.imageBlock.previewAlt")}
                    width={data.width || undefined}
                    height={data.height || undefined}
                    draggable={false}
                  />
                </button>
              ) : (
                <img
                  className="doc-specs-card__img"
                  src={data.src}
                  alt={data.alt || data.name || t("doc.imageBlock.previewAlt")}
                  width={data.width || undefined}
                  height={data.height || undefined}
                  draggable={false}
                />
              )
            ) : (
              <button
                type="button"
                className={
                  "doc-specs-card__dropzone"
                  + (dragOver ? " doc-specs-card__dropzone--active" : "")
                  + (uploading ? " doc-specs-card__dropzone--busy" : "")
                }
                disabled={uploading || !isEdit}
                onClick={() => isEdit && setLibraryPickerOpen(true)}
                onDragEnter={(event) => {
                  if (!isEdit) return;
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(event) => {
                  if (!isEdit) return;
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(event) => {
                  if (!isEdit) return;
                  event.preventDefault();
                  setDragOver(false);
                  handleFiles(event.dataTransfer?.files);
                }}
              >
                <span className="doc-specs-card__dropzone-title">
                  {uploading
                    ? t("doc.imageBlock.uploading")
                    : t("doc.imageSplit.pickLibrary")}
                </span>
                <span className="doc-specs-card__dropzone-hint">
                  {t("doc.imageSplit.libraryDropHint")}
                </span>
              </button>
            )}
            <div className="doc-card-float-actions">
              {isEdit ? (
                <button
                  type="button"
                  className="doc-card-float-btn"
                  disabled={!canSave}
                  onClick={() => {
                    if (!canSave) return;
                    onSave?.();
                  }}
                >
                  {t("doc.specsCard.save")}
                </button>
              ) : (
                <button
                  type="button"
                  className="doc-card-float-btn"
                  onClick={() => onEdit?.()}
                >
                  {t("doc.specsCard.edit")}
                </button>
              )}
              <div className="doc-card-float-actions__group">
                {isEdit ? (
                  <button
                    type="button"
                    className="doc-card-float-btn"
                    onClick={() => setLibraryPickerOpen(true)}
                  >
                    {t("doc.imageSplit.pickLibrary")}
                  </button>
                ) : null}
                {isEdit && onDelete ? (
                  <button
                    type="button"
                    className="doc-card-float-btn"
                    onClick={handleRemoveBlock}
                    disabled={uploading}
                  >
                    {t("doc.imageBlock.remove")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="doc-specs-card__panel scroll-match-bg">
            {showName ? renderSpecRow(
              "doc.specsCard.name",
              isEdit ? (
                <input
                  type="text"
                  className="doc-specs-card__field doc-specs-card__field--name"
                  value={specs.name}
                  placeholder={t("doc.specsCard.namePlaceholder")}
                  aria-label={t("doc.specsCard.name")}
                  spellCheck={false}
                  onChange={(event) => updateSpecs({ name: event.target.value })}
                />
              ) : (
                <span className="doc-specs-card__static doc-specs-card__static--name">
                  {specs.name}
                </span>
              ),
            ) : null}

            {showDimensions ? renderSpecRow(
              "doc.specsCard.dimensions",
              isEdit ? (
                <div className="doc-specs-card__dims">
                  {(["x", "y", "z"]).map((axis, index) => (
                    <span key={axis} className="doc-specs-card__dim-group">
                      {index > 0 ? (
                        <span className="doc-specs-card__dim-sep" aria-hidden>×</span>
                      ) : null}
                      <input
                        type="text"
                        className="doc-specs-card__field doc-specs-card__field--dim"
                        value={specs.dimensions[axis]}
                        placeholder={axis.toUpperCase()}
                        aria-label={`${t("doc.specsCard.dimensions")} ${axis.toUpperCase()}`}
                        spellCheck={false}
                        onChange={(event) => updateDimension(axis, event.target.value)}
                      />
                    </span>
                  ))}
                  <select
                    className="doc-specs-card__unit-picker"
                    value={specs.dimensions.unit || ""}
                    aria-label={t("doc.specsCard.unitLabel")}
                    onChange={(event) => updateSpecs({
                      dimensions: {
                        ...specs.dimensions,
                        unit: event.target.value,
                      },
                    })}
                  >
                    {DIMENSION_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.id || "none"} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="doc-specs-card__static doc-specs-card__static--detail">
                  {formatSpecsCardDimensions(specs)}
                </span>
              ),
            ) : null}

            {showMaterial ? renderSpecRow(
              "doc.specsCard.material",
              isEdit ? (
                <input
                  type="text"
                  className="doc-specs-card__field doc-specs-card__field--detail"
                  value={specs.material}
                  placeholder={t("doc.specsCard.materialPlaceholder")}
                  aria-label={t("doc.specsCard.material")}
                  spellCheck={false}
                  onChange={(event) => updateSpecs({ material: event.target.value })}
                />
              ) : (
                <span className="doc-specs-card__static doc-specs-card__static--detail">
                  {specs.material}
                </span>
              ),
            ) : null}

            {showWeight ? renderSpecRow(
              "doc.specsCard.weight",
              isEdit ? (
                <div className="doc-specs-card__weight">
                  <input
                    type="text"
                    className="doc-specs-card__field doc-specs-card__field--detail doc-specs-card__field--weight"
                    value={specs.weight.value}
                    placeholder={t("doc.specsCard.weightPlaceholder")}
                    aria-label={t("doc.specsCard.weight")}
                    spellCheck={false}
                    onChange={(event) => updateSpecs({
                      weight: {
                        ...specs.weight,
                        value: event.target.value,
                      },
                    })}
                  />
                  <select
                    className="doc-specs-card__unit-picker"
                    value={specs.weight.unit || ""}
                    aria-label={t("doc.specsCard.weightUnitLabel")}
                    onChange={(event) => updateSpecs({
                      weight: {
                        ...specs.weight,
                        unit: event.target.value,
                      },
                    })}
                  >
                    {WEIGHT_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.id || "none"} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="doc-specs-card__static doc-specs-card__static--detail">
                  {formatSpecsCardWeight(specs.weight)}
                </span>
              ),
            ) : null}

            {showPartNumber ? renderSpecRow(
              isEdit ? "doc.specsCard.partNumberOptional" : "doc.specsCard.partNumber",
              isEdit ? (
                <input
                  type="text"
                  className="doc-specs-card__field doc-specs-card__field--part"
                  value={specs.partNumber}
                  placeholder={t("doc.specsCard.partNumberPlaceholder")}
                  aria-label={t("doc.specsCard.partNumberOptional")}
                  spellCheck={false}
                  onChange={(event) => updateSpecs({ partNumber: event.target.value })}
                />
              ) : (
                <span className="doc-specs-card__static doc-specs-card__static--part">
                  {specs.partNumber}
                </span>
              ),
              { rowClass: "doc-specs-card__row--optional" },
            ) : null}
          </div>
        </div>
      </div>

      {libraryPickerOpen ? (
        <LibraryImageCardPicker
          layout="segmentedStrip"
          folderId={pickerFolderId}
          documentId={pickerDocumentId}
          titleKey="doc.imageSplit.libraryPickerTitle"
          allowPrimaryCreate={canCreateFromPicker}
          onPrimaryCreateClick={openCreateFromPicker}
          onPick={handlePickLibraryItem}
          onClose={() => {
            setLibraryPickerOpen(false);
            closeCreateModal();
          }}
        />
      ) : null}

      <input
        ref={createFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleCreateFile}
      />

      {createModalOpen && pickerPrimaryId ? (
        <FolderLibraryElementModal
          folderId={pickerFolderId || pickerPrimaryId}
          ownerKind={pickerPrimaryKind}
          ownerId={pickerPrimaryId}
          defaultCategory="image"
          lockCategory
          defaultPresentation="visual"
          initialMediaUrl={createMediaUrl}
          overlayClassName="folder-library-element-overlay--above-picker"
          onClose={closeCreateModal}
          onSaved={handleCreateSaved}
        />
      ) : null}

      {error ? <p className="doc-specs-card__error" role="alert">{error}</p> : null}
    </div>
  );
}
