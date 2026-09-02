import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";
import {
  BANNER_HEADLINE_MAX,
  BANNER_HEADLINE_MAX_LINES,
  IMAGE_SPLIT_BODY_MAX_LINES,
} from "../../../lib/docBlocks.js";
import { libraryItemToBannerPatch } from "../../../lib/libraryImageCardPick.js";
import { normalizeWallColor } from "../../../lib/folderLibrary.js";
import { useLibraryItems } from "../../../hooks/useLibraryItems.js";
import { useLibraryImagePickerCreate } from "../../../hooks/useLibraryImagePickerCreate.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { FolderLibraryElementModal } from "../FolderLibraryElementModal.jsx";
import { LibraryImageCardPicker } from "../LibraryImageCardPicker.jsx";
import { DocCardMediaActions } from "./DocCardMediaActions.jsx";

/** Empty / loading media aspect (height / width), aligned with image-card. */
const BANNER_EMPTY_ASPECT = 0.72;
/** Body line metrics used for portraitCap — match ImageSplit body (~14px × 1.45). */
const BANNER_CAP_LINE_HEIGHT_PX = 20.3;

/**
 * @param {CSSStyleDeclaration} style
 * @param {number} [fallback=28.8]
 */
function resolveLineHeightPx(style, fallback = 28.8) {
  const raw = style?.lineHeight;
  if (!raw || raw === "normal") return fallback;
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

/**
 * @param {HTMLElement|null} el
 */
function measureHeadlineMetrics(el) {
  if (!el) {
    return { lineHeight: 28.8, padY: 4 };
  }
  const style = window.getComputedStyle(el);
  const lineHeight = resolveLineHeightPx(style, 28.8);
  const padY = (Number.parseFloat(style.paddingTop) || 0)
    + (Number.parseFloat(style.paddingBottom) || 0);
  return { lineHeight, padY: padY || 4 };
}

/**
 * @param {HTMLTextAreaElement} source
 * @param {string} text
 * @param {number} maxHeight
 */
function textFitsFixedHeight(source, text, maxHeight) {
  if (!(maxHeight > 0)) return false;
  if (!source) return false;
  const probe = document.createElement("textarea");
  const style = window.getComputedStyle(source);
  probe.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "pointer-events:none",
    "top:0",
    "left:0",
    "height:auto",
    "overflow:hidden",
    `width:${Math.max(1, source.clientWidth)}px`,
    `padding:${style.padding}`,
    `border:${style.border}`,
    `box-sizing:${style.boxSizing}`,
    `font:${style.font}`,
    `letter-spacing:${style.letterSpacing}`,
    `line-height:${style.lineHeight}`,
    `white-space:${style.whiteSpace}`,
    `word-break:${style.wordBreak}`,
    `overflow-wrap:${style.overflowWrap}`,
  ].join(";");
  probe.value = text ?? "";
  document.body.appendChild(probe);
  const fits = probe.scrollHeight <= maxHeight + 1;
  document.body.removeChild(probe);
  return fits;
}

/**
 * @param {HTMLTextAreaElement|null} el
 * @param {number} lines
 */
function headlineMaxHeightPx(el, lines = BANNER_HEADLINE_MAX_LINES) {
  const { lineHeight, padY } = measureHeadlineMetrics(el);
  const fromLines = Math.round(lines * lineHeight + padY);
  if (!el || !(el.clientHeight > 0)) return fromLines;
  // Visible box may be shorter than the 9-line budget; never write past what's on screen.
  return Math.min(fromLines, Math.round(el.clientHeight));
}

/**
 * Banner: full-width card — image left + bold headline right (WebP upload).
 */
