import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseScopeBriefText } from "../../../lib/calendarEventDisplay.js";
import {
  isMoodboardStickyEmpty,
} from "../../../lib/moodboardCalendarFill.js";
import {
  IMAGE_SPLIT_BODY_MAX_LINES,
  MOODBOARD_BOARD_LAYOUTS,
  MOODBOARD_BOARD_SURFACES,
  MOODBOARD_CAPTION_MAX,
  MOODBOARD_CAPTION_MAX_LINES,
  MOODBOARD_FILE_ICON_SRC,
  MOODBOARD_NOTES_BG_SRC,
  MOODBOARD_NOTES_BODY_MAX,
  MOODBOARD_NOTES_MAX_LINES,
  MOODBOARD_NOTES_TITLE_DEFAULT,
  MOODBOARD_NOTE_STYLES,
  MOODBOARD_OVERLAY_KINDS,
  MOODBOARD_OVERLAY_SIZE_PX,
  MOODBOARD_OVERLAY_SRC,
  MOODBOARD_OVERLAY_STROKE_BY_CONTRAST,
  MOODBOARD_POINTER_CONTRAST,
  MOODBOARD_RECIPES,
  MOODBOARD_SLOT_CONTENT_MODES,
  MOODBOARD_SLOT_NOTE_BODY_MAX,
  MOODBOARD_SLOT_NOTE_HEADLINE_MAX,
  MOODBOARD_STICKY_TITLE_MAX,
  MOODBOARD_TAG_MAX,
  countMoodboardSavedImages,
  countMoodboardSavableContent,
  createMoodboardColumn,
  createMoodboardOverlay,
  moodboardColumnCountForLayout,
  normalizeMoodboardBoardLayout,
  normalizeMoodboardBoardSurface,
  normalizeMoodboardExternalUrl,
  normalizeMoodboardNoteStyle,
  normalizeMoodboardOverlays,
  normalizeMoodboardPointerContrast,
  normalizeMoodboardSlotContentMode,
  normalizeMoodboardWeatherPayload,
  resolveStickyNoteTextScale,
  resizeMoodboardColumns,
} from "../../../lib/docBlocks.js";
import { ForecastNodeView } from "../../intel/ForecastNodeView.jsx";
import { useI18n } from "../../../i18n/useI18n.js";
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";
import { listHintedLibraryCatalogs, resolveWallColor } from "../../../lib/folderLibrary.js";
import {
  findLibraryItemBySlot,
  isMoodboardLibraryPick,
  libraryItemToMoodboardSlotPatch,
  moodboardSlotPersistedSrcForLibrary,
  resolveMoodboardSlotPresentation,
} from "../../../lib/libraryImageCardPick.js";
import {
  libraryFramePixelSize,
  moodboardCellCssAspectRatio,
  moodboardCellHeightOverWidth,
  moodboardSlotFrameAspect,
  moodboardSlotFrameLabel,
  normalizeLibraryFrameAspect,
} from "../../../lib/libraryFrameAspect.js";
import { LibraryImageCardPicker } from "../LibraryImageCardPicker.jsx";
import { FolderLibraryElementModal } from "../FolderLibraryElementModal.jsx";
import { MoodboardAttachmentModal } from "./MoodboardAttachmentModal.jsx";
import {
  contentRectToBoardPct,
  findMoodboardAnchorImg,
  getObjectFitContentRect,
  measureMoodboardSlotAnchorRects,
  mergeSlotAnchorRects,
  projectBoardPctToImagePct,
  resolveOverlayBoardPosition,
} from "../../../lib/moodboardOverlayAnchor.js";

/** Board geometry — must mirror .doc-moodboard__board padding/gap in left-panel.css. */
const BOARD_PAD_X = 6;
const BOARD_PAD_TOP = 6;
/** Bottom strip for float actions (caption no longer needs a tall strip). */
const BOARD_CAPTION_STRIP = 20;
/** Expanded workspace: symmetric pad on white board base (mirrors CSS expand board). */
const BOARD_PAD_EXPANDED = 6;
/** Inline document height vs full 9:16 column. */
const INLINE_HEIGHT_FACTOR = 0.72;
/** Expand: min extra content height above inline equivalent (visible jump). */
const EXPAND_MIN_DELTA_PX = 24;
/** Overlay shell max height (mirrors .doc-moodboard-workspace__body max-height). */
const EXPAND_OVERLAY_MAX_PX = 840;
const EXPAND_OVERLAY_MAX_VH = 0.88;
const SHOW_MOODBOARD_SLOT_TAGS = true;
const BOARD_GAP = 10;
/** Gap between stacked recipe cells (mirrors .doc-moodboard__recipe gap). */
const RECIPE_GAP = 8;
/** Medium stack gap in expand overlay (tighter 3:2 pair). */
const RECIPE_GAP_EXPANDED = 4;
/** Height / col-width — locked to publish frames (9:16 / 1:1 / 16:9). */
const BOARD_ASPECT_DEFAULT = 16 / 9; // thirds: large 9:16
const BOARD_ASPECT_HALVES = 1; // 1:1
/** Full-width column: 16:9 landscape. */
const BOARD_ASPECT_FULL = 9 / 16;

const EXPAND_ALL_SRC = "/uploads/expandall.svg";
const NOTES_CLEAR_SRC = "/uploads/SpinnerGap.svg";
const CALENDAR_WIRE_ICON_SRC = "/uploads/botones/e-c.svg";

const OVERLAY_PALETTE = [
  { kind: MOODBOARD_OVERLAY_KINDS.TWISTED, labelKey: "doc.moodboard.overlayTwisted" },
  { kind: MOODBOARD_OVERLAY_KINDS.STRAIGHT, labelKey: "doc.moodboard.overlayStraight" },
  { kind: MOODBOARD_OVERLAY_KINDS.UP, labelKey: "doc.moodboard.overlayUp" },
  { kind: MOODBOARD_OVERLAY_KINDS.DOWN, labelKey: "doc.moodboard.overlayDown" },
  { kind: MOODBOARD_OVERLAY_KINDS.POINTER, labelKey: "doc.moodboard.overlayPointer" },
];

/** Match ellipse / small-arrow dashed marks (`stroke-dasharray="2 2"`). */
const POINTER_DASH = "2 2";
const POINTER_CIRCLE_R_PX = (MOODBOARD_OVERLAY_SIZE_PX[MOODBOARD_OVERLAY_KINDS.POINTER] || 78) / 2;

/** Solid swatches for the floating color spheres (match stroke map). */
const OVERLAY_CONTRAST_SWATCH = {
  [MOODBOARD_POINTER_CONTRAST.INK]: "#161a1d",
  [MOODBOARD_POINTER_CONTRAST.LIGHT]: "#dce0e4",
  [MOODBOARD_POINTER_CONTRAST.SKY]: "#B9E5FE",
};

const OVERLAY_CONTRAST_OPTIONS = [
  { id: MOODBOARD_POINTER_CONTRAST.INK, labelKey: "doc.moodboard.overlayContrastInk" },
  { id: MOODBOARD_POINTER_CONTRAST.LIGHT, labelKey: "doc.moodboard.overlayContrastLight" },
  { id: MOODBOARD_POINTER_CONTRAST.SKY, labelKey: "doc.moodboard.overlayContrastSky" },
];

function resolveOverlayStroke(contrast) {
  const key = normalizeMoodboardPointerContrast(contrast);
  return MOODBOARD_OVERLAY_STROKE_BY_CONTRAST[key]
    || MOODBOARD_OVERLAY_STROKE_BY_CONTRAST[MOODBOARD_POINTER_CONTRAST.INK];
}

/**
 * @param {{ xPct: number, yPct: number, endXPct?: number, endYPct?: number }} overlay
 * @param {number} boardW
 * @param {number} boardH
 */
