import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  IMAGE_SPLIT_BODY_MAX_LINES,
  MOODBOARD_CAPTION_MAX,
  MOODBOARD_CAPTION_MAX_LINES,
  MOODBOARD_COLUMN_COUNT,
  MOODBOARD_FILE_ICON_SRC,
  MOODBOARD_OVERLAY_KINDS,
  MOODBOARD_OVERLAY_SRC,
  MOODBOARD_RECIPES,
  MOODBOARD_STICKY_MAX,
  MOODBOARD_TAG_MAX,
  countMoodboardSavedImages,
  createMoodboardColumn,
  createMoodboardOverlay,
  normalizeMoodboardExternalUrl,
  normalizeMoodboardOverlays,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { MoodboardAttachmentModal } from "./MoodboardAttachmentModal.jsx";

/** Board geometry — must mirror .doc-moodboard__board padding/gap in left-panel.css. */
const BOARD_PAD_X = 16;
const BOARD_PAD_TOP = 16;
/** Bottom strip for float actions (caption no longer needs a tall strip). */
const BOARD_CAPTION_STRIP = 28;
const BOARD_GAP = 10;

const STICKY_SRC = "/uploads/horizontal-note.svg";

const OVERLAY_PALETTE = [
  { kind: MOODBOARD_OVERLAY_KINDS.TWISTED, labelKey: "doc.moodboard.overlayTwisted" },
  { kind: MOODBOARD_OVERLAY_KINDS.STRAIGHT, labelKey: "doc.moodboard.overlayStraight" },
  { kind: MOODBOARD_OVERLAY_KINDS.UP, labelKey: "doc.moodboard.overlayUp" },
  { kind: MOODBOARD_OVERLAY_KINDS.DOWN, labelKey: "doc.moodboard.overlayDown" },
];

const RECIPE_OPTIONS = [
  { id: MOODBOARD_RECIPES.LARGE, labelKey: "doc.moodboard.recipeLarge" },
  { id: MOODBOARD_RECIPES.MEDIUM_STACK, labelKey: "doc.moodboard.recipeMedium" },
  { id: MOODBOARD_RECIPES.SEMI_STICKY, labelKey: "doc.moodboard.recipeSemi" },
];

function emptySlot() {
  return {
    src: "",
    name: "",
    alt: "",
    width: 0,
    height: 0,
    imageSaved: false,
    kind: "image",
    externalUrl: "",
    tagLabel: "",
  };
}

/**
 * @param {CSSStyleDeclaration} style
 * @param {number} [fallback=20.3]
 */