export function BannerBlockView({
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
  const headlineRef = useRef(null);
  const headlineLimitTimerRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [headlineAtLimit, setHeadlineAtLimit] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [libraryEditOpen, setLibraryEditOpen] = useState(false);

  const imageSaved = Boolean(block?.imageSaved && block?.src);
  const bannerSaved = Boolean(block?.bannerSaved && imageSaved);
  const isEdit = !bannerSaved;

  const resolvedLibraryOwnerKind = block?.libraryOwnerKind || libraryOwnerKind;
  const resolvedLibraryOwnerId = block?.libraryOwnerId || libraryOwnerId;
  const libraryItems = useLibraryItems(resolvedLibraryOwnerKind, resolvedLibraryOwnerId);
  const editingLibraryItem = useMemo(() => {
    const itemId = String(block?.libraryItemId || "").trim();
    if (!itemId) return null;
    return libraryItems.find((item) => item.id === itemId) || null;
  }, [block?.libraryItemId, libraryItems]);

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
      onChange?.({ ...patch, bannerSaved: false });
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

  const pulseHeadlineLimit = useCallback(() => {
    setHeadlineAtLimit(true);
    if (headlineLimitTimerRef.current) window.clearTimeout(headlineLimitTimerRef.current);
    headlineLimitTimerRef.current = window.setTimeout(() => setHeadlineAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (headlineLimitTimerRef.current) window.clearTimeout(headlineLimitTimerRef.current);
  }, []);

  // Media height follows image aspect with the same portraitCap as Image card
  // (IMAGE_SPLIT_BODY_MAX_LINES × body line-height) so tall images stay fit.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const inner = innerRef.current;
    const media = mediaRef.current;
    if (!card || !inner || !media || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      const mediaW = Math.max(1, media.clientWidth);
      const imgEl = media.querySelector("img.doc-banner__img");
      const iw = Number(block?.width) || imgEl?.naturalWidth || 0;
      const ih = Number(block?.height) || imgEl?.naturalHeight || 0;
      const ratio = (imageSaved && iw > 0 && ih > 0)
        ? (ih / iw)
        : BANNER_EMPTY_ASPECT;
      const naturalH = Math.round(mediaW * ratio);

      // Same cap basis as ImageSplit (body metrics), not headline 24px.
      const lineHeight = BANNER_CAP_LINE_HEIGHT_PX;
      const padY = 0;
      const portraitCap = Math.max(
        Math.round(lineHeight + padY),
        Math.round(IMAGE_SPLIT_BODY_MAX_LINES * lineHeight + padY),
      );
      const mediaH = Math.max(
        Math.round(lineHeight + padY),
        Math.min(naturalH, portraitCap),
      );

      media.style.height = `${mediaH}px`;
      media.style.minHeight = `${mediaH}px`;
      media.style.maxHeight = `${mediaH}px`;

      // Lock row to media height so headline min-size cannot open a gap under the image.
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

    const imgEl = media.querySelector("img.doc-banner__img");
    const onImgLoad = () => sync();
    if (imgEl) {
      imgEl.addEventListener("load", onImgLoad);
    }

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
  }, [imageSaved, bannerSaved, block?.src, block?.width, block?.height]);

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, bannerSaved: false });
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
      // Always convert to WebP; keep source resolution — slot size is CSS.
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "BNIMG",
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
    const patch = libraryItemToBannerPatch(item, ownerKind, ownerId);
    if (!patch) return;
    onChange?.({
      ...patch,
      wallColor: normalizeWallColor(item.wallColor),
      bannerSaved: isEdit ? false : Boolean(block?.bannerSaved),
    });
    setLibraryPickerOpen(false);
  }, [block?.bannerSaved, isEdit, onChange]);

  const openLibraryEdit = useCallback(() => {
    if (editingLibraryItem) {
      setLibraryEditOpen(true);
      return;
    }
    setLibraryPickerOpen(true);
  }, [editingLibraryItem]);

  const handleLibraryEditSaved = useCallback((saved) => {
    if (!saved) {
      setLibraryEditOpen(false);
      return;
    }
    const ownerKind = block?.libraryOwnerKind || pickerPrimaryKind;
    const ownerId = block?.libraryOwnerId || pickerPrimaryId;
    const patch = libraryItemToBannerPatch(saved, ownerKind, ownerId);
    if (patch) {
      onChange?.({
        ...patch,
        wallColor: normalizeWallColor(saved.wallColor),
        bannerSaved: isEdit ? false : Boolean(block?.bannerSaved),
      });
    }
    setLibraryEditOpen(false);
  }, [
    block?.bannerSaved,
    block?.libraryOwnerId,
    block?.libraryOwnerKind,
    isEdit,
    onChange,
    pickerPrimaryId,
    pickerPrimaryKind,
  ]);

  const handleRemoveBlock = () => {
    if (onDelete) {
      onDelete();
      return;
    }
    handleClearImage();
  };

  const handleHeadlineChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "").slice(0, BANNER_HEADLINE_MAX);
    const prev = block?.headline || "";
    if (next === prev) return;

    const el = headlineRef.current;
    const maxH = headlineMaxHeightPx(el);
    if (next.length >= prev.length && el && !textFitsFixedHeight(el, next, maxH)) {
      pulseHeadlineLimit();
      event.target.value = prev;
      return;
    }

    if (next.length >= BANNER_HEADLINE_MAX && next.length >= prev.length) {
      pulseHeadlineLimit();
    }
    handleFieldChange({ headline: next });
  };

  const handleHeadlineKeyDown = (event) => {
    if (!isEdit) return;
    const el = headlineRef.current;
    const maxH = headlineMaxHeightPx(el);
    const cur = block?.headline || "";

    if (event.key === "Enter") {
      const start = el?.selectionStart ?? cur.length;
      const end = el?.selectionEnd ?? start;
      const next = `${cur.slice(0, start)}\n${cur.slice(end)}`.slice(0, BANNER_HEADLINE_MAX);
      if (!el || !textFitsFixedHeight(el, next, maxH)) {
        event.preventDefault();
        pulseHeadlineLimit();
      }
      return;
    }

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable || !el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`;
    if (next.length > BANNER_HEADLINE_MAX || !textFitsFixedHeight(el, next, maxH)) {
      event.preventDefault();
      pulseHeadlineLimit();
    }
  };

  const handleHeadlinePaste = (event) => {
    if (!isEdit) return;
    const el = headlineRef.current;
    if (!el) return;
    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.headline || "";
    const maxH = headlineMaxHeightPx(el);

    let next = `${cur.slice(0, start)}${paste}${cur.slice(end)}`.slice(0, BANNER_HEADLINE_MAX);
    if (!textFitsFixedHeight(el, next, maxH)) {
      let lo = 0;
      let hi = Math.min(paste.length, BANNER_HEADLINE_MAX);
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = `${cur.slice(0, start)}${paste.slice(0, mid)}${cur.slice(end)}`
          .slice(0, BANNER_HEADLINE_MAX);
        if (textFitsFixedHeight(el, candidate, maxH)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      next = `${cur.slice(0, start)}${paste.slice(0, best)}${cur.slice(end)}`
        .slice(0, BANNER_HEADLINE_MAX);
      pulseHeadlineLimit();
    }

    if (next !== cur) handleFieldChange({ headline: next });
  };

  const canSave = imageSaved && !uploading;

  const handleMediaBarEdit = useCallback(() => {
    if (isEdit) {
      if (!canSave) return;
      onSave?.();
      return;
    }
    openLibraryEdit();
  }, [canSave, isEdit, onSave, openLibraryEdit]);

  return (
    <div className={"doc-banner" + (bannerSaved ? " doc-banner--saved" : "")}>
      <input
        ref={inputRef}
        type="file"
        className="doc-banner__input"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="doc-banner__card" ref={cardRef}>
        <div className="doc-banner__inner" ref={innerRef}>
          <div
            ref={mediaRef}
            className={"doc-banner__media" + (imageSaved ? "" : " doc-banner__media--empty")}
          >
            {imageSaved ? (
              <>
                {isEdit ? (
                  <button
                    type="button"
                    className="doc-banner__img-btn"
                    onClick={() => setLibraryPickerOpen(true)}
                    aria-label={t("doc.imageSplit.pickLibrary")}
                  >
                    <img
                      className="doc-banner__img"
                      src={block.src}
                      alt={block.alt || block.name || t("doc.imageBlock.previewAlt")}
                      width={block.width || undefined}
                      height={block.height || undefined}
                      draggable={false}
                    />
                  </button>
                ) : (
                  <img
                    className="doc-banner__img"
                    src={block.src}
                    alt={block.alt || block.name || t("doc.imageBlock.previewAlt")}
                    width={block.width || undefined}
                    height={block.height || undefined}
                    draggable={false}
                  />
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={
                    "doc-banner__dropzone"
                    + (dragOver ? " doc-banner__dropzone--active" : "")
                    + (uploading ? " doc-banner__dropzone--busy" : "")
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
                  <span className="doc-banner__dropzone-title">
                    {uploading
                      ? t("doc.imageBlock.uploading")
                      : t("doc.imageSplit.pickLibrary")}
                  </span>
                  <span className="doc-banner__dropzone-hint">
                    {t("doc.imageSplit.libraryDropHint")}
                  </span>
                </button>
              </>
            )}
            <DocCardMediaActions
              className="doc-card-float-actions doc-card-media-actions"
              isEdit={isEdit}
              canSave={canSave}
              saveLabelKey="doc.banner.save"
              onChangeImage={() => setLibraryPickerOpen(true)}
              onEditAction={handleMediaBarEdit}
              onRemove={handleRemoveBlock}
            />
          </div>

          <div className="doc-banner__copy">
            <textarea
              ref={headlineRef}
              className={
                "doc-banner__headline"
                + (headlineAtLimit ? " doc-banner__headline--at-limit" : "")
              }
              value={block?.headline || ""}
              maxLength={BANNER_HEADLINE_MAX}
              rows={BANNER_HEADLINE_MAX_LINES}
              placeholder={t("doc.banner.headlinePlaceholder")}
              aria-label={t("doc.banner.headlineLabel")}
              readOnly={!isEdit}
              spellCheck={false}
              onChange={handleHeadlineChange}
              onKeyDown={handleHeadlineKeyDown}
              onPaste={handleHeadlinePaste}
            />
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

      {libraryEditOpen && editingLibraryItem ? (
        <FolderLibraryElementModal
          folderId={pickerFolderId || block?.libraryOwnerId || pickerPrimaryId}
          ownerKind={block?.libraryOwnerKind || pickerPrimaryKind}
          ownerId={block?.libraryOwnerId || pickerPrimaryId}
          item={editingLibraryItem}
          lockCategory
          hidePresentationToggle={editingLibraryItem.presentation === "visual"}
          defaultPresentation={editingLibraryItem.presentation === "visual" ? "visual" : ""}
          overlayClassName="folder-library-element-overlay--above-picker"
          onClose={() => setLibraryEditOpen(false)}
          onSaved={handleLibraryEditSaved}
        />
      ) : null}

      {error ? <p className="doc-banner__error" role="alert">{error}</p> : null}
    </div>
  );
}