function pointerArrowGeometry(overlay, boardW, boardH) {
  if (!(boardW > 0) || !(boardH > 0)) return null;
  const cx = (overlay.xPct / 100) * boardW;
  const cy = (overlay.yPct / 100) * boardH;
  const tx = ((overlay.endXPct ?? overlay.xPct) / 100) * boardW;
  const ty = ((overlay.endYPct ?? overlay.yPct) / 100) * boardH;
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 1)) return null;
  const ux = dx / dist;
  const uy = dy / dist;
  const edge = Math.min(POINTER_CIRCLE_R_PX, dist * 0.45);
  const tipR = 3;
  const tipPull = Math.min(tipR, Math.max(0, dist - edge - 1));
  return {
    x1: cx + ux * edge,
    y1: cy + uy * edge,
    x2: tx - ux * tipPull,
    y2: ty - uy * tipPull,
    tipX: tx,
    tipY: ty,
    tipR,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

function MoodboardNotesBodyStatic({ text, title = "" }) {
  const model = parseScopeBriefText(text);
  const titleNorm = String(title || "").trim().toLowerCase();

  if (model?.sections?.length) {
    return (
      <div
        className="doc-moodboard__notes-body doc-moodboard__notes-body--static doc-moodboard__notes-body--structured"
      >
        {model.sections.map((section) => {
          const seasonNorm = String(section.season || "").trim().toLowerCase();
          const skipSeasonHeader = seasonNorm && titleNorm && seasonNorm === titleNorm;
          return (
            <section
              key={section.season || section.events[0]?.name}
              className="doc-moodboard__notes-season-block"
            >
              {section.season && !skipSeasonHeader ? (
                <div className="doc-moodboard__notes-season">{section.season}</div>
              ) : null}
              <ul className="doc-moodboard__notes-events">
                {section.events.map((event) => (
                  <li
                    key={`${event.name}-${event.date}`}
                    className="doc-moodboard__notes-event"
                  >
                    <span className="doc-moodboard__notes-event-name">{event.name}</span>
                    {event.date ? (
                      <span className="doc-moodboard__notes-event-date tnum">{event.date}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="doc-moodboard__notes-body doc-moodboard__notes-body--static">
      {text || ""}
    </div>
  );
}

function OverlayPointerRailIcon() {
  return (
    <svg
      className="doc-moodboard__overlay-rail-icon"
      viewBox="0 0 36 36"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="18"
        r="6"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      <path
        d="M18.5 18 H27.5"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        strokeLinecap="round"
      />
      <circle
        cx="29.5"
        cy="18"
        r="2.25"
        fill="rgba(255,255,255,0.92)"
        stroke="none"
      />
    </svg>
  );
}

const RECIPE_OPTIONS = [
  {
    id: MOODBOARD_RECIPES.LARGE,
    labelKey: "doc.moodboard.recipeLarge",
    iconSrc: "/uploads/large-image.svg",
    /** Left glyph width at 20px icon height (SVG label is clipped out). */
    iconClipPx: 18,
  },
  {
    id: MOODBOARD_RECIPES.MEDIUM_STACK,
    labelKey: "doc.moodboard.recipeMedium",
    iconSrc: "/uploads/split-in-half-block-view.svg",
    iconClipPx: 22,
  },
  {
    id: MOODBOARD_RECIPES.MEDIUM_STICKY,
    labelKey: "doc.moodboard.recipeMediumSticky",
    iconSrc: "/uploads/sticky-note-block-view.svg",
    iconClipPx: 20,
  },
];

const LAYOUT_OPTIONS = [
  {
    id: MOODBOARD_BOARD_LAYOUTS.THIRDS,
    labelKey: "doc.moodboard.layoutThirds",
    iconSrc: "/uploads/first-block.svg",
  },
  {
    id: MOODBOARD_BOARD_LAYOUTS.HALVES,
    labelKey: "doc.moodboard.layoutHalves",
    iconSrc: "/uploads/second-block.svg",
  },
  {
    id: MOODBOARD_BOARD_LAYOUTS.WIDE_NARROW,
    labelKey: "doc.moodboard.layoutWideNarrow",
    iconSrc: "/uploads/third-block.svg",
  },
  {
    id: MOODBOARD_BOARD_LAYOUTS.FULL,
    labelKey: "doc.moodboard.layoutFull",
    iconSrc: "/uploads/full-block.svg",
    showFullLabel: true,
  },
];

/**
 * Per-layout recipe availability:
 * - thirds: all recipes
 * - halves: large image only (both cols)
 * - wide_narrow: col0 large only; col1 large or sticky notes
 * - full: large image only
 * @param {string} boardLayout
 * @param {number} colIndex
 */
function recipeOptionsForColumn(boardLayout, colIndex) {
  if (
    boardLayout === MOODBOARD_BOARD_LAYOUTS.HALVES
    || boardLayout === MOODBOARD_BOARD_LAYOUTS.FULL
  ) {
    return RECIPE_OPTIONS.filter((option) => option.id === MOODBOARD_RECIPES.LARGE);
  }
  if (boardLayout === MOODBOARD_BOARD_LAYOUTS.WIDE_NARROW) {
    if (colIndex === 1) {
      return RECIPE_OPTIONS.filter((option) => (
        option.id === MOODBOARD_RECIPES.LARGE
        || option.id === MOODBOARD_RECIPES.MEDIUM_STICKY
      ));
    }
    return RECIPE_OPTIONS.filter((option) => option.id === MOODBOARD_RECIPES.LARGE);
  }
  return RECIPE_OPTIONS;
}

/**
 * Keep column if its recipe is allowed; otherwise demote to large when possible.
 * @param {object} col
 * @param {string} layout
 * @param {number} colIndex
 */
function coerceColumnRecipeForLayout(col, layout, colIndex) {
  if (!col?.recipe) return col;
  const allowed = new Set(
    recipeOptionsForColumn(layout, colIndex).map((option) => option.id),
  );
  if (allowed.has(col.recipe)) return col;
  if (allowed.has(MOODBOARD_RECIPES.LARGE)) {
    return createMoodboardColumn(MOODBOARD_RECIPES.LARGE, {
      images: col.images,
      ...columnTextPatch(col),
    });
  }
  return createMoodboardColumn(null);
}

/** Preserve column text fields when rebuilding a recipe column. */
function columnTextPatch(col) {
  return {
    stickyText: col.stickyText,
    stickyTitle: col.stickyTitle,
    infoLabel: col.infoLabel,
    noteStyle: col.noteStyle,
    calendarWireEnabled: col.calendarWireEnabled,
    stickyFromCalendar: col.stickyFromCalendar,
  };
}

/** Calendar connect / structured brief → same read-only notes UI as after Save. */
function moodboardNotesUseIntegratedView(column, isEdit) {
  if (!isEdit) return true;
  const notesEmpty = isMoodboardStickyEmpty(column);
  if (notesEmpty) return false;
  if (Boolean(column?.stickyFromCalendar)) return true;
  const model = parseScopeBriefText(column?.stickyText || "");
  return Boolean(model?.sections?.length);
}

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
    libraryItemId: "",
    libraryOwnerKind: "",
    libraryOwnerId: "",
    frameAspect: null,
    sourceMediaUrl: "",
    wallColor: null,
    contentMode: MOODBOARD_SLOT_CONTENT_MODES.IMAGE,
    noteHeadline: "",
    noteBody: "",
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

/** Clamp Notes body to char limit and available box height (full clientHeight).
 * @param {HTMLTextAreaElement|null} el
 * @param {string} raw
 */
function clampNotesText(el, raw) {
  const capped = String(raw ?? "").slice(0, MOODBOARD_NOTES_BODY_MAX);
  const maxH = el?.clientHeight ?? 0;
  if (!el || !(maxH > 0)) return capped;
  const { lineHeight } = measureBodyLineMetrics(el);
  const linesFromHeight = Math.max(1, Math.floor(maxH / Math.max(1, lineHeight)));
  const maxLines = Math.min(MOODBOARD_NOTES_MAX_LINES, linesFromHeight);
  const lineCapH = Math.round(maxLines * lineHeight);
  const fitH = Math.min(maxH, lineCapH);
  if (textFitsFixedHeight(el, capped, fitH)) return capped;
  let lo = 0;
  let hi = capped.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (textFitsFixedHeight(el, capped.slice(0, mid), fitH)) {
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
 * Per-column inner widths for the active board layout.
 * @param {string} boardLayout
 * @param {number} contentW — board width minus horizontal padding and gaps
 * @param {number} columnCount
 * @returns {number[]}
 */
function moodboardColumnWidths(boardLayout, contentW, columnCount) {
  if (boardLayout === MOODBOARD_BOARD_LAYOUTS.WIDE_NARROW) {
    return [contentW * (2 / 3), contentW * (1 / 3)];
  }
  if (boardLayout === MOODBOARD_BOARD_LAYOUTS.FULL) {
    return [contentW];
  }
  const w = contentW / Math.max(1, columnCount);
  return Array.from({ length: columnCount }, () => w);
}

/**
 * Natural height of one image slot at the given column width, or null if dims missing.
 * @param {{ width?: number, height?: number, src?: string, imageSaved?: boolean }|null} image
 * @param {number} colW
 * @returns {number|null}
 */
function imageNaturalHeightAtWidth(image, colW) {
  if (!image?.src && !image?.imageSaved) return null;
  const w = Number(image?.width) || 0;
  const h = Number(image?.height) || 0;
  if (!(w > 0) || !(h > 0) || !(colW > 0)) return null;
  return colW * (h / w);
}

/**
 * Estimate content-area height from locked slot aspects (publish frames).
 * Falls back to natural image dims only when a recipe has no slot target.
 * @param {object[]} columns
 * @param {number[]} colWidths
 * @param {string} boardLayout
 * @param {{ mediumRecipeGap?: number }} [options]
 * @returns {number|null}
 */
function estimateMoodboardContentHeight(
  columns,
  colWidths,
  boardLayout = MOODBOARD_BOARD_LAYOUTS.THIRDS,
  options = {},
) {
  const mediumRecipeGap = options.mediumRecipeGap ?? RECIPE_GAP;
  let maxH = 0;
  let any = false;
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    const colW = colWidths[i] || 0;
    if (!(colW > 0) || !col?.recipe) continue;
    const images = Array.isArray(col.images) ? col.images : [];
    let colH = null;

    if (col.recipe === MOODBOARD_RECIPES.LARGE) {
      const slotHow = moodboardCellHeightOverWidth(boardLayout, "large", i);
      colH = colW * slotHow;
      const natural = imageNaturalHeightAtWidth(images[0], colW);
      // Prefer slot lock; natural only if somehow missing slot.
      if (!(colH > 0) && natural != null) colH = natural;
    } else if (col.recipe === MOODBOARD_RECIPES.MEDIUM_STACK) {
      const slotHow = moodboardCellHeightOverWidth(boardLayout, "medium", i);
      colH = 2 * colW * slotHow + mediumRecipeGap;
    }
    // medium_sticky: no intrinsic height — inherits max from siblings.

    if (colH != null && colH > 0) {
      any = true;
      if (colH > maxH) maxH = colH;
    }
  }
  return any ? Math.round(maxH) : null;
}

/**
 * Moodboard: full-width board. Each column picks large / medium×2 / sticky notes.
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
  folderLibraryId = "",
  libraryOwnerId = "",
  libraryOwnerKind = "folder",
}) {
  const { t } = useI18n();
  const boardRef = useRef(null);
  const workspaceBodyRef = useRef(null);
  const captionRef = useRef(null);
  const captionLimitTimerRef = useRef(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [error, setError] = useState(null);
  const [activeCol, setActiveCol] = useState(0);
  const [boardHeight, setBoardHeight] = useState(null);
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  /** slotId → painted image box as % of the board (survives expand). */
  const [slotAnchorRects, setSlotAnchorRects] = useState({});
  const slotAnchorRectsRef = useRef({});
  slotAnchorRectsRef.current = slotAnchorRects;
  const [captionAtLimit, setCaptionAtLimit] = useState(false);
  const [attachmentSlot, setAttachmentSlot] = useState(null);
  const [libraryPickerSlot, setLibraryPickerSlot] = useState(null);
  /** Staged library pick — applied to board only on attach Accept. */
  const [pendingLibraryPick, setPendingLibraryPick] = useState(null);
  const [createLibraryModalOpen, setCreateLibraryModalOpen] = useState(false);
  const [createLibraryMediaUrl, setCreateLibraryMediaUrl] = useState("");
  const [createLibraryFrameAspect, setCreateLibraryFrameAspect] = useState(null);
  const [editLibrarySlot, setEditLibrarySlot] = useState(null);
  const createFileInputRef = useRef(null);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [pendingOverlayKind, setPendingOverlayKind] = useState(null);
  const [focusWriteMode, setFocusWriteMode] = useState(false);
  const overlayDragRef = useRef(null);
  const overlaysRef = useRef([]);

  const pickerFolderId = String(folderLibraryId || "").trim();
  const pickerDocumentId = libraryOwnerKind === "document"
    ? String(libraryOwnerId || "").trim()
    : "";
  const pickerPrimaryKind = libraryOwnerKind === "document" ? "document" : "folder";
  const pickerPrimaryId = pickerPrimaryKind === "document"
    ? pickerDocumentId
    : pickerFolderId;
  const canPickLibrary = Boolean(pickerFolderId || pickerDocumentId);
  const libraryCatalogs = useMemo(
    () => listHintedLibraryCatalogs({ folderId: pickerFolderId, documentId: pickerDocumentId }),
    [pickerFolderId, pickerDocumentId],
  );

  const boardLayout = normalizeMoodboardBoardLayout(block?.boardLayout);
  const boardSurface = normalizeMoodboardBoardSurface(block?.boardSurface);
  const columnCount = moodboardColumnCountForLayout(boardLayout);
  const columns = Array.isArray(block?.columns) && block.columns.length === columnCount
    ? block.columns
    : resizeMoodboardColumns(block?.columns, columnCount);

  const overlays = normalizeMoodboardOverlays(block?.overlays);
  overlaysRef.current = overlays;
  const savedImageCount = countMoodboardSavedImages({ columns });
  const savableContentCount = countMoodboardSavableContent({ columns });
  const moodboardSaved = Boolean(block?.moodboardSaved && savableContentCount > 0);
  const isEdit = !moodboardSaved;

  useEffect(() => {
    setActiveCol((prev) => Math.min(prev, Math.max(0, columnCount - 1)));
  }, [columnCount]);

  useEffect(() => {
    if (!isEdit) {
      setSelectedOverlayId(null);
      setPendingOverlayKind(null);
    }
  }, [isEdit]);

  useEffect(() => {
    if (!selectedOverlayId) return;
    if (!overlays.some((item) => item.id === selectedOverlayId)) {
      setSelectedOverlayId(null);
    }
  }, [overlays, selectedOverlayId]);

  useEffect(() => {
    if (!boardExpanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      // Attachment modal owns Escape while open (higher z-index).
      if (attachmentSlot) return;
      event.preventDefault();
      setBoardExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [boardExpanded, attachmentSlot]);

  const pulseCaptionLimit = useCallback(() => {
    setCaptionAtLimit(true);
    if (captionLimitTimerRef.current) window.clearTimeout(captionLimitTimerRef.current);
    captionLimitTimerRef.current = window.setTimeout(() => setCaptionAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (captionLimitTimerRef.current) window.clearTimeout(captionLimitTimerRef.current);
  }, []);

  const columnsGeomKey = columns.map((col) => {
    const imgs = Array.isArray(col?.images) ? col.images : [];
    const dims = imgs.map((img) => `${img?.width || 0}x${img?.height || 0}`).join(",");
    return `${col?.recipe || ""}:${dims}`;
  }).join("|");
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      const width = board.clientWidth;
      if (!(width > 0)) return;
      const gaps = Math.max(0, columnCount - 1);
      const padX = boardExpanded ? BOARD_PAD_EXPANDED : BOARD_PAD_X;
      const padTop = boardExpanded ? BOARD_PAD_EXPANDED : BOARD_PAD_TOP;
      const padBottom = boardExpanded ? BOARD_PAD_EXPANDED : BOARD_CAPTION_STRIP;
      const contentW = Math.max(1, width - padX * 2 - BOARD_GAP * gaps);
      // Max height from the widest column so halves / wide+narrow / full stay readable.
      let colInner;
      if (boardLayout === MOODBOARD_BOARD_LAYOUTS.WIDE_NARROW) {
        colInner = contentW * (2 / 3);
      } else if (boardLayout === MOODBOARD_BOARD_LAYOUTS.FULL) {
        colInner = contentW;
      } else {
        colInner = contentW / columnCount;
      }
      let aspect = BOARD_ASPECT_DEFAULT;
      if (boardLayout === MOODBOARD_BOARD_LAYOUTS.HALVES) aspect = BOARD_ASPECT_HALVES;
      if (boardLayout === MOODBOARD_BOARD_LAYOUTS.FULL) aspect = BOARD_ASPECT_FULL;

      const colWidths = moodboardColumnWidths(boardLayout, contentW, columnCount);
      const estimated = estimateMoodboardContentHeight(
        columnsRef.current,
        colWidths,
        boardLayout,
        { mediumRecipeGap: boardExpanded ? RECIPE_GAP_EXPANDED : RECIPE_GAP },
      );

      // Inline: compact designed height (never grow for publish aspects).
      // Expand: slot geometry at overlay width — fit frames, not cover-zoom.
      let maxContentH;
      const inlineEquivalent = Math.round(colInner * aspect * INLINE_HEIGHT_FACTOR);
      if (boardExpanded) {
        const winH = typeof window !== "undefined" ? window.innerHeight : 800;
        const overlayMax = Math.round(Math.min(winH * EXPAND_OVERLAY_MAX_VH, EXPAND_OVERLAY_MAX_PX));
        const chromeSlack = isEdit ? 56 : 0;
        const boardBudget = Math.max(240, overlayMax - chromeSlack);
        const pad = padTop + padBottom;
        const budgetContent = Math.max(220, boardBudget - pad);
        // Never shorter than publish slot geometry — trim clips 9:16 bottom pad + sticky.
        // Notes-only (medium_sticky): estimated is null — fill overlay budget so paper isn't short.
        if (estimated != null) {
          maxContentH = Math.round(
            Math.min(
              Math.max(estimated, inlineEquivalent + EXPAND_MIN_DELTA_PX),
              budgetContent,
            ),
          );
        } else {
          // Notes-only column: fill overlay budget so textured paper isn't short.
          maxContentH = Math.round(Math.max(220, budgetContent));
        }
      } else {
        const lineCap = boardLayout === MOODBOARD_BOARD_LAYOUTS.FULL
          ? Math.round(IMAGE_SPLIT_BODY_MAX_LINES * 20.3 * 2.15)
          : Math.round(IMAGE_SPLIT_BODY_MAX_LINES * 20.3 * 1.65);
        maxContentH = Math.round(
          Math.max(
            220,
            Math.min(inlineEquivalent, lineCap),
          ),
        );
      }
      const maxH = maxContentH + padTop + padBottom;
      const nextH = maxH;

      setBoardHeight((prev) => (prev === nextH ? prev : nextH));
      setBoardSize((prev) => (
        prev.w === width && prev.h === nextH ? prev : { w: width, h: nextH }
      ));
      // After height settles, measure painted image boxes for overlay anchors.
      const applyAnchorMeasure = () => {
        const nextRects = measureMoodboardSlotAnchorRects(boardRef.current);
        setSlotAnchorRects((prev) => mergeSlotAnchorRects(prev, nextRects));
      };
      requestAnimationFrame(() => {
        applyAnchorMeasure();
        requestAnimationFrame(applyAnchorMeasure);
      });
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(board);
    const bodyEl = workspaceBodyRef.current;
    if (boardExpanded && bodyEl) ro.observe(bodyEl);
    const onWinResize = () => {
      if (boardExpanded) requestAnimationFrame(sync);
    };
    if (boardExpanded) window.addEventListener("resize", onWinResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
    };
  }, [boardLayout, columnCount, savedImageCount, moodboardSaved, block?.caption, columnsGeomKey, boardExpanded, isEdit]);

  // Expand/collapse moves the board into a portal and changes object-fit.
  // Drop stale inline geometry immediately so we never paint image-% with the wrong board box.
  useLayoutEffect(() => {
    setSlotAnchorRects({});
  }, [boardExpanded]);

  // Remeasure slot photos after expand portal layout (and whenever images change).
  useLayoutEffect(() => {
    let cancelled = false;
    const rafIds = [];
    const measure = () => {
      if (cancelled) return;
      const board = boardRef.current;
      if (!board) return;
      const nextRects = measureMoodboardSlotAnchorRects(board);
      setSlotAnchorRects((prev) => mergeSlotAnchorRects(prev, nextRects));
    };
    measure();
    rafIds.push(requestAnimationFrame(() => {
      measure();
      rafIds.push(requestAnimationFrame(measure));
    }));

    const board = boardRef.current;
    /** @type {ResizeObserver | null} */
    let imgRo = null;
    if (board && typeof ResizeObserver !== "undefined") {
      imgRo = new ResizeObserver(() => {
        requestAnimationFrame(measure);
      });
      board.querySelectorAll("img[data-mb-slot-img]").forEach((node) => {
        imgRo.observe(node);
      });
    }

    return () => {
      cancelled = true;
      rafIds.forEach((id) => cancelAnimationFrame(id));
      imgRo?.disconnect();
    };
  }, [boardExpanded, columnsGeomKey, boardHeight, boardSize.w]);

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, moodboardSaved: false });
  };

  const patchColumns = (updater) => {
    const next = columns.map((col, index) => updater(col, index));
    handleFieldChange({ columns: next });
  };

  const refreshSlotAnchorRects = useCallback(() => {
    const nextRects = measureMoodboardSlotAnchorRects(boardRef.current);
    setSlotAnchorRects((prev) => mergeSlotAnchorRects(prev, nextRects));
  }, []);

  const addOverlayAt = (kind, clientX, clientY) => {
    if (!isEdit) return;
    const board = boardRef.current;
    let xPct = 45;
    let yPct = 40;
    let anchorSlotId = "";
    const isPointer = kind === MOODBOARD_OVERLAY_KINDS.POINTER;
    // Place near the pointer (half of the overlay box) so the mark
    // lands on the highlight/tag the user aimed at — not a fixed board %.
    // Pointer stores circle *center* at the click; other kinds use top-left.
    const size = MOODBOARD_OVERLAY_SIZE_PX[kind] || 44;
    const half = size / 2;
    if (board && Number.isFinite(clientX) && Number.isFinite(clientY)) {
      const rect = board.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        let boardXPct;
        let boardYPct;
        if (isPointer) {
          const cx = Math.max(0, Math.min(rect.width, clientX - rect.left));
          const cy = Math.max(0, Math.min(rect.height, clientY - rect.top));
          boardXPct = (cx / rect.width) * 100;
          boardYPct = (cy / rect.height) * 100;
        } else {
          const left = Math.max(
            0,
            Math.min(rect.width - size, clientX - rect.left - half),
          );
          const top = Math.max(
            0,
            Math.min(rect.height - size, clientY - rect.top - half),
          );
          boardXPct = (left / rect.width) * 100;
          boardYPct = (top / rect.height) * 100;
        }

        const img = findMoodboardAnchorImg(board, clientX, clientY);
        const slotId = img?.getAttribute?.("data-mb-slot-img") || "";
        if (img && slotId) {
          const content = getObjectFitContentRect(img);
          const imageRect = contentRectToBoardPct(rect, content);
          if (imageRect) {
            const local = projectBoardPctToImagePct(imageRect, boardXPct, boardYPct);
            xPct = local.xPct;
            yPct = local.yPct;
            anchorSlotId = slotId;
          } else {
            xPct = boardXPct;
            yPct = boardYPct;
          }
        } else {
          xPct = boardXPct;
          yPct = boardYPct;
        }
      }
    }
    const created = createMoodboardOverlay(kind, {
      xPct,
      yPct,
      ...(anchorSlotId ? { anchorSlotId } : {}),
    });
    if (!created) return;
    handleFieldChange({ overlays: [...overlaysRef.current, created] });
    setSelectedOverlayId(created.id);
    setPendingOverlayKind(null);
  };

  const removeOverlay = (overlayId) => {
    if (!isEdit || !overlayId) return;
    handleFieldChange({
      overlays: overlaysRef.current.filter((item) => item.id !== overlayId),
    });
    setSelectedOverlayId((prev) => (prev === overlayId ? null : prev));
  };

  const setOverlayContrast = (overlayId, contrast) => {
    if (!isEdit || !overlayId) return;
    const next = normalizeMoodboardPointerContrast(contrast);
    handleFieldChange({
      overlays: overlaysRef.current.map((item) => (
        item.id === overlayId
          ? { ...item, contrast: next }
          : item
      )),
    });
  };

  const renderOverlayContrastPicker = (overlay, style) => {
    const contrast = normalizeMoodboardPointerContrast(overlay.contrast);
    return (
      <div
        className="doc-moodboard__overlay-contrast"
        role="radiogroup"
        aria-label={t("doc.moodboard.overlayContrastLabel")}
        style={style}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {OVERLAY_CONTRAST_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={contrast === option.id}
            aria-label={t(option.labelKey)}
            title={t(option.labelKey)}
            className={
              "doc-moodboard__overlay-contrast-swatch"
              + (contrast === option.id
                ? " doc-moodboard__overlay-contrast-swatch--active"
                : "")
            }
            style={{
              "--mb-contrast-swatch": OVERLAY_CONTRAST_SWATCH[option.id],
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOverlayContrast(overlay.id, option.id);
            }}
          />
        ))}
      </div>
    );
  };

  const startOverlayDrag = (event, overlay) => {
    if (!isEdit || event.button !== 0) return;
    if (overlay.kind === MOODBOARD_OVERLAY_KINDS.POINTER) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedOverlayId(overlay.id);
    setPendingOverlayKind(null);
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    if (!(boardRect.width > 0) || !(boardRect.height > 0)) return;

    const overlayEl = event.currentTarget;
    const itemRect = overlayEl.getBoundingClientRect();
    const imageRect = overlay.anchorSlotId
      ? slotAnchorRectsRef.current[overlay.anchorSlotId]
      : null;
    overlayDragRef.current = {
      id: overlay.id,
      mode: "box",
      offsetX: event.clientX - itemRect.left,
      offsetY: event.clientY - itemRect.top,
      itemW: itemRect.width,
      itemH: itemRect.height,
      originX: event.clientX,
      originY: event.clientY,
      anchorSlotId: overlay.anchorSlotId || "",
      imageRect: imageRect || null,
      moved: false,
    };

    const onMove = (moveEvent) => {
      const drag = overlayDragRef.current;
      const el = boardRef.current;
      if (!drag || !el) return;
      const dx = moveEvent.clientX - drag.originX;
      const dy = moveEvent.clientY - drag.originY;
      // Ignore tiny pointer jitter on click-to-select so X/Y do not drift.
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      const rect = el.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) return;
      const maxX = Math.max(0, rect.width - drag.itemW);
      const maxY = Math.max(0, rect.height - drag.itemH);
      const left = Math.max(0, Math.min(maxX, moveEvent.clientX - rect.left - drag.offsetX));
      const top = Math.max(0, Math.min(maxY, moveEvent.clientY - rect.top - drag.offsetY));
      const boardXPct = (left / rect.width) * 100;
      const boardYPct = (top / rect.height) * 100;
      const liveImageRect = drag.anchorSlotId
        ? (slotAnchorRectsRef.current[drag.anchorSlotId] || drag.imageRect)
        : null;
      let nextX = boardXPct;
      let nextY = boardYPct;
      if (liveImageRect) {
        const local = projectBoardPctToImagePct(liveImageRect, boardXPct, boardYPct);
        nextX = local.xPct;
        nextY = local.yPct;
      }
      handleFieldChange({
        overlays: overlaysRef.current.map((item) => (
          item.id === drag.id ? { ...item, xPct: nextX, yPct: nextY } : item
        )),
      });
    };

    const onUp = (upEvent) => {
      const drag = overlayDragRef.current;
      overlayDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Legacy board-only overlays: attach to the photo under the cursor on drag end.
      if (!drag?.moved || drag.anchorSlotId || !boardRef.current) return;
      const img = findMoodboardAnchorImg(boardRef.current, upEvent.clientX, upEvent.clientY);
      const slotId = img?.getAttribute?.("data-mb-slot-img") || "";
      if (!img || !slotId) return;
      const rect = boardRef.current.getBoundingClientRect();
      const content = getObjectFitContentRect(img);
      const imageRect = contentRectToBoardPct(rect, content);
      if (!imageRect) return;
      const item = overlaysRef.current.find((o) => o.id === drag.id);
      if (!item) return;
      const local = projectBoardPctToImagePct(imageRect, item.xPct, item.yPct);
      handleFieldChange({
        overlays: overlaysRef.current.map((o) => (
          o.id === drag.id
            ? { ...o, anchorSlotId: slotId, xPct: local.xPct, yPct: local.yPct }
            : o
        )),
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startPointerBodyDrag = (event, overlay) => {
    if (!isEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedOverlayId(overlay.id);
    setPendingOverlayKind(null);
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    if (!(boardRect.width > 0) || !(boardRect.height > 0)) return;

    const imageRect = overlay.anchorSlotId
      ? slotAnchorRectsRef.current[overlay.anchorSlotId]
      : null;
    overlayDragRef.current = {
      id: overlay.id,
      mode: "pointer-body",
      originX: event.clientX,
      originY: event.clientY,
      startXPct: overlay.xPct,
      startYPct: overlay.yPct,
      startEndXPct: overlay.endXPct ?? overlay.xPct,
      startEndYPct: overlay.endYPct ?? overlay.yPct,
      boardW: boardRect.width,
      boardH: boardRect.height,
      anchorSlotId: overlay.anchorSlotId || "",
      imageRect: imageRect || null,
      moved: false,
    };

    const onMove = (moveEvent) => {
      const drag = overlayDragRef.current;
      if (!drag || drag.mode !== "pointer-body") return;
      const dxPx = moveEvent.clientX - drag.originX;
      const dyPx = moveEvent.clientY - drag.originY;
      if (!drag.moved && Math.hypot(dxPx, dyPx) < 4) return;
      drag.moved = true;
      const dBoardXPct = (dxPx / drag.boardW) * 100;
      const dBoardYPct = (dyPx / drag.boardH) * 100;
      const liveImageRect = drag.anchorSlotId
        ? (slotAnchorRectsRef.current[drag.anchorSlotId] || drag.imageRect)
        : null;
      const clampBoard = (v) => Math.max(0, Math.min(100, v));
      const clampImage = (v) => Math.max(-50, Math.min(150, v));
      if (liveImageRect && liveImageRect.widthPct > 0 && liveImageRect.heightPct > 0) {
        const dImageXPct = (dBoardXPct / liveImageRect.widthPct) * 100;
        const dImageYPct = (dBoardYPct / liveImageRect.heightPct) * 100;
        handleFieldChange({
          overlays: overlaysRef.current.map((item) => (
            item.id === drag.id
              ? {
                ...item,
                xPct: clampImage(drag.startXPct + dImageXPct),
                yPct: clampImage(drag.startYPct + dImageYPct),
                endXPct: clampImage(drag.startEndXPct + dImageXPct),
                endYPct: clampImage(drag.startEndYPct + dImageYPct),
              }
              : item
          )),
        });
        return;
      }
      handleFieldChange({
        overlays: overlaysRef.current.map((item) => (
          item.id === drag.id
            ? {
              ...item,
              xPct: clampBoard(drag.startXPct + dBoardXPct),
              yPct: clampBoard(drag.startYPct + dBoardYPct),
              endXPct: clampBoard(drag.startEndXPct + dBoardXPct),
              endYPct: clampBoard(drag.startEndYPct + dBoardYPct),
            }
            : item
        )),
      });
    };

    const onUp = (upEvent) => {
      const drag = overlayDragRef.current;
      overlayDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!drag?.moved || drag.anchorSlotId || !boardRef.current) return;
      const img = findMoodboardAnchorImg(boardRef.current, upEvent.clientX, upEvent.clientY);
      const slotId = img?.getAttribute?.("data-mb-slot-img") || "";
      if (!img || !slotId) return;
      const rect = boardRef.current.getBoundingClientRect();
      const content = getObjectFitContentRect(img);
      const nextImageRect = contentRectToBoardPct(rect, content);
      if (!nextImageRect) return;
      const item = overlaysRef.current.find((o) => o.id === drag.id);
      if (!item) return;
      const origin = projectBoardPctToImagePct(nextImageRect, item.xPct, item.yPct);
      const tip = projectBoardPctToImagePct(
        nextImageRect,
        item.endXPct ?? item.xPct,
        item.endYPct ?? item.yPct,
      );
      handleFieldChange({
        overlays: overlaysRef.current.map((o) => (
          o.id === drag.id
            ? {
              ...o,
              anchorSlotId: slotId,
              xPct: origin.xPct,
              yPct: origin.yPct,
              endXPct: tip.xPct,
              endYPct: tip.yPct,
            }
            : o
        )),
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startPointerTipDrag = (event, overlay) => {
    if (!isEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedOverlayId(overlay.id);
    setPendingOverlayKind(null);
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    if (!(boardRect.width > 0) || !(boardRect.height > 0)) return;

    const imageRect = overlay.anchorSlotId
      ? slotAnchorRectsRef.current[overlay.anchorSlotId]
      : null;
    overlayDragRef.current = {
      id: overlay.id,
      mode: "pointer-tip",
      boardW: boardRect.width,
      boardH: boardRect.height,
      boardLeft: boardRect.left,
      boardTop: boardRect.top,
      anchorSlotId: overlay.anchorSlotId || "",
      imageRect: imageRect || null,
      moved: false,
      originX: event.clientX,
      originY: event.clientY,
    };

    const onMove = (moveEvent) => {
      const drag = overlayDragRef.current;
      if (!drag || drag.mode !== "pointer-tip") return;
      const dx = moveEvent.clientX - drag.originX;
      const dy = moveEvent.clientY - drag.originY;
      if (!drag.moved && Math.hypot(dx, dy) < 2) return;
      drag.moved = true;
      const x = Math.max(0, Math.min(drag.boardW, moveEvent.clientX - drag.boardLeft));
      const y = Math.max(0, Math.min(drag.boardH, moveEvent.clientY - drag.boardTop));
      const boardEndXPct = (x / drag.boardW) * 100;
      const boardEndYPct = (y / drag.boardH) * 100;
      const liveImageRect = drag.anchorSlotId
        ? (slotAnchorRectsRef.current[drag.anchorSlotId] || drag.imageRect)
        : null;
      if (liveImageRect) {
        const local = projectBoardPctToImagePct(liveImageRect, boardEndXPct, boardEndYPct);
        handleFieldChange({
          overlays: overlaysRef.current.map((item) => (
            item.id === drag.id
              ? { ...item, endXPct: local.xPct, endYPct: local.yPct }
              : item
          )),
        });
        return;
      }
      handleFieldChange({
        overlays: overlaysRef.current.map((item) => (
          item.id === drag.id
            ? { ...item, endXPct: boardEndXPct, endYPct: boardEndYPct }
            : item
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
    const allowed = recipeOptionsForColumn(boardLayout, colIndex)
      .some((option) => option.id === recipe);
    if (!allowed) return;
    setActiveCol(colIndex);
    patchColumns((col, index) => {
      if (index !== colIndex) return col;
      const text = columnTextPatch(col);
      if (
        recipe === MOODBOARD_RECIPES.MEDIUM_STICKY
        && !(text.stickyTitle || "").trim()
      ) {
        text.stickyTitle = MOODBOARD_NOTES_TITLE_DEFAULT;
      }
      return createMoodboardColumn(recipe, {
        images: col.images,
        ...text,
      });
    });
  };

  const clearColumn = (colIndex) => {
    if (!isEdit) return;
    patchColumns((col, index) => (index === colIndex ? createMoodboardColumn(null) : col));
  };

  const clearNotesContent = (colIndex) => {
    if (!isEdit) return;
    patchColumns((col, index) => {
      if (index !== colIndex || col.recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY) return col;
      return createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY, {
        images: col.images,
        stickyTitle: "",
        stickyText: "",
        infoLabel: col.infoLabel,
        noteStyle: col.noteStyle,
        calendarWireEnabled: false,
        stickyFromCalendar: false,
      });
    });
  };

  const setBoardLayout = (nextLayout) => {
    if (!isEdit) return;
    const layout = normalizeMoodboardBoardLayout(nextLayout);
    if (layout === boardLayout) return;
    const nextCount = moodboardColumnCountForLayout(layout);
    const resized = resizeMoodboardColumns(columns, nextCount).map((col, index) => (
      coerceColumnRecipeForLayout(col, layout, index)
    ));
    setActiveCol((prev) => Math.min(prev, nextCount - 1));
    handleFieldChange({ boardLayout: layout, columns: resized });
  };

  const setBoardSurface = (nextSurface) => {
    if (!isEdit) return;
    const surface = normalizeMoodboardBoardSurface(nextSurface);
    if (surface === boardSurface) return;
    handleFieldChange({ boardSurface: surface });
  };

  const slotKey = (colIndex, imageIndex) => `${colIndex}:${imageIndex}`;

  const openAttachmentModal = (colIndex, imageIndex, sizeClass) => {
    setActiveCol(colIndex);
    setPendingLibraryPick(null);
    setAttachmentSlot({ colIndex, imageIndex, sizeClass });
  };

  const openLibraryPicker = (colIndex, imageIndex, sizeClass) => {
    if (!isEdit || !canPickLibrary) return;
    setActiveCol(colIndex);
    setPendingLibraryPick(null);
    setLibraryPickerSlot({ colIndex, imageIndex, sizeClass });
  };

  const closeCreateLibraryModal = () => {
    setCreateLibraryModalOpen(false);
    setCreateLibraryMediaUrl("");
    setCreateLibraryFrameAspect(null);
  };

  const applyLibraryItemToMoodboardSlot = (
    colIndex,
    imageIndex,
    sizeClass,
    item,
    ownerKind,
    ownerId,
    options = {},
  ) => {
    if (!isEdit || !isMoodboardLibraryPick(item)) return false;
    const resolvedOwnerId = String(ownerId || "").trim()
      || (ownerKind === "folder" ? pickerFolderId : pickerDocumentId);
    const patch = libraryItemToMoodboardSlotPatch(item, ownerKind, resolvedOwnerId);
    if (!patch) return false;
    const prev = columns[colIndex]?.images?.[imageIndex] || emptySlot();
    const targetFrame = moodboardSlotFrameAspect(
      boardLayout,
      sizeClass || "large",
      colIndex,
    );
    const wall = item.wallColor || "#FFFFFF";
    const persistedSrc = moodboardSlotPersistedSrcForLibrary(targetFrame, item);
    const dims = libraryFramePixelSize(targetFrame, 1080);
    const src = persistedSrc || patch.src || "";
    const hasImage = Boolean(src || patch.libraryItemId);

    patchColumns((col, index) => {
      if (index !== colIndex) return col;
      const images = Array.isArray(col.images) ? [...col.images] : [];
      while (images.length <= imageIndex) images.push(emptySlot());
      images[imageIndex] = {
        slotId: prev.slotId,
        src,
        name: patch.name || "",
        alt: patch.alt || "",
        width: dims?.width || patch.width || 0,
        height: dims?.height || patch.height || 0,
        imageSaved: hasImage,
        kind: "image",
        externalUrl: normalizeMoodboardExternalUrl(prev.externalUrl || ""),
        tagLabel: options.preserveTagLabel ? String(prev.tagLabel || "").trim() : "",
        libraryItemId: patch.libraryItemId || "",
        libraryOwnerKind: patch.libraryOwnerKind || "",
        libraryOwnerId: patch.libraryOwnerId || "",
        frameAspect: hasImage
          ? (normalizeLibraryFrameAspect(targetFrame) || null)
          : null,
        sourceMediaUrl: "",
        wallColor: hasImage ? (wall || null) : null,
        contentMode: MOODBOARD_SLOT_CONTENT_MODES.IMAGE,
        weatherPayload: null,
        noteHeadline: prev.noteHeadline || "",
        noteBody: prev.noteBody || "",
      };
      return createMoodboardColumn(col.recipe, {
        images,
        ...columnTextPatch(col),
      });
    });
    setError(null);
    return true;
  };

  const openCreateLibraryFromPicker = () => {
    if (!isEdit || !libraryPickerSlot || !pickerPrimaryId) return;
    const { colIndex, sizeClass } = libraryPickerSlot;
    setCreateLibraryFrameAspect(moodboardSlotFrameAspect(
      boardLayout,
      sizeClass || "large",
      colIndex,
    ));
    createFileInputRef.current?.click();
  };

  const handleCreateLibraryFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !pickerPrimaryId || !libraryPickerSlot || !isEdit) return;
    if (!file.type.startsWith("image/")) {
      setError(t("doc.library.invalidImage"));
      event.target.value = "";
      return;
    }
    setError(null);
    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "LIBIMG",
        scopeId: pickerPrimaryId,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.88,
      });
      if (converted?.src) {
        setCreateLibraryMediaUrl(converted.src);
        setCreateLibraryModalOpen(true);
      }
    } catch (err) {
      setError(err?.message || t("doc.library.uploadFailed"));
    } finally {
      event.target.value = "";
    }
  };

  const handleCreateLibrarySaved = (saved) => {
    if (!libraryPickerSlot || !saved) {
      closeCreateLibraryModal();
      return;
    }
    const { colIndex, imageIndex, sizeClass } = libraryPickerSlot;
    const applied = applyLibraryItemToMoodboardSlot(
      colIndex,
      imageIndex,
      sizeClass,
      saved,
      pickerPrimaryKind,
      pickerPrimaryId,
    );
    closeCreateLibraryModal();
    if (applied) {
      setLibraryPickerSlot(null);
      setPendingLibraryPick(null);
    }
  };

  const openEditLibraryFromSlot = (colIndex, imageIndex, sizeClass) => {
    if (!isEdit || !canPickLibrary) return;
    const image = columns[colIndex]?.images?.[imageIndex];
    const libraryItem = findLibraryItemBySlot(image, libraryCatalogs);
    if (!libraryItem) return;
    setEditLibrarySlot({ colIndex, imageIndex, sizeClass: sizeClass || "large" });
  };

  const handleEditLibrarySaved = (saved) => {
    if (!editLibrarySlot || !saved) {
      setEditLibrarySlot(null);
      return;
    }
    const { colIndex, imageIndex, sizeClass } = editLibrarySlot;
    const prev = columns[colIndex]?.images?.[imageIndex] || emptySlot();
    const ownerKind = String(prev.libraryOwnerKind || "").trim() || pickerPrimaryKind;
    const ownerId = String(prev.libraryOwnerId || "").trim()
      || (ownerKind === "folder" ? pickerFolderId : pickerDocumentId);
    applyLibraryItemToMoodboardSlot(
      colIndex,
      imageIndex,
      sizeClass,
      saved,
      ownerKind,
      ownerId,
      { preserveTagLabel: true },
    );
    setEditLibrarySlot(null);
  };

  const handlePickLibraryItem = (item, ownerKind, ownerId) => {
    if (!isEdit || !libraryPickerSlot) return;
    const { colIndex, imageIndex, sizeClass } = libraryPickerSlot;
    const resolvedOwnerId = String(ownerId || "").trim()
      || (ownerKind === "folder" ? pickerFolderId : pickerDocumentId);
    const patch = libraryItemToMoodboardSlotPatch(item, ownerKind, resolvedOwnerId);
    if (!patch) return;
    const prev = columns[colIndex]?.images?.[imageIndex] || emptySlot();
    const targetFrame = moodboardSlotFrameAspect(
      boardLayout,
      sizeClass || "large",
      colIndex,
    );
    const wall = item.wallColor || "#FFFFFF";
    const persistedSrc = moodboardSlotPersistedSrcForLibrary(targetFrame, item);
    const dims = libraryFramePixelSize(targetFrame, 1080);
    setError(null);
    // Stage only — no board write, no auto-tag from library ficha.
    setPendingLibraryPick({
      ...prev,
      ...patch,
      slotId: prev.slotId,
      src: persistedSrc,
      width: dims?.width || 0,
      height: dims?.height || 0,
      imageSaved: true,
      kind: "image",
      externalUrl: prev.externalUrl || "",
      tagLabel: "",
      frameAspect: targetFrame,
      sourceMediaUrl: "",
      wallColor: wall,
    });
  };

  const goAttachFromLibrary = () => {
    if (!isEdit || !libraryPickerSlot) return;
    const { colIndex, imageIndex, sizeClass } = libraryPickerSlot;
    const existing = columns[colIndex]?.images?.[imageIndex] || emptySlot();
    const hasExisting = Boolean(
      existing.imageSaved && (existing.src || existing.libraryItemId || normalizeMoodboardExternalUrl(existing.externalUrl)),
    );
    if (!pendingLibraryPick && !hasExisting) return;
    setAttachmentSlot({ colIndex, imageIndex, sizeClass: sizeClass || "large" });
    setLibraryPickerSlot(null);
  };

  const acceptAttachment = (draft) => {
    if (!attachmentSlot || !isEdit) return;
    const { colIndex, imageIndex } = attachmentSlot;
    const prev = columns[colIndex]?.images?.[imageIndex] || emptySlot();
    const link = normalizeMoodboardExternalUrl(draft.externalUrl);
    const hasImage = Boolean(draft.imageSaved && (draft.src || draft.libraryItemId));
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
        libraryItemId: draft.libraryItemId || prev.libraryItemId || "",
        libraryOwnerKind: draft.libraryOwnerKind || prev.libraryOwnerKind || "",
        libraryOwnerId: draft.libraryOwnerId || prev.libraryOwnerId || "",
        frameAspect: hasImage
          ? (normalizeLibraryFrameAspect(draft.frameAspect) || prev.frameAspect)
          : null,
        sourceMediaUrl: "",
        wallColor: hasImage ? (draft.wallColor || prev.wallColor || null) : null,
        contentMode: MOODBOARD_SLOT_CONTENT_MODES.IMAGE,
        weatherPayload: null,
        noteHeadline: prev.noteHeadline || "",
        noteBody: prev.noteBody || "",
      };
      return createMoodboardColumn(col.recipe, {
        images,
        ...columnTextPatch(col),
      });
    });
    setAttachmentSlot(null);
    setPendingLibraryPick(null);
    setError(null);
  };

  const clearImage = (colIndex, imageIndex) => {
    if (!isEdit) return;
    patchColumns((col, index) => {
      if (index !== colIndex) return col;
      const images = Array.isArray(col.images) ? [...col.images] : [];
      if (!images[imageIndex]) return col;
      const prev = images[imageIndex];
      const mode = normalizeMoodboardSlotContentMode(prev.contentMode);
      if (mode === MOODBOARD_SLOT_CONTENT_MODES.WEATHER) {
        // Filled weather → back to waiting placeholder (keep mode).
        images[imageIndex] = {
          ...emptySlot(),
          slotId: prev.slotId,
          contentMode: MOODBOARD_SLOT_CONTENT_MODES.WEATHER,
          weatherPayload: null,
          imageSaved: false,
        };
      } else {
        images[imageIndex] = {
          ...emptySlot(),
          slotId: prev.slotId,
          contentMode: prev.contentMode,
          noteHeadline: prev.noteHeadline,
          noteBody: prev.noteBody,
        };
      }
      return createMoodboardColumn(col.recipe, {
        images,
        ...columnTextPatch(col),
      });
    });
    setError(null);
  };

  const patchSlotFields = (colIndex, imageIndex, patch) => {
    if (!isEdit) return;
    patchColumns((col, index) => {
      if (index !== colIndex) return col;
      const images = Array.isArray(col.images) ? [...col.images] : [];
      const prev = images[imageIndex] || emptySlot();
      images[imageIndex] = { ...prev, ...patch };
      return createMoodboardColumn(col.recipe, {
        images,
        ...columnTextPatch(col),
      });
    });
  };

  const setSlotContentMode = (colIndex, imageIndex, mode) => {
    const next = normalizeMoodboardSlotContentMode(mode);
    if (next === MOODBOARD_SLOT_CONTENT_MODES.WEATHER) {
      patchSlotFields(colIndex, imageIndex, {
        contentMode: MOODBOARD_SLOT_CONTENT_MODES.WEATHER,
        weatherPayload: null,
        src: "",
        name: "",
        alt: "",
        width: 0,
        height: 0,
        libraryItemId: "",
        externalUrl: "",
        imageSaved: false,
        noteHeadline: "",
        noteBody: "",
      });
      return;
    }
    if (next === MOODBOARD_SLOT_CONTENT_MODES.NOTE) {
      patchSlotFields(colIndex, imageIndex, {
        contentMode: MOODBOARD_SLOT_CONTENT_MODES.NOTE,
        weatherPayload: null,
        src: "",
        libraryItemId: "",
        externalUrl: "",
        imageSaved: false,
      });
      return;
    }
    patchSlotFields(colIndex, imageIndex, {
      contentMode: MOODBOARD_SLOT_CONTENT_MODES.IMAGE,
      weatherPayload: null,
    });
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

  const canSave = savableContentCount > 0 && !uploadingKey;
  const attachmentImage = attachmentSlot
    ? (pendingLibraryPick
      || columns[attachmentSlot.colIndex]?.images?.[attachmentSlot.imageIndex]
      || emptySlot())
    : null;
  const attachmentFrameAspect = attachmentSlot
    ? moodboardSlotFrameAspect(
      boardLayout,
      attachmentSlot.sizeClass || "large",
      attachmentSlot.colIndex,
    )
    : "9:16";

  const librarySlotHasImage = Boolean(libraryPickerSlot && (() => {
    const img = columns[libraryPickerSlot.colIndex]?.images?.[libraryPickerSlot.imageIndex];
    if (!img) return false;
    return Boolean(
      img.imageSaved && (img.src || img.libraryItemId || normalizeMoodboardExternalUrl(img.externalUrl)),
    );
  })());

  const renderImageCell = (colIndex, imageIndex, sizeClass) => {
    const column = columns[colIndex] || createMoodboardColumn(null);
    const image = column.images?.[imageIndex] || emptySlot();
    const allowsNoteSwitch = sizeClass === "medium";
    const contentMode = normalizeMoodboardSlotContentMode(image.contentMode);
    const isWeatherSlot = allowsNoteSwitch
      && contentMode === MOODBOARD_SLOT_CONTENT_MODES.WEATHER;
    const isNoteSlot = allowsNoteSwitch
      && contentMode === MOODBOARD_SLOT_CONTENT_MODES.NOTE;
    const cellAspect = moodboardCellCssAspectRatio(boardLayout, sizeClass, colIndex);
    const slotFrameLabel = moodboardSlotFrameLabel(boardLayout, sizeClass, colIndex);

    if (isWeatherSlot) {
      const weatherPayload = normalizeMoodboardWeatherPayload(image.weatherPayload);
      const filled = Boolean(weatherPayload);
      return (
        <div className="doc-moodboard__cell-wrap">
          <div
            className={
              "doc-moodboard__cell doc-moodboard__cell--medium doc-moodboard__cell--weather"
              + (filled ? "" : " doc-moodboard__cell--empty doc-moodboard__cell--weather-placeholder")
            }
            data-mb-slot={image.slotId || undefined}
            style={boardExpanded ? { aspectRatio: cellAspect } : undefined}
          >
            {isEdit ? (
              <button
                type="button"
                className="doc-moodboard__slot-mode-btn"
                onClick={() => setSlotContentMode(
                  colIndex,
                  imageIndex,
                  MOODBOARD_SLOT_CONTENT_MODES.IMAGE,
                )}
                title={t("doc.moodboard.slotModeImage")}
              >
                {t("doc.moodboard.slotModeImage")}
              </button>
            ) : null}
            {filled ? (
              <>
                <div className="doc-moodboard__slot-weather">
                  <div className="doc-moodboard__slot-weather-panel">
                    <ForecastNodeView
                      payload={weatherPayload}
                      compact
                      className="doc-moodboard__slot-weather-body"
                    />
                  </div>
                </div>
                {isEdit ? (
                  <div className="doc-moodboard__media-actions">
                    <button
                      type="button"
                      className="doc-moodboard__media-btn"
                      onClick={() => clearImage(colIndex, imageIndex)}
                    >
                      {t("doc.imageBlock.remove")}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div
                className="doc-moodboard__slot-weather-placeholder"
                aria-label={t("doc.moodboard.slotWeatherWaiting")}
              >
                <div className="doc-moodboard__slot-weather-panel doc-moodboard__slot-weather-panel--placeholder">
                  <span className="doc-moodboard__slot-weather-title">
                    {t("doc.moodboard.slotModeWeather")}
                  </span>
                  <span className="doc-moodboard__slot-weather-hint">
                    {t("doc.moodboard.slotWeatherWaiting")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isNoteSlot) {
      const noteScale = resolveStickyNoteTextScale(image.noteBody);
      return (
        <div className="doc-moodboard__cell-wrap">
          <div
            className={
              "doc-moodboard__cell doc-moodboard__cell--medium doc-moodboard__cell--note"
              + ` is-scale-${noteScale}`
            }
            data-mb-slot={image.slotId || undefined}
            style={boardExpanded ? { aspectRatio: cellAspect } : undefined}
          >
            <div className="doc-moodboard__slot-note">
              <img
                className="doc-moodboard__slot-note-bg"
                src={MOODBOARD_NOTES_BG_SRC}
                alt=""
                draggable={false}
              />
              {isEdit ? (
                <button
                  type="button"
                  className="doc-moodboard__slot-mode-btn"
                  onClick={() => setSlotContentMode(
                    colIndex,
                    imageIndex,
                    MOODBOARD_SLOT_CONTENT_MODES.IMAGE,
                  )}
                  title={t("doc.moodboard.slotModeImage")}
                >
                  {t("doc.moodboard.slotModeImage")}
                </button>
              ) : null}
              {isEdit ? (
                <input
                  className="doc-moodboard__slot-note-headline"
                  type="text"
                  maxLength={MOODBOARD_SLOT_NOTE_HEADLINE_MAX}
                  value={image.noteHeadline || ""}
                  placeholder={t("doc.moodboard.slotNoteHeadlinePlaceholder")}
                  aria-label={t("doc.moodboard.slotNoteHeadlineLabel")}
                  spellCheck={false}
                  onChange={(event) => {
                    patchSlotFields(colIndex, imageIndex, {
                      noteHeadline: String(event.target.value ?? "")
                        .slice(0, MOODBOARD_SLOT_NOTE_HEADLINE_MAX),
                    });
                  }}
                />
              ) : (
                (image.noteHeadline || "").trim()
                  ? (
                    <div className="doc-moodboard__slot-note-headline doc-moodboard__slot-note-headline--static">
                      {image.noteHeadline}
                    </div>
                  )
                  : null
              )}
              {isEdit ? (
                <textarea
                  className="doc-moodboard__slot-note-body"
                  maxLength={MOODBOARD_SLOT_NOTE_BODY_MAX}
                  rows={4}
                  value={image.noteBody || ""}
                  placeholder={t("doc.moodboard.slotNoteBodyPlaceholder")}
                  aria-label={t("doc.moodboard.slotNoteBodyLabel")}
                  spellCheck={false}
                  onChange={(event) => {
                    patchSlotFields(colIndex, imageIndex, {
                      noteBody: String(event.target.value ?? "")
                        .slice(0, MOODBOARD_SLOT_NOTE_BODY_MAX),
                    });
                  }}
                />
              ) : (
                <div className="doc-moodboard__slot-note-body doc-moodboard__slot-note-body--static">
                  {image.noteBody || ""}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    const externalUrl = normalizeMoodboardExternalUrl(image.externalUrl);
    const libraryItem = findLibraryItemBySlot(image, libraryCatalogs);
    const presentation = resolveMoodboardSlotPresentation(image, libraryItem);
    const hasImage = Boolean(image.src) || Boolean(image.libraryItemId);
    const saved = Boolean(image.imageSaved && (hasImage || externalUrl));
    const displaySrc = hasImage
      ? (presentation.displaySrc || image.src)
      : (externalUrl ? MOODBOARD_FILE_ICON_SRC : "");
    const containPreview = hasImage && presentation.mode === "contain";
    const isFileIcon = saved && !hasImage && Boolean(externalUrl);
    const tagLabel = String(image.tagLabel || "").trim();
    const showTag = SHOW_MOODBOARD_SLOT_TAGS && Boolean(tagLabel && saved);
    const canEditLibrary = canPickLibrary && Boolean(findLibraryItemBySlot(image, libraryCatalogs));
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

    const modeSwitch = allowsNoteSwitch && isEdit ? (
      <div className="doc-moodboard__slot-mode-row">
        <button
          type="button"
          className="doc-moodboard__slot-mode-btn doc-moodboard__slot-mode-btn--on-image"
          onClick={(event) => {
            event.stopPropagation();
            setSlotContentMode(colIndex, imageIndex, MOODBOARD_SLOT_CONTENT_MODES.NOTE);
          }}
          title={t("doc.moodboard.slotModeNote")}
        >
          {t("doc.moodboard.slotModeNote")}
        </button>
        <button
          type="button"
          className="doc-moodboard__slot-mode-btn doc-moodboard__slot-mode-btn--on-image"
          onClick={(event) => {
            event.stopPropagation();
            setSlotContentMode(colIndex, imageIndex, MOODBOARD_SLOT_CONTENT_MODES.WEATHER);
          }}
          title={t("doc.moodboard.slotModeWeather")}
        >
          {t("doc.moodboard.slotModeWeather")}
        </button>
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
            + (containPreview ? " doc-moodboard__cell--preview" : "")
          }
          data-mb-slot={image.slotId || undefined}
          style={{
            // Inline: flex fills designed board height. Expand: lock publish aspect.
            ...(boardExpanded ? { aspectRatio: cellAspect } : {}),
            ...(containPreview && presentation.wallColor
              ? { backgroundColor: resolveWallColor(presentation.wallColor) }
              : {}),
          }}
        >
          {modeSwitch}
          {saved ? (
            <>
              <button
                type="button"
                className="doc-moodboard__cell-hit"
                aria-label={
                  canPickLibrary
                    ? t("doc.moodboard.libraryPickerTitle")
                    : t("doc.moodboard.attachTitle")
                }
                onClick={() => {
                  if (canPickLibrary) {
                    openLibraryPicker(colIndex, imageIndex, sizeClass);
                    return;
                  }
                  openAttachmentModal(colIndex, imageIndex, sizeClass);
                }}
              >
                <img
                  className={
                    "doc-moodboard__img"
                    + (isFileIcon ? " doc-moodboard__img--file" : "")
                    + (boardExpanded && !isFileIcon ? " doc-moodboard__img--contain" : "")
                    + (containPreview ? " doc-moodboard__img--contain" : "")
                  }
                  data-mb-slot-img={
                    !isFileIcon && image.slotId ? image.slotId : undefined
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
                  onLoad={() => {
                    if (!isFileIcon) refreshSlotAnchorRects();
                  }}
                />
              </button>
              {tagOverlay ? tagRow : null}
              {isEdit ? (
                <div className="doc-moodboard__media-actions">
                  {canPickLibrary ? (
                    <button
                      type="button"
                      className="doc-moodboard__media-btn"
                      onClick={() => openLibraryPicker(colIndex, imageIndex, sizeClass)}
                      disabled={Boolean(uploadingKey)}
                    >
                      {t("doc.imageBlock.replace")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="doc-moodboard__media-btn"
                      onClick={() => openAttachmentModal(colIndex, imageIndex, sizeClass)}
                      disabled={Boolean(uploadingKey)}
                    >
                      {t("doc.imageBlock.replace")}
                    </button>
                  )}
                  {canEditLibrary ? (
                    <button
                      type="button"
                      className="doc-moodboard__media-btn"
                      onClick={() => openEditLibraryFromSlot(colIndex, imageIndex, sizeClass)}
                      disabled={Boolean(uploadingKey)}
                    >
                      {t("doc.library.edit")}
                    </button>
                  ) : null}
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
            <div className="doc-moodboard__empty-slot">
              <button
                type="button"
                className="doc-moodboard__ratio-ref"
                disabled={!isEdit || !canPickLibrary}
                title={
                  canPickLibrary
                    ? t("doc.moodboard.ratioCardHint")
                    : t("doc.moodboard.libraryRequired")
                }
                onClick={() => {
                  if (!isEdit || !canPickLibrary) return;
                  openLibraryPicker(colIndex, imageIndex, sizeClass);
                }}
              >
                <span className="doc-moodboard__ratio-ref-label">{slotFrameLabel}</span>
                <span className="doc-moodboard__ratio-ref-hint">
                  {t("doc.moodboard.ratioCardHint")}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderColumn = (colIndex) => {
    const column = columns[colIndex] || createMoodboardColumn(null);
    const recipe = column.recipe;
    const isActive = activeCol === colIndex;
    const colRecipes = recipeOptionsForColumn(boardLayout, colIndex);
    const notesIntegratedView = recipe === MOODBOARD_RECIPES.MEDIUM_STICKY
      && moodboardNotesUseIntegratedView(column, isEdit);
    const showColClear = isEdit && (
      recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY || !notesIntegratedView
    );

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
              {colRecipes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="doc-moodboard__recipe-btn"
                  disabled={!isEdit}
                  onClick={() => setColumnRecipe(colIndex, option.id)}
                  aria-label={t(option.labelKey)}
                  title={t(option.labelKey)}
                >
                  <span
                    className="doc-moodboard__recipe-btn-icon-clip"
                    style={{ width: option.iconClipPx }}
                  >
                    <img
                      className="doc-moodboard__recipe-btn-icon"
                      src={option.iconSrc}
                      alt=""
                      aria-hidden
                      draggable={false}
                    />
                  </span>
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

        {recipe === MOODBOARD_RECIPES.MEDIUM_STICKY ? (
          <div className="doc-moodboard__recipe doc-moodboard__recipe--medium-sticky">
            {(() => {
              const notesEmpty = isMoodboardStickyEmpty(column);
              const calendarWireOn = Boolean(column.calendarWireEnabled);
              const calendarWireWaiting = calendarWireOn && notesEmpty;
              const notesEditChrome = isEdit && !notesIntegratedView;
              return (
            <div
              className={
                "doc-moodboard__notes"
                + (notesEditChrome ? " doc-moodboard__notes--edit" : "")
                + (calendarWireWaiting ? " doc-moodboard__notes--wire-waiting" : "")
                + (
                  normalizeMoodboardNoteStyle(column.noteStyle)
                    === MOODBOARD_NOTE_STYLES.INTER
                    ? " is-style-inter"
                    : " is-style-marker"
                )
              }
            >
              <img
                className="doc-moodboard__notes-bg"
                src={MOODBOARD_NOTES_BG_SRC}
                alt=""
                draggable={false}
              />
              {isEdit && notesEmpty ? (
                <div
                  className="doc-moodboard__notes-wire-toggle"
                  role="group"
                  aria-label={t("doc.moodboard.calendarWireToggle")}
                >
                  <button
                    type="button"
                    className={
                      "doc-moodboard__notes-wire-btn"
                      + (calendarWireOn ? " is-active" : "")
                      + (!notesEmpty ? " is-disabled" : "")
                    }
                    aria-pressed={calendarWireOn}
                    disabled={!notesEmpty}
                    title={
                      !notesEmpty
                        ? t("doc.moodboard.calendarWireToggleDisabled")
                        : t("doc.moodboard.calendarWireToggle")
                    }
                    onClick={() => {
                      if (!notesEmpty) return;
                      patchColumns((col, index) => (
                        index === colIndex
                          ? createMoodboardColumn(col.recipe, {
                            images: col.images,
                            ...columnTextPatch(col),
                            calendarWireEnabled: !calendarWireOn,
                          })
                          : col
                      ));
                    }}
                  >
                    <img
                      className="doc-moodboard__notes-wire-icon"
                      src={CALENDAR_WIRE_ICON_SRC}
                      alt=""
                      aria-hidden
                      draggable={false}
                    />
                    <span>{t("doc.moodboard.calendarWireToggle")}</span>
                  </button>
                </div>
              ) : null}
              <div className="doc-moodboard__notes-title-wrap">
                {notesIntegratedView && !calendarWireWaiting ? (
                  <div className="doc-moodboard__notes-title doc-moodboard__notes-title--static">
                    {(column.stickyTitle || "").trim() || MOODBOARD_NOTES_TITLE_DEFAULT}
                  </div>
                ) : notesEditChrome && !calendarWireWaiting ? (
                  <input
                    className="doc-moodboard__notes-title"
                    type="text"
                    maxLength={MOODBOARD_STICKY_TITLE_MAX}
                    value={column.stickyTitle || ""}
                    placeholder={MOODBOARD_NOTES_TITLE_DEFAULT}
                    aria-label={t("doc.moodboard.notesTitleLabel")}
                    spellCheck={false}
                    onChange={(event) => {
                      const next = String(event.target.value ?? "")
                        .slice(0, MOODBOARD_STICKY_TITLE_MAX);
                      patchColumns((col, index) => (
                        index === colIndex
                          ? createMoodboardColumn(col.recipe, {
                            images: col.images,
                            ...columnTextPatch(col),
                            stickyTitle: next,
                          })
                          : col
                      ));
                    }}
                  />
                ) : (
                  <div className="doc-moodboard__notes-title doc-moodboard__notes-title--static">
                    {MOODBOARD_NOTES_TITLE_DEFAULT}
                  </div>
                )}
              </div>
              {isEdit && calendarWireWaiting ? (
                <div className="doc-moodboard__notes-wire-hint" role="status">
                  <span className="doc-moodboard__notes-wire-hint-title">
                    {t("doc.moodboard.calendarWireToggle")}
                  </span>
                  <span className="doc-moodboard__notes-wire-hint-body">
                    {t("doc.moodboard.calendarWireHint")}
                  </span>
                </div>
              ) : null}
              {notesIntegratedView && !calendarWireWaiting ? (
                <MoodboardNotesBodyStatic
                  text={column.stickyText || ""}
                  title={column.stickyTitle || ""}
                />
              ) : notesEditChrome && !calendarWireWaiting ? (
                <textarea
                  className="doc-moodboard__notes-body"
                  maxLength={MOODBOARD_NOTES_BODY_MAX}
                  rows={12}
                  value={column.stickyText || ""}
                  placeholder={t("doc.moodboard.stickyPlaceholder")}
                  aria-label={t("doc.moodboard.stickyLabel")}
                  spellCheck={false}
                  onChange={(event) => {
                    const next = clampNotesText(event.target, event.target.value);
                    patchColumns((col, index) => (
                      index === colIndex
                        ? createMoodboardColumn(col.recipe, {
                          images: col.images,
                          ...columnTextPatch(col),
                          stickyText: next,
                        })
                        : col
                    ));
                  }}
                />
              ) : null}
            </div>
              );
            })()}
          </div>
        ) : null}

        {recipe && showColClear ? (
          <button
            type="button"
            className="doc-moodboard__col-clear"
            onClick={() => (
              recipe === MOODBOARD_RECIPES.MEDIUM_STICKY
                ? clearNotesContent(colIndex)
                : clearColumn(colIndex)
            )}
            aria-label={
              recipe === MOODBOARD_RECIPES.MEDIUM_STICKY
                ? t("doc.moodboard.clearNotes")
                : t("doc.moodboard.clearColumn")
            }
            title={
              recipe === MOODBOARD_RECIPES.MEDIUM_STICKY
                ? t("doc.moodboard.clearNotes")
                : t("doc.moodboard.clearColumn")
            }
          >
            <img
              className="doc-moodboard__col-clear-icon"
              src={NOTES_CLEAR_SRC}
              alt=""
              aria-hidden
              draggable={false}
            />
          </button>
        ) : null}
      </div>
    );
  };

  const moodboardTree = (
    <div
      className={
        "doc-moodboard"
        + (moodboardSaved ? " doc-moodboard--saved" : "")
        + (boardExpanded ? " doc-moodboard--expanded" : "")
        + (focusWriteMode ? " doc-moodboard--focus-write" : "")
      }
    >
      {isEdit ? (
        <div className="doc-moodboard__toolbar" role="toolbar" aria-label={t("doc.moodboard.toolbarLabel")}>
          <div className="doc-moodboard__toolbar-group">
            <span className="doc-moodboard__toolbar-hint">{t("doc.moodboard.layoutLabel")}</span>
            <div className="doc-moodboard__toolbar-actions" role="group" aria-label={t("doc.moodboard.layoutLabel")}>
              {LAYOUT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    "doc-moodboard__toolbar-btn doc-moodboard__toolbar-btn--layout"
                    + (option.showFullLabel ? " doc-moodboard__toolbar-btn--layout-full" : "")
                    + (boardLayout === option.id ? " doc-moodboard__toolbar-btn--active" : "")
                  }
                  onClick={() => setBoardLayout(option.id)}
                  aria-label={t(option.labelKey)}
                  title={t(option.labelKey)}
                >
                  <img
                    className="doc-moodboard__toolbar-layout-icon"
                    src={option.iconSrc}
                    alt=""
                    aria-hidden
                    draggable={false}
                  />
                  {option.showFullLabel ? (
                    <span className="doc-moodboard__toolbar-layout-full">full</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="doc-moodboard__toolbar-group">
            <span className="doc-moodboard__toolbar-hint">{t("doc.moodboard.surfaceLabel")}</span>
            <div className="doc-moodboard__toolbar-actions" role="group" aria-label={t("doc.moodboard.surfaceLabel")}>
              <button
                type="button"
                className={
                  "doc-moodboard__toolbar-btn"
                  + (boardSurface === MOODBOARD_BOARD_SURFACES.SOLID
                    ? " doc-moodboard__toolbar-btn--active"
                    : "")
                }
                onClick={() => setBoardSurface(MOODBOARD_BOARD_SURFACES.SOLID)}
              >
                {t("doc.moodboard.surfaceSolid")}
              </button>
              <button
                type="button"
                className={
                  "doc-moodboard__toolbar-btn"
                  + (boardSurface === MOODBOARD_BOARD_SURFACES.TRANSPARENT
                    ? " doc-moodboard__toolbar-btn--active"
                    : "")
                }
                onClick={() => setBoardSurface(MOODBOARD_BOARD_SURFACES.TRANSPARENT)}
              >
                {t("doc.moodboard.surfaceTransparent")}
              </button>
            </div>
          </div>
          <div className="doc-moodboard__toolbar-group">
            <span className="doc-moodboard__toolbar-hint">{t("doc.moodboard.focusWriteMode")}</span>
            <div
              className="doc-moodboard__toolbar-actions"
              role="group"
              aria-label={t("doc.moodboard.focusWriteMode")}
            >
              <button
                type="button"
                className={
                  "doc-moodboard__toolbar-btn"
                  + (focusWriteMode ? " doc-moodboard__toolbar-btn--active" : "")
                }
                aria-pressed={focusWriteMode}
                title={t("doc.moodboard.focusWriteModeHint")}
                onClick={() => {
                  setFocusWriteMode((prev) => {
                    const next = !prev;
                    if (next) {
                      setPendingOverlayKind(null);
                      setSelectedOverlayId(null);
                    }
                    return next;
                  });
                }}
              >
                {t("doc.moodboard.focusWriteMode")}
              </button>
            </div>
          </div>
          <div className="doc-moodboard__toolbar-group">
            <span className="doc-moodboard__toolbar-hint">
              {t("doc.moodboard.toolbarHint")}
            </span>
            <div className="doc-moodboard__toolbar-actions" role="group" aria-label={t("doc.moodboard.toolbarHint")}>
              {recipeOptionsForColumn(boardLayout, activeCol).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    "doc-moodboard__toolbar-btn doc-moodboard__toolbar-btn--recipe"
                    + (columns[activeCol]?.recipe === option.id
                      ? " doc-moodboard__toolbar-btn--active"
                      : "")
                  }
                  onClick={() => setColumnRecipe(activeCol, option.id)}
                  aria-label={t(option.labelKey)}
                  title={t(option.labelKey)}
                >
                  <span
                    className="doc-moodboard__toolbar-recipe-icon-clip"
                    style={{ width: option.iconClipPx }}
                  >
                    <img
                      className="doc-moodboard__toolbar-recipe-icon"
                      src={option.iconSrc}
                      alt=""
                      aria-hidden
                      draggable={false}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="doc-moodboard__board-wrap">
        <button
          type="button"
          className={
            "doc-moodboard__expand-btn"
            + (boardExpanded ? " doc-moodboard__expand-btn--collapse" : "")
          }
          onClick={() => setBoardExpanded((prev) => !prev)}
          aria-pressed={boardExpanded}
          aria-label={
            boardExpanded
              ? t("doc.moodboard.collapse")
              : t("doc.moodboard.expand")
          }
          title={
            boardExpanded
              ? t("doc.moodboard.collapse")
              : t("doc.moodboard.expand")
          }
        >
          <img
            className="doc-moodboard__expand-btn-icon"
            src={EXPAND_ALL_SRC}
            alt=""
            aria-hidden
            draggable={false}
          />
        </button>

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
                className={
                  "doc-moodboard__overlay-rail-btn"
                  + (pendingOverlayKind === item.kind
                    ? " doc-moodboard__overlay-rail-btn--active"
                    : "")
                }
                title={t(item.labelKey)}
                aria-label={t(item.labelKey)}
                aria-pressed={pendingOverlayKind === item.kind}
                onClick={() => {
                  setPendingOverlayKind((prev) => (
                    prev === item.kind ? null : item.kind
                  ));
                }}
              >
                {item.kind === MOODBOARD_OVERLAY_KINDS.POINTER ? (
                  <OverlayPointerRailIcon />
                ) : (
                  <img
                    src={MOODBOARD_OVERLAY_SRC[item.kind]}
                    alt=""
                    draggable={false}
                  />
                )}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={
            "doc-moodboard__board"
            + ` doc-moodboard__board--${boardLayout}`
            + ` doc-moodboard__board--surface-${boardSurface}`
            + (pendingOverlayKind ? " doc-moodboard__board--place-overlay" : "")
          }
          ref={boardRef}
          style={boardHeight ? { height: boardHeight, minHeight: boardHeight } : undefined}
          onPointerDownCapture={(event) => {
            if (!isEdit || !pendingOverlayKind || event.button !== 0) return;
            // Capture so placement wins over cell hit-targets / tag rows.
            if (event.target?.closest?.(".doc-moodboard__overlay")) return;
            if (event.target?.closest?.(".doc-moodboard__overlay-rail")) return;
            event.preventDefault();
            event.stopPropagation();
            addOverlayAt(pendingOverlayKind, event.clientX, event.clientY);
          }}
          onMouseDown={(event) => {
            if (!isEdit) return;
            if (pendingOverlayKind) return;
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
                const isPointer = overlay.kind === MOODBOARD_OVERLAY_KINDS.POINTER;
                const boardPos = resolveOverlayBoardPosition(overlay, slotAnchorRects);
                // Anchored overlay waiting for slot measure — never paint image-% as board %.
                if (boardPos.pending) return null;
                const viewOverlay = {
                  ...overlay,
                  xPct: boardPos.xPct,
                  yPct: boardPos.yPct,
                  endXPct: boardPos.endXPct,
                  endYPct: boardPos.endYPct,
                };

                if (isPointer) {
                  const sizePx = MOODBOARD_OVERLAY_SIZE_PX[overlay.kind] || 78;
                  const contrast = normalizeMoodboardPointerContrast(overlay.contrast);
                  const stroke = resolveOverlayStroke(contrast);
                  const arrow = pointerArrowGeometry(
                    viewOverlay,
                    boardSize.w,
                    boardSize.h || boardHeight || 0,
                  );
                  return (
                    <div
                      key={overlay.id}
                      className={
                        "doc-moodboard__overlay doc-moodboard__overlay--pointer"
                        + (contrast === MOODBOARD_POINTER_CONTRAST.LIGHT
                          ? " doc-moodboard__overlay--pointer-light"
                          : "")
                        + (contrast === MOODBOARD_POINTER_CONTRAST.SKY
                          ? " doc-moodboard__overlay--pointer-sky"
                          : "")
                        + (selected ? " doc-moodboard__overlay--selected" : "")
                        + (isEdit ? " doc-moodboard__overlay--draggable" : "")
                      }
                      style={{ "--mb-overlay-stroke": stroke }}
                    >
                      {(boardSize.w > 0 && (boardSize.h > 0 || boardHeight > 0)) ? (
                        <svg
                          className="doc-moodboard__overlay-pointer-svg"
                          width={boardSize.w}
                          height={boardSize.h || boardHeight || 0}
                          aria-hidden="true"
                          focusable="false"
                        >
                          {arrow ? (
                            <>
                              <line
                                x1={arrow.x1}
                                y1={arrow.y1}
                                x2={arrow.x2}
                                y2={arrow.y2}
                                stroke={stroke}
                                strokeWidth="1.5"
                                strokeDasharray={POINTER_DASH}
                                strokeLinecap="round"
                              />
                              <circle
                                cx={arrow.tipX}
                                cy={arrow.tipY}
                                r={arrow.tipR}
                                fill={stroke}
                                stroke="none"
                              />
                            </>
                          ) : null}
                        </svg>
                      ) : null}
                      <div
                        className="doc-moodboard__overlay-pointer-circle"
                        style={{
                          left: `${viewOverlay.xPct}%`,
                          top: `${viewOverlay.yPct}%`,
                          width: `${sizePx}px`,
                          height: `${sizePx}px`,
                        }}
                        onPointerDown={(event) => startPointerBodyDrag(event, overlay)}
                      />
                      {isEdit ? (
                        <button
                          type="button"
                          className="doc-moodboard__overlay-pointer-tip"
                          aria-label={t("doc.moodboard.overlayPointer")}
                          style={{
                            left: `${viewOverlay.endXPct}%`,
                            top: `${viewOverlay.endYPct}%`,
                          }}
                          onPointerDown={(event) => startPointerTipDrag(event, overlay)}
                        />
                      ) : null}
                      {selected ? (
                        <>
                          {renderOverlayContrastPicker(overlay, {
                            left: `${viewOverlay.xPct}%`,
                            top: `calc(${viewOverlay.yPct}% + ${sizePx / 2 + 10}px)`,
                          })}
                          <button
                            type="button"
                            className="doc-moodboard__overlay-delete doc-moodboard__overlay-delete--pointer"
                            style={{
                              left: `calc(${viewOverlay.xPct}% + ${sizePx / 2 - 6}px)`,
                              top: `calc(${viewOverlay.yPct}% - ${sizePx / 2 + 2}px)`,
                            }}
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
                        </>
                      ) : null}
                    </div>
                  );
                }

                const src = MOODBOARD_OVERLAY_SRC[overlay.kind];
                if (!src) return null;
                const sizePx = MOODBOARD_OVERLAY_SIZE_PX[overlay.kind] || 44;
                const contrast = normalizeMoodboardPointerContrast(overlay.contrast);
                const stroke = resolveOverlayStroke(contrast);
                const isShape = overlay.kind === MOODBOARD_OVERLAY_KINDS.CIRCLE
                  || overlay.kind === MOODBOARD_OVERLAY_KINDS.ELLIPSE;
                return (
                  <div
                    key={overlay.id}
                    className={
                      "doc-moodboard__overlay"
                      + (selected ? " doc-moodboard__overlay--selected" : "")
                      + (isEdit ? " doc-moodboard__overlay--draggable" : "")
                      + (isShape ? ` doc-moodboard__overlay--${overlay.kind}` : "")
                    }
                    style={{
                      left: `${viewOverlay.xPct}%`,
                      top: `${viewOverlay.yPct}%`,
                      width: `${sizePx}px`,
                      "--mb-overlay-stroke": stroke,
                    }}
                    onPointerDown={(event) => startOverlayDrag(event, overlay)}
                  >
                    <div className="doc-moodboard__overlay-glyph">
                      <img
                        className="doc-moodboard__overlay-img doc-moodboard__overlay-img--ghost"
                        src={src}
                        alt=""
                        draggable={false}
                      />
                      <span
                        className="doc-moodboard__overlay-img-tint"
                        style={{
                          WebkitMaskImage: `url(${src})`,
                          maskImage: `url(${src})`,
                        }}
                        aria-hidden
                      />
                    </div>
                    {selected ? (
                      <>
                        {renderOverlayContrastPicker(overlay, {
                          left: "50%",
                          top: "calc(100% + 8px)",
                        })}
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
                      </>
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

          <div className="doc-card-float-actions doc-card-float-actions--end">
            <div className="doc-card-float-actions__group">
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
                  {t("doc.moodboard.save")}
                </button>
              ) : (
                <button
                  type="button"
                  className="doc-card-float-btn"
                  onClick={() => onEdit?.()}
                >
                  {t("doc.moodboard.edit")}
                </button>
              )}
              {onDelete ? (
                <button
                  type="button"
                  className="doc-card-float-btn"
                  onClick={() => onDelete()}
                >
                  {t("doc.imageBlock.remove")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <MoodboardAttachmentModal
        open={Boolean(attachmentSlot)}
        image={attachmentImage}
        readOnly={!isEdit}
        tagOnly={Boolean(pendingLibraryPick)}
        frameAspect={attachmentFrameAspect}
        canPickLibrary={canPickLibrary}
        libraryCatalogs={libraryCatalogs}
        onRequestLibrary={() => {
          if (!attachmentSlot) return;
          const { colIndex, imageIndex, sizeClass } = attachmentSlot;
          setAttachmentSlot(null);
          openLibraryPicker(colIndex, imageIndex, sizeClass || "large");
        }}
        onClose={() => {
          setAttachmentSlot(null);
          setPendingLibraryPick(null);
        }}
        onAccept={acceptAttachment}
      />

      {libraryPickerSlot ? (
        <LibraryImageCardPicker
          layout="segmentedStrip"
          folderId={pickerFolderId}
          documentId={pickerDocumentId}
          requireVisual
          titleKey="doc.moodboard.libraryPickerTitle"
          emptyKey="doc.moodboard.libraryPickerEmpty"
          onPick={handlePickLibraryItem}
          onNext={goAttachFromLibrary}
          nextLabelKey="doc.moodboard.libraryNext"
          nextEnabled={librarySlotHasImage || Boolean(pendingLibraryPick)}
          allowPrimaryCreate={Boolean(pickerPrimaryId)}
          onPrimaryCreateClick={openCreateLibraryFromPicker}
          onClose={() => {
            setLibraryPickerSlot(null);
            setPendingLibraryPick(null);
            closeCreateLibraryModal();
          }}
        />
      ) : null}

      <input
        ref={createFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleCreateLibraryFile}
      />

      {createLibraryModalOpen && pickerPrimaryId ? (
        <FolderLibraryElementModal
          folderId={pickerFolderId || pickerPrimaryId}
          ownerKind={pickerPrimaryKind}
          ownerId={pickerPrimaryId}
          defaultCategory="image"
          lockCategory
          defaultPresentation="visual"
          initialMediaUrl={createLibraryMediaUrl}
          defaultFrameAspect={createLibraryFrameAspect}
          overlayClassName="folder-library-element-overlay--above-picker"
          onClose={closeCreateLibraryModal}
          onSaved={handleCreateLibrarySaved}
        />
      ) : null}

      {editLibrarySlot ? (() => {
        const slotImage = columns[editLibrarySlot.colIndex]?.images?.[editLibrarySlot.imageIndex];
        const editingItem = findLibraryItemBySlot(slotImage, libraryCatalogs);
        if (!editingItem) return null;
        const ownerKind = String(slotImage?.libraryOwnerKind || "").trim() || pickerPrimaryKind;
        const ownerId = String(slotImage?.libraryOwnerId || "").trim()
          || (ownerKind === "folder" ? pickerFolderId : pickerDocumentId);
        return (
          <FolderLibraryElementModal
            folderId={pickerFolderId || ownerId}
            ownerKind={ownerKind}
            ownerId={ownerId}
            item={editingItem}
            onClose={() => setEditLibrarySlot(null)}
            onSaved={handleEditLibrarySaved}
          />
        );
      })() : null}

      {error ? <p className="doc-moodboard__error" role="alert">{error}</p> : null}
    </div>
  );

  if (!boardExpanded) return moodboardTree;

  return (
    <>
      <div className="doc-moodboard doc-moodboard--workspace-stub">
        <span className="doc-moodboard__workspace-stub-label">
          {t("doc.moodboard.workspaceOpen")}
        </span>
        <button
          type="button"
          className="doc-moodboard__expand-btn doc-moodboard__expand-btn--stub"
          onClick={() => setBoardExpanded(false)}
        >
          {t("doc.moodboard.collapse")}
        </button>
      </div>
      {createPortal(
        <div
          className={
            "doc-moodboard-workspace"
            + (boardSurface === MOODBOARD_BOARD_SURFACES.TRANSPARENT
              ? " doc-moodboard-workspace--surface-transparent"
              : "")
          }
          role="dialog"
          aria-modal="true"
          aria-label={t("doc.moodboard.workspaceTitle")}
          onClick={() => setBoardExpanded(false)}
        >
          <div
            ref={workspaceBodyRef}
            className="doc-moodboard-workspace__body"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="doc-moodboard-workspace__float-actions">
              <button
                type="button"
                className="doc-moodboard-workspace__expand"
                onClick={() => setBoardExpanded(false)}
                aria-label={t("doc.moodboard.collapse")}
                title={t("doc.moodboard.collapse")}
              >
                <img
                  className="doc-moodboard-workspace__expand-icon"
                  src={EXPAND_ALL_SRC}
                  alt=""
                  aria-hidden
                  draggable={false}
                />
              </button>
              <button
                type="button"
                className="doc-moodboard-workspace__close"
                onClick={() => setBoardExpanded(false)}
                aria-label={t("doc.moodboard.collapse")}
                title={t("doc.moodboard.collapse")}
              >
                ×
              </button>
            </div>
            {moodboardTree}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