function resolveLineHeightPx(style, fallback = 20.3) {
  const raw = style?.lineHeight;
  if (!raw || raw === "normal") return fallback;
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

/**
 * @param {HTMLElement|null} el
 */
function measureBodyLineMetrics(el) {
  if (!el) {
    return { lineHeight: 20.3, padY: 4 };
  }
  const style = window.getComputedStyle(el);
  const lineHeight = resolveLineHeightPx(style, 20.3);
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

/** Clamp sticky text to the char limit AND the orange note box (no overflow). */
function clampStickyText(el, raw) {
  const capped = String(raw ?? "").slice(0, MOODBOARD_STICKY_MAX);
  const maxH = el?.clientHeight ?? 0;
  if (!el || !(maxH > 0) || textFitsFixedHeight(el, capped, maxH)) return capped;
  let lo = 0;
  let hi = capped.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (textFitsFixedHeight(el, capped.slice(0, mid), maxH)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return capped.slice(0, best);
}

/**
 * Max pixel height for N caption lines.
 * @param {HTMLTextAreaElement|null} el
 * @param {number} lines
 */
function captionMaxHeightPx(el, lines = MOODBOARD_CAPTION_MAX_LINES) {
  const { lineHeight, padY } = measureBodyLineMetrics(el);
  return Math.round(lines * lineHeight + padY);
}

/**
 * Moodboard: full-width 3-column board. Each column picks large / medium×2 / semi+sticky.
 */
export function MoodboardBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onDelete,
  onConvertLayout,
  // Accepted but unused: the moodboard no longer renders a body textarea.
  onBodyKeyDown: _onBodyKeyDown,
  autoFocusBody: _autoFocusBody = false,
  tagRefCandidates: _tagRefCandidates = null,
  slashGhostHints: _slashGhostHints,
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const pendingUploadRef = useRef(null);
  const boardRef = useRef(null);
  const captionRef = useRef(null);
  const captionLimitTimerRef = useRef(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [error, setError] = useState(null);
  const [activeCol, setActiveCol] = useState(0);
  const [boardHeight, setBoardHeight] = useState(null);
  const [captionAtLimit, setCaptionAtLimit] = useState(false);
  const [attachmentSlot, setAttachmentSlot] = useState(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const overlayDragRef = useRef(null);
  const overlaysRef = useRef([]);

  const columns = Array.isArray(block?.columns) && block.columns.length === MOODBOARD_COLUMN_COUNT
    ? block.columns
    : [
      createMoodboardColumn(null),
      createMoodboardColumn(null),
      createMoodboardColumn(null),
    ];

  const overlays = normalizeMoodboardOverlays(block?.overlays);
  overlaysRef.current = overlays;
  const savedImageCount = countMoodboardSavedImages({ columns });
  const moodboardSaved = Boolean(block?.moodboardSaved && savedImageCount > 0);
  const isEdit = !moodboardSaved;

  useEffect(() => {
    if (!isEdit) setSelectedOverlayId(null);
  }, [isEdit]);

  useEffect(() => {
    if (!selectedOverlayId) return;
    if (!overlays.some((item) => item.id === selectedOverlayId)) {
      setSelectedOverlayId(null);
    }
  }, [overlays, selectedOverlayId]);

  const pulseCaptionLimit = useCallback(() => {
    setCaptionAtLimit(true);
    if (captionLimitTimerRef.current) window.clearTimeout(captionLimitTimerRef.current);
    captionLimitTimerRef.current = window.setTimeout(() => setCaptionAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (captionLimitTimerRef.current) window.clearTimeout(captionLimitTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      const width = board.clientWidth;
      if (!(width > 0)) return;
      // Exact thirds: strip board padding + the two gaps before dividing.
      const colInner = Math.max(1, (width - BOARD_PAD_X * 2 - BOARD_GAP * 2) / 3);
      const capped = Math.round(IMAGE_SPLIT_BODY_MAX_LINES * 20.3);
      const contentH = Math.round(Math.max(200, Math.min(colInner * 1.25, capped)));
      const nextH = contentH + BOARD_PAD_TOP + BOARD_CAPTION_STRIP;
      setBoardHeight((prev) => (prev === nextH ? prev : nextH));
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(board);
    return () => {
      ro.disconnect();
    };
  }, [savedImageCount, moodboardSaved, block?.caption]);

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, moodboardSaved: false });
  };

  const patchColumns = (updater) => {
    const next = columns.map((col, index) => updater(col, index));
    handleFieldChange({ columns: next });
  };

  const addOverlay = (kind) => {
    if (!isEdit) return;
    const created = createMoodboardOverlay(kind, { xPct: 45, yPct: 40 });
    if (!created) return;
    handleFieldChange({ overlays: [...overlaysRef.current, created] });
    setSelectedOverlayId(created.id);
  };

  const removeOverlay = (overlayId) => {
    if (!isEdit || !overlayId) return;
    handleFieldChange({
      overlays: overlaysRef.current.filter((item) => item.id !== overlayId),
    });
    setSelectedOverlayId((prev) => (prev === overlayId ? null : prev));
  };

  const startOverlayDrag = (event, overlay) => {
    if (!isEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedOverlayId(overlay.id);
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    if (!(boardRect.width > 0) || !(boardRect.height > 0)) return;

    const overlayEl = event.currentTarget;
    const itemRect = overlayEl.getBoundingClientRect();
    overlayDragRef.current = {
      id: overlay.id,
      offsetX: event.clientX - itemRect.left,
      offsetY: event.clientY - itemRect.top,
      itemW: itemRect.width,
      itemH: itemRect.height,
    };

    const onMove = (moveEvent) => {
      const drag = overlayDragRef.current;
      const el = boardRef.current;
      if (!drag || !el) return;
      const rect = el.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) return;
      const maxX = Math.max(0, rect.width - drag.itemW);
      const maxY = Math.max(0, rect.height - drag.itemH);
      const left = Math.max(0, Math.min(maxX, moveEvent.clientX - rect.left - drag.offsetX));
      const top = Math.max(0, Math.min(maxY, moveEvent.clientY - rect.top - drag.offsetY));
      const xPct = (left / rect.width) * 100;
      const yPct = (top / rect.height) * 100;
      handleFieldChange({
        overlays: overlaysRef.current.map((item) => (
          item.id === drag.id ? { ...item, xPct, yPct } : item
        )),
      });
    };

    const onUp = () => {
      overlayDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const setColumnRecipe = (colIndex, recipe) => {
    if (!isEdit) return;
    setActiveCol(colIndex);
    patchColumns((col, index) => (
      index === colIndex
        ? createMoodboardColumn(recipe, {
          images: col.images,
          stickyText: col.stickyText,
          infoLabel: col.infoLabel,
        })
        : col
    ));
  };

  const clearColumn = (colIndex) => {
    if (!isEdit) return;
    patchColumns((col, index) => (index === colIndex ? createMoodboardColumn(null) : col));
  };

  const slotKey = (colIndex, imageIndex) => `${colIndex}:${imageIndex}`;

  const handleFilesForSlot = async (colIndex, imageIndex, files) => {
    if (!isEdit) return;
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }

    const key = slotKey(colIndex, imageIndex);
    setUploadingKey(key);
    setError(null);
    setActiveCol(colIndex);

    try {
      const converted = await convertFileToWebpData(file, {
        idPrefix: `MB${colIndex}${imageIndex}`,
      });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }

      const nextImage = {
        slotId: columns[colIndex]?.images?.[imageIndex]?.slotId,
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
        imageSaved: true,
        kind: "image",
        externalUrl: columns[colIndex]?.images?.[imageIndex]?.externalUrl || "",
        tagLabel: columns[colIndex]?.images?.[imageIndex]?.tagLabel || "",
      };

      patchColumns((col, index) => {
        if (index !== colIndex) return col;
        const images = Array.isArray(col.images) ? [...col.images] : [];
        while (images.length <= imageIndex) images.push(emptySlot());
        images[imageIndex] = nextImage;
        return createMoodboardColumn(col.recipe, {
          images,
          stickyText: col.stickyText,
          infoLabel: col.infoLabel,
        });
      });
    } catch {
      setError(t("doc.imageBlock.convertFailed"));
    } finally {
      setUploadingKey(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      pendingUploadRef.current = null;
    }
  };

  const openFilePicker = (colIndex, imageIndex) => {
    if (!isEdit) return;
    pendingUploadRef.current = { colIndex, imageIndex };
    setActiveCol(colIndex);
    fileInputRef.current?.click();
  };

  const openAttachmentModal = (colIndex, imageIndex) => {
    setActiveCol(colIndex);
    setAttachmentSlot({ colIndex, imageIndex });
  };

  const acceptAttachment = (draft) => {
    if (!attachmentSlot || !isEdit) return;
    const { colIndex, imageIndex } = attachmentSlot;
    const prev = columns[colIndex]?.images?.[imageIndex] || emptySlot();
    const link = normalizeMoodboardExternalUrl(draft.externalUrl);
    const hasImage = Boolean(draft.imageSaved && draft.src);
    patchColumns((col, index) => {
      if (index !== colIndex) return col;
      const images = Array.isArray(col.images) ? [...col.images] : [];
      while (images.length <= imageIndex) images.push(emptySlot());
      images[imageIndex] = {
        slotId: prev.slotId || draft.slotId,
        src: draft.src || "",
        name: draft.name || "",
        alt: draft.alt || "",
        width: draft.width || 0,
        height: draft.height || 0,
        imageSaved: Boolean(hasImage || link),
        kind: hasImage ? "image" : (link ? "file" : "image"),
        externalUrl: link,
        tagLabel: String(draft.tagLabel || "").trim().slice(0, MOODBOARD_TAG_MAX),
      };
      return createMoodboardColumn(col.recipe, {
        images,
        stickyText: col.stickyText,
        infoLabel: col.infoLabel,
      });
    });
    setAttachmentSlot(null);
    setError(null);
  };

  const clearImage = (colIndex, imageIndex) => {
    if (!isEdit) return;
    patchColumns((col, index) => {
      if (index !== colIndex) return col;
      const images = Array.isArray(col.images) ? [...col.images] : [];
      if (!images[imageIndex]) return col;
      const prev = images[imageIndex];
      images[imageIndex] = {
        ...emptySlot(),
        slotId: prev.slotId,
      };
      return createMoodboardColumn(col.recipe, {
        images,
        stickyText: col.stickyText,
        infoLabel: col.infoLabel,
      });
    });
    setError(null);
  };

  const handleCaptionChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "").slice(0, MOODBOARD_CAPTION_MAX);
    const prev = block?.caption || "";
    if (next === prev) return;

    const el = captionRef.current;
    const maxH = captionMaxHeightPx(el);
    if (next.length >= prev.length && el && !textFitsFixedHeight(el, next, maxH)) {
      pulseCaptionLimit();
      event.target.value = prev;
      return;
    }

    if (next.length >= MOODBOARD_CAPTION_MAX && next.length >= prev.length) {
      pulseCaptionLimit();
    }
    handleFieldChange({ caption: next });
  };

  const handleCaptionKeyDown = (event) => {
    if (!isEdit) return;
    const el = captionRef.current;
    const maxH = captionMaxHeightPx(el);
    const cur = block?.caption || "";

    if (event.key === "Enter") {
      const start = el?.selectionStart ?? cur.length;
      const end = el?.selectionEnd ?? start;
      const next = `${cur.slice(0, start)}\n${cur.slice(end)}`.slice(0, MOODBOARD_CAPTION_MAX);
      if (!el || !textFitsFixedHeight(el, next, maxH)) {
        event.preventDefault();
        pulseCaptionLimit();
      }
      return;
    }

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable || !el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`;
    if (next.length > MOODBOARD_CAPTION_MAX || !textFitsFixedHeight(el, next, maxH)) {
      event.preventDefault();
      pulseCaptionLimit();
    }
  };

  const handleCaptionPaste = (event) => {
    if (!isEdit) return;
    const el = captionRef.current;
    if (!el) return;
    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.caption || "";
    const maxH = captionMaxHeightPx(el);

    let next = `${cur.slice(0, start)}${paste}${cur.slice(end)}`.slice(0, MOODBOARD_CAPTION_MAX);
    if (!textFitsFixedHeight(el, next, maxH)) {
      let lo = 0;
      let hi = Math.min(paste.length, MOODBOARD_CAPTION_MAX);
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = `${cur.slice(0, start)}${paste.slice(0, mid)}${cur.slice(end)}`
          .slice(0, MOODBOARD_CAPTION_MAX);
        if (textFitsFixedHeight(el, candidate, maxH)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      next = `${cur.slice(0, start)}${paste.slice(0, best)}${cur.slice(end)}`
        .slice(0, MOODBOARD_CAPTION_MAX);
      pulseCaptionLimit();
    }

    if (next !== cur) handleFieldChange({ caption: next });
  };

  const canSave = savedImageCount > 0 && !uploadingKey;
  const attachmentImage = attachmentSlot
    ? (columns[attachmentSlot.colIndex]?.images?.[attachmentSlot.imageIndex] || emptySlot())
    : null;

  const renderImageCell = (colIndex, imageIndex, sizeClass) => {
    const column = columns[colIndex] || createMoodboardColumn(null);
    const image = column.images?.[imageIndex] || emptySlot();
    const externalUrl = normalizeMoodboardExternalUrl(image.externalUrl);
    const hasImage = Boolean(image.src);
    const saved = Boolean(image.imageSaved && (hasImage || externalUrl));
    const displaySrc = hasImage ? image.src : (externalUrl ? MOODBOARD_FILE_ICON_SRC : "");
    const isFileIcon = saved && !hasImage && Boolean(externalUrl);
    const key = slotKey(colIndex, imageIndex);
    const uploading = uploadingKey === key;
    const dragOver = dragOverKey === key;
    const tagLabel = String(image.tagLabel || "").trim();
    const showTag = Boolean(tagLabel && saved);
    // Medium stack has vertical room above each frame — keep the tag outside.
    const tagOutside = showTag && sizeClass === "medium";
    const tagOverlay = showTag && !tagOutside;

    const tagRow = showTag ? (
      <div
        className={
          "doc-moodboard__tag-row"
          + (tagOutside ? " doc-moodboard__tag-row--outside" : "")
        }
        aria-hidden={!tagLabel}
      >
        <span className="doc-moodboard__tag-label">{tagLabel}</span>
      </div>
    ) : null;

    return (
      <div
        className={
          "doc-moodboard__cell-wrap"
          + (tagOutside ? " doc-moodboard__cell-wrap--tagged" : "")
        }
      >
        {tagOutside ? tagRow : null}
        <div
          className={
            "doc-moodboard__cell"
            + ` doc-moodboard__cell--${sizeClass}`
            + (saved ? "" : " doc-moodboard__cell--empty")
            + (isFileIcon ? " doc-moodboard__cell--file" : "")
          }
          data-mb-slot={image.slotId || undefined}
        >
          {saved ? (
            <>
              <button
                type="button"
                className="doc-moodboard__cell-hit"
                aria-label={t("doc.moodboard.attachTitle")}
                onClick={() => openAttachmentModal(colIndex, imageIndex)}
              >
                <img
                  className={
                    "doc-moodboard__img"
                    + (isFileIcon ? " doc-moodboard__img--file" : "")
                  }
                  src={displaySrc}
                  alt={
                    isFileIcon
                      ? (image.name || t("doc.moodboard.attachFilePreviewAlt"))
                      : (image.alt || image.name || t("doc.imageBlock.previewAlt"))
                  }
                  width={hasImage ? (image.width || undefined) : undefined}
                  height={hasImage ? (image.height || undefined) : undefined}
                  draggable={false}
                />
              </button>
              {tagOverlay ? tagRow : null}
              {isEdit ? (
                <div className="doc-moodboard__media-actions">
                  <button
                    type="button"
                    className="doc-moodboard__media-btn"
                    onClick={() => openAttachmentModal(colIndex, imageIndex)}
                    disabled={Boolean(uploadingKey)}
                  >
                    {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.replace")}
                  </button>
                  {externalUrl ? (
                    <button
                      type="button"
                      className="doc-moodboard__media-btn"
                      onClick={() => {
                        window.open(externalUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      {t("doc.moodboard.attachOpenLink")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="doc-moodboard__media-btn"
                    onClick={() => clearImage(colIndex, imageIndex)}
                    disabled={Boolean(uploadingKey)}
                  >
                    {t("doc.imageBlock.remove")}
                  </button>
                </div>
              ) : externalUrl ? (
                <div className="doc-moodboard__media-actions">
                  <button
                    type="button"
                    className="doc-moodboard__media-btn"
                    onClick={() => {
                      window.open(externalUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {t("doc.moodboard.attachOpenLink")}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className={
                "doc-moodboard__dropzone"
                + (dragOver ? " doc-moodboard__dropzone--active" : "")
                + (uploading ? " doc-moodboard__dropzone--busy" : "")
              }
              disabled={Boolean(uploadingKey) || !isEdit}
              onClick={() => isEdit && openAttachmentModal(colIndex, imageIndex)}
              onDragEnter={(event) => {
                if (!isEdit) return;
                event.preventDefault();
                setDragOverKey(key);
              }}
              onDragOver={(event) => {
                if (!isEdit) return;
                event.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragOverKey((prev) => (prev === key ? null : prev));
              }}
              onDrop={(event) => {
                if (!isEdit) return;
                event.preventDefault();
                setDragOverKey(null);
                handleFilesForSlot(colIndex, imageIndex, event.dataTransfer?.files);
              }}
            >
              <span className="doc-moodboard__dropzone-title">
                {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.uploadLabel")}
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderColumn = (colIndex) => {
    const column = columns[colIndex] || createMoodboardColumn(null);
    const recipe = column.recipe;
    const isActive = activeCol === colIndex;

    return (
      <div
        key={`mood-col-${colIndex}`}
        className={
          "doc-moodboard__col"
          + (isActive ? " doc-moodboard__col--active" : "")
          + (recipe ? ` doc-moodboard__col--${recipe}` : " doc-moodboard__col--empty")
        }
        onMouseDown={() => setActiveCol(colIndex)}
      >
        {!recipe ? (
          <div className="doc-moodboard__col-picker">
            <p className="doc-moodboard__col-picker-label">
              {t("doc.moodboard.pickRecipe")}
            </p>
            <div className="doc-moodboard__col-picker-actions">
              {RECIPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="doc-moodboard__recipe-btn"
                  disabled={!isEdit}
                  onClick={() => setColumnRecipe(colIndex, option.id)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {recipe === MOODBOARD_RECIPES.LARGE ? (
          <div className="doc-moodboard__recipe doc-moodboard__recipe--large">
            {renderImageCell(colIndex, 0, "large")}
          </div>
        ) : null}

        {recipe === MOODBOARD_RECIPES.MEDIUM_STACK ? (
          <div className="doc-moodboard__recipe doc-moodboard__recipe--medium">
            {renderImageCell(colIndex, 0, "medium")}
            {renderImageCell(colIndex, 1, "medium")}
          </div>
        ) : null}

        {recipe === MOODBOARD_RECIPES.SEMI_STICKY ? (
          <div className="doc-moodboard__recipe doc-moodboard__recipe--semi">
            {renderImageCell(colIndex, 0, "semi")}
            <div
              className={
                "doc-moodboard__sticky"
                + ((column.stickyText || "").trim() ? " doc-moodboard__sticky--filled" : "")
              }
            >
              <img
                className="doc-moodboard__sticky-bg"
                src={STICKY_SRC}
                alt=""
                draggable={false}
              />
              {isEdit ? (
                <textarea
                  className="doc-moodboard__sticky-field"
                  maxLength={MOODBOARD_STICKY_MAX}
                  rows={3}
                  value={column.stickyText || ""}
                  placeholder={t("doc.moodboard.stickyPlaceholder")}
                  aria-label={t("doc.moodboard.stickyLabel")}
                  spellCheck={false}
                  onChange={(event) => {
                    const next = clampStickyText(event.target, event.target.value);
                    patchColumns((col, index) => (
                      index === colIndex
                        ? createMoodboardColumn(col.recipe, {
                          images: col.images,
                          stickyText: next,
                          infoLabel: col.infoLabel,
                        })
                        : col
                    ));
                  }}
                />
              ) : (
                <div className="doc-moodboard__sticky-static">
                  {column.stickyText || ""}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {recipe && isEdit ? (
          <button
            type="button"
            className="doc-moodboard__col-clear"
            onClick={() => clearColumn(colIndex)}
          >
            {t("doc.moodboard.clearColumn")}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className={"doc-moodboard" + (moodboardSaved ? " doc-moodboard--saved" : "")}>
      <input
        ref={fileInputRef}
        type="file"
        className="doc-moodboard__input"
        accept="image/*"
        onChange={(event) => {
          const pending = pendingUploadRef.current;
          if (!pending) return;
          handleFilesForSlot(pending.colIndex, pending.imageIndex, event.target.files);
        }}
      />

      {isEdit ? (
        <div className="doc-moodboard__toolbar" role="toolbar" aria-label={t("doc.moodboard.toolbarLabel")}>
          <div className="doc-moodboard__toolbar-actions">
            {RECIPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={
                  "doc-moodboard__toolbar-btn"
                  + (columns[activeCol]?.recipe === option.id
                    ? " doc-moodboard__toolbar-btn--active"
                    : "")
                }
                onClick={() => setColumnRecipe(activeCol, option.id)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="doc-moodboard__board-wrap">
        {isEdit ? (
          <div
            className="doc-moodboard__overlay-rail"
            role="toolbar"
            aria-label={t("doc.moodboard.overlaysLabel")}
          >
            {OVERLAY_PALETTE.map((item) => (
              <button
                key={item.kind}
                type="button"
                className="doc-moodboard__overlay-rail-btn"
                title={t(item.labelKey)}
                aria-label={t(item.labelKey)}
                onClick={() => addOverlay(item.kind)}
              >
                <img
                  src={MOODBOARD_OVERLAY_SRC[item.kind]}
                  alt=""
                  draggable={false}
                />
              </button>
            ))}
          </div>
        ) : null}

        <div
          className="doc-moodboard__board"
          ref={boardRef}
          style={boardHeight ? { height: boardHeight, minHeight: boardHeight } : undefined}
          onMouseDown={(event) => {
            if (!isEdit) return;
            if (event.target === event.currentTarget) {
              setSelectedOverlayId(null);
            }
          }}
        >
          {columns.map((_, index) => renderColumn(index))}

          {overlays.length > 0 ? (
            <div
              className={
                "doc-moodboard__overlays"
                + (isEdit ? " doc-moodboard__overlays--edit" : "")
              }
              aria-hidden={!isEdit}
            >
              {overlays.map((overlay) => {
                const selected = isEdit && selectedOverlayId === overlay.id;
                const src = MOODBOARD_OVERLAY_SRC[overlay.kind];
                if (!src) return null;
                return (
                  <div
                    key={overlay.id}
                    className={
                      "doc-moodboard__overlay"
                      + (selected ? " doc-moodboard__overlay--selected" : "")
                      + (isEdit ? " doc-moodboard__overlay--draggable" : "")
                    }
                    style={{ left: `${overlay.xPct}%`, top: `${overlay.yPct}%` }}
                    onPointerDown={(event) => startOverlayDrag(event, overlay)}
                  >
                    <img
                      className="doc-moodboard__overlay-img"
                      src={src}
                      alt=""
                      draggable={false}
                    />
                    {selected ? (
                      <button
                        type="button"
                        className="doc-moodboard__overlay-delete"
                        aria-label={t("doc.moodboard.overlayDelete")}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeOverlay(overlay.id);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {(block?.caption || "").trim() ? (
            <textarea
              ref={captionRef}
              className={
                "doc-moodboard__caption"
                + (captionAtLimit ? " doc-moodboard__caption--at-limit" : "")
              }
              value={block?.caption || ""}
              maxLength={MOODBOARD_CAPTION_MAX}
              rows={MOODBOARD_CAPTION_MAX_LINES}
              aria-label={t("doc.moodboard.captionLabel")}
              readOnly={!isEdit}
              spellCheck={false}
              onChange={handleCaptionChange}
              onKeyDown={handleCaptionKeyDown}
              onPaste={handleCaptionPaste}
            />
          ) : null}

          <div className="doc-moodboard__float-actions">
            {isEdit ? (
              <button
                type="button"
                className="doc-moodboard__save"
                disabled={!canSave}
                onClick={() => {
                  if (!canSave) return;
                  onSave?.();
                }}
              >
                {t("doc.moodboard.save")}
              </button>
            ) : (
              <button
                type="button"
                className="doc-moodboard__edit"
                onClick={() => onEdit?.()}
              >
                {t("doc.moodboard.edit")}
              </button>
            )}
            {onConvertLayout ? (
              <>
                <button
                  type="button"
                  className="doc-moodboard__switch"
                  onClick={() => onConvertLayout("image_split")}
                >
                  {t("doc.layoutSwitch.imageSplit")}
                </button>
                <button
                  type="button"
                  className="doc-moodboard__switch"
                  onClick={() => onConvertLayout("banner")}
                >
                  {t("doc.layoutSwitch.banner")}
                </button>
              </>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="doc-moodboard__switch"
                onClick={() => onDelete()}
              >
                {t("doc.imageBlock.remove")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <MoodboardAttachmentModal
        open={Boolean(attachmentSlot)}
        image={attachmentImage}
        readOnly={!isEdit}
        onClose={() => setAttachmentSlot(null)}
        onAccept={acceptAttachment}
      />

      {error ? <p className="doc-moodboard__error" role="alert">{error}</p> : null}
    </div>
  );
}
