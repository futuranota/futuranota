import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOC_SLASH_GHOST_HINTS, getSlashTail, splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import {
  applyTextEditToMentions,
  getMentionQueryAtCaret,
  insertMentionAtQuery,
  normalizeMentions,
} from "../../../lib/docMentions.js";
import {
  applyTextEditToTagRefs,
  deleteTagRefAtomically,
  filterTagRefCandidates,
  getTagRefQueryAtCaret,
  insertTagRefAtQuery,
  isTagRefAloneOnLine,
  normalizeTagRefs,
  removeTagRefById,
  resolveTagRefThumbSrc,
  scrollToMoodboardSlot,
  snapCaretOutOfTagRefBoxFootprint,
  TAGREF_BOX_HEIGHT_PX,
  TAGREF_BOX_WIDTH_PX,
} from "../../../lib/docTagRefs.js";
import {
  applyTextEditToMarkerRanges,
  normalizeMarkerRanges,
} from "../../../lib/docTextMarkerRanges.js";
import {
  applyTextEditToBoldRanges,
  computeTextEditDelta,
  normalizeBoldRanges,
} from "../../../lib/docTextBoldRanges.js";
import { markerStrokeSeed } from "../../../lib/docTextMarkerColors.js";
import { buildMirrorSegments } from "../../../lib/docTextMirrorSegments.js";
import {
  applyTextEditToLibraryNameRefs,
  filterLibraryNameCandidates,
  getLibraryNameQueryAtCaret,
  insertLibraryNameRefAtQuery,
  normalizeLibraryNameRefs,
  normalizeLibraryNameKey,
} from "../../../lib/docLibraryNameRefs.js";
import {
  applyTextEditToLibrarySpeakRefs,
  getLibrarySpeakPathAtCaret,
  normalizeLibrarySpeakRefs,
  openLibrarySpeakQuotes,
  refreshSpeakDialogueBounds,
} from "../../../lib/docLibrarySpeakRefs.js";
import { generateId } from "../../../lib/ids.js";
import {
  getLibraryAssignPathAtCaret,
  libraryAssignMenuEmptyReason,
  listLibraryAssignMenuItems,
  replaceLibraryAssignPathToken,
} from "../../../lib/libraryAssignPath.js";
import { filterTagCandidates } from "../../../lib/urlTableTags.js";
import { useI18n } from "../../../i18n/useI18n.js";
import {
  copyTextareaTypography,
  getCaretClientRect,
  resolveFloatingMenuAnchor,
  resolveSlashGhostOverlayPosition,
  scrollTextareaCaretIntoCameraView,
  withPreservedWritingScroll,
} from "../../../lib/textareaSelectionRect.js";
import { DocMentionHoverCard } from "./DocMentionHoverCard.jsx";
import { DocMentionMenu } from "./DocMentionMenu.jsx";
import { DocLibraryNameMenu } from "./DocLibraryNameMenu.jsx";
import { DocTagCommandPicker } from "./DocTagCommandPicker.jsx";
import { AtToolCommandPicker } from "./AtToolCommandPicker.jsx";
import { DocTagRefMenu } from "./DocTagRefMenu.jsx";

const CARET_CAMERA_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function buildFloatingMenuAnchor(caretRect, lineHeight) {
  return {
    ...resolveFloatingMenuAnchor(caretRect),
    lineHeight,
  };
}

function collapseDuplicateSlashTail(value) {
  const tail = getSlashTail(value);
  if (!tail || !tail.startsWith("//")) return value;
  const { prefix } = splitBodyForSlash(value);
  const fixedTail = "/" + tail.replace(/^\/+/, "");
  return prefix + fixedTail;
}

function MirrorContent({
  text,
  mentions,
  tagRefs,
  libraryNameRefs,
  markerRanges,
  boldRanges,
  tagRefCandidates = null,
  hoveredMentionId = null,
  hoveredTagRefId = null,
  onDeleteTagRef = null,
}) {
  const segments = buildMirrorSegments(
    text,
    mentions,
    markerRanges,
    boldRanges,
    tagRefs,
    libraryNameRefs,
  );
  return segments.map((segment, index) => {
    if (!segment.text) return null;

    // Clicks are resolved by rect hit-testing on the wrap (works focused
    // and blurred); the span itself carries no handlers.
    let inner = segment.text;

    if (segment.tagRef) {
      const alone = isTagRefAloneOnLine(text, segment.tagRef.start, segment.tagRef.end);
      const thumbSrc = alone
        ? resolveTagRefThumbSrc(segment.tagRef, tagRefCandidates)
        : "";
      const showBox = alone && Boolean(thumbSrc);
      const boxHovered = Boolean(
        showBox && hoveredTagRefId && segment.tagRef.id === hoveredTagRefId,
      );
      inner = (
        <span
          className={
            "doc-slash-field__tagref"
            + (showBox ? " doc-slash-field__tagref--box" : "")
            + (hoveredTagRefId && segment.tagRef.id === hoveredTagRefId
              ? " doc-slash-field__tagref--hovered"
              : "")
          }
          data-tagref-id={segment.tagRef.id}
          data-tagref-box={showBox ? "1" : undefined}
        >
          {showBox ? (
            <>
              <span
                className="doc-slash-field__tagref-box-frame"
                data-tagref-box-frame="1"
                style={{
                  width: TAGREF_BOX_WIDTH_PX,
                  height: TAGREF_BOX_HEIGHT_PX,
                }}
              >
                <img
                  className="doc-slash-field__tagref-box-img"
                  src={thumbSrc}
                  alt=""
                  draggable={false}
                  width={TAGREF_BOX_WIDTH_PX}
                  height={TAGREF_BOX_HEIGHT_PX}
                />
                <button
                  type="button"
                  className={
                    "doc-slash-field__tagref-box-close"
                    + (boxHovered ? " is-visible" : "")
                  }
                  aria-label="Remove moodboard tag"
                  tabIndex={-1}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteTagRef?.(segment.tagRef.id);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteTagRef?.(segment.tagRef.id);
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  ×
                </button>
              </span>
              <span className="doc-slash-field__tagref-box-label">{segment.text}</span>
            </>
          ) : (
            segment.text
          )}
        </span>
      );
    } else if (segment.mention) {
      inner = (
        <span
          className={
            "doc-slash-field__mention"
            + (hoveredMentionId && segment.mention.id === hoveredMentionId
              ? " doc-slash-field__mention--hovered"
              : "")
          }
          data-mention-id={segment.mention.id}
        >
          {segment.text}
        </span>
      );
    } else if (segment.libraryNameRef) {
      inner = (
        <span
          className="doc-slash-field__library-name"
          data-library-name-id={segment.libraryNameRef.id}
        >
          {segment.text}
        </span>
      );
    }

    // Faux-bold: paint weight via shadow only — never font-weight (metrics).
    if (segment.bold) {
      inner = <span className="doc-text-bold">{inner}</span>;
    }

    if (segment.marker) {
      const marker = segment.marker;
      return (
        <span
          key={index}
          className={
            "doc-text-marker"
            + ` doc-text-marker--${marker.colorId}`
            + ` doc-text-marker--seed${markerStrokeSeed(marker)}`
          }
        >
          {inner}
        </span>
      );
    }

    if (segment.tagRef || segment.mention || segment.bold) {
      return <span key={segment.tagRef?.id || segment.mention?.id || index}>{inner}</span>;
    }
    return <span key={index}>{inner}</span>;
  });
}

/**
 * Textarea for slash commands at end of a line.
 * Optional company @tag mentions: autocomplete + pink mirror + hover card.
 * Optional marker (highlighter) ranges: plumón ink painted in the mirror.
 * Optional bold ranges: faux-bold in the mirror (no font-weight metric shift).
 */
export function SlashAwareTextarea({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
  onPaste,
  placeholder,
  className = "",
  wrapClassName = "",
  autoFocus = false,
  showPlaceholder = true,
  minHeightPx = 20,
  maxHeightPx = 120,
  inputRef: externalRef,
  ariaLabel,
  onAfterInput,
  ghostHints = DOC_SLASH_GHOST_HINTS,
  mentions = null,
  onMentionsChange = null,
  mentionCandidates = null,
  /** Company id for @ URL-table mentions (DocTagCommandPicker). */
  companyObjectId = null,
  tagRefs = null,
  onTagRefsChange = null,
  tagRefCandidates = null,
  markerRanges = null,
  boldRanges = null,
  libraryNameRefs = null,
  onLibraryNameRefsChange = null,
  librarySpeakRefs = null,
  onLibrarySpeakRefsChange = null,
  libraryNameCandidates = null,
  libraryAssignFiles = null,
  libraryAssignAssets = null,
  onLibraryAssignSelect = null,
  canInsertLibraryNameRef = null,
  onAfterPaste = null,
  qloopCandidates = null,
  docBlocksForQLoop = null,
  onInsertQLoopQuery = null,
  qloopPickerForceOpen = false,
  onQloopPickerForceClose = null,
}) {
  const { t } = useI18n();
  const internalRef = useRef(null);
  const wrapRef = useRef(null);
  const mirrorRef = useRef(null);
  // Internal reads always go through internalRef: `externalRef` may be a
  // callback ref (e.g. NodeWritingBlockStack), which has no `.current`.
  const textareaRef = externalRef && typeof externalRef !== "function"
    ? externalRef
    : internalRef;
  const attachTextareaRef = useCallback((node) => {
    internalRef.current = node;
    if (typeof externalRef === "function") {
      externalRef(node);
    } else if (externalRef) {
      externalRef.current = node;
    }
  }, [externalRef]);
  const caretCameraRafRef = useRef(null);
  const activeQueryRef = useRef(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [ghostPos, setGhostPos] = useState(null);
  const [focused, setFocused] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [forcedQloopPicker, setForcedQloopPicker] = useState(false);
  const [activeQuery, setActiveQuery] = useState(null);
  const [tagRefMenuIndex, setTagRefMenuIndex] = useState(0);
  const [tagRefMenuAnchor, setTagRefMenuAnchor] = useState(null);
  const [activeTagRefQuery, setActiveTagRefQuery] = useState(null);
  const [libraryNameMenuIndex, setLibraryNameMenuIndex] = useState(0);
  const [libraryNameMenuAnchor, setLibraryNameMenuAnchor] = useState(null);
  const [activeLibraryNameQuery, setActiveLibraryNameQuery] = useState(null);
  const [assignPathMenuIndex, setAssignPathMenuIndex] = useState(0);
  const [assignPathMenuAnchor, setAssignPathMenuAnchor] = useState(null);
  const [activeAssignPath, setActiveAssignPath] = useState(null);
  /** Keeps chips visible if parent persists text but drops tagRefs meta. */
  const [optimisticTagRefs, setOptimisticTagRefs] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [hoveredTagRefId, setHoveredTagRefId] = useState(null);
  /**
   * After × / Escape on the @ picker: keep that `@` as plain text and do not
   * reopen until it is deleted (or a new `@` is typed elsewhere).
   */
  const [mentionPickerDismissed, setMentionPickerDismissed] = useState(false);
  const mentionPickerDismissedAtRef = useRef(/** @type {number|null} */ (null));
  const mentionPickerDismissedRef = useRef(false);

  // null/undefined candidates => company missing; @ stays plain text.
  const mentionsEnabled = Array.isArray(mentionCandidates);
  const atToolInvokeEnabled = qloopCandidates != null && Boolean(companyObjectId);
  const hasCandidateSource = mentionsEnabled || atToolInvokeEnabled;
  const normalizedMentions = useMemo(
    () => (mentionsEnabled ? normalizeMentions(value, mentions) : []),
    [mentions, mentionsEnabled, value],
  );
  const hasMentions = normalizedMentions.length > 0;

  // Array candidates => # opens the moodboard tag menu. null/undefined => # stays
  // plain text (reserved for `#i` / `#o`). Existing chips still render from `tagRefs`.
  const tagInsertEnabled = Array.isArray(tagRefCandidates);
  const tagRefsEnabled = Array.isArray(tagRefs) || tagInsertEnabled;
  const hasTagRefSource = tagInsertEnabled;
  const normalizedTagRefs = useMemo(() => {
    if (!tagRefsEnabled) return [];
    const fromProp = normalizeTagRefs(value, tagRefs);
    if (fromProp.length > 0) return fromProp;
    if (tagInsertEnabled && optimisticTagRefs) return normalizeTagRefs(value, optimisticTagRefs);
    return [];
  }, [optimisticTagRefs, tagInsertEnabled, tagRefs, tagRefsEnabled, value]);
  const hasTagRefs = normalizedTagRefs.length > 0;

  useEffect(() => {
    activeQueryRef.current = activeQuery;
  }, [activeQuery]);

  useEffect(() => {
    if (!tagRefsEnabled) {
      setOptimisticTagRefs(null);
      return;
    }
    const fromProp = normalizeTagRefs(value, tagRefs);
    if (fromProp.length > 0) {
      setOptimisticTagRefs(null);
    }
  }, [tagRefs, tagRefsEnabled, value]);

  // null/undefined markerRanges => marker feature off for this field.
  const markersEnabled = Array.isArray(markerRanges);
  const normalizedMarkers = useMemo(
    () => (markersEnabled ? normalizeMarkerRanges(value, markerRanges) : []),
    [markerRanges, markersEnabled, value],
  );
  const hasMarkers = normalizedMarkers.length > 0;

  // null/undefined boldRanges => bold feature off for this field.
  const boldEnabled = Array.isArray(boldRanges);
  const normalizedBolds = useMemo(
    () => (boldEnabled ? normalizeBoldRanges(value, boldRanges) : []),
    [boldEnabled, boldRanges, value],
  );
  const hasBold = normalizedBolds.length > 0;
  const libraryNameInvokeEnabled = Array.isArray(libraryNameCandidates);
  const libraryAssignEnabled = Array.isArray(libraryAssignFiles)
    && Array.isArray(libraryAssignAssets);
  const libraryNameRefsEnabled = Array.isArray(libraryNameRefs) || libraryNameInvokeEnabled;
  const normalizedLibraryNameRefs = useMemo(
    () => (libraryNameRefsEnabled ? normalizeLibraryNameRefs(value, libraryNameRefs) : []),
    [libraryNameRefs, libraryNameRefsEnabled, value],
  );
  const hasLibraryNameRefs = normalizedLibraryNameRefs.length > 0;
  const librarySpeakRefsEnabled = Array.isArray(librarySpeakRefs)
    || (libraryAssignEnabled && libraryNameInvokeEnabled);
  const normalizedLibrarySpeakRefs = useMemo(
    () => (librarySpeakRefsEnabled ? normalizeLibrarySpeakRefs(value, librarySpeakRefs) : []),
    [librarySpeakRefs, librarySpeakRefsEnabled, value],
  );
  // Mirror overlay for chips, ink, and/or faux-bold glyphs.
  const hasOverlay = hasMentions || hasTagRefs || hasMarkers || hasBold || hasLibraryNameRefs;
  // Glyph overlays require transparent textarea text (same as mentions).
  const hideTextareaGlyphs = hasMentions || hasTagRefs || hasBold || hasLibraryNameRefs;

  const { slash } = splitBodyForSlash(value);
  const showGhost = Boolean(slash) && /^\/\s*$/.test(slash)
    && !activeQuery && !activeTagRefQuery && !activeLibraryNameQuery && !activeAssignPath;

  const filteredCandidates = useMemo(() => {
    if (!hasCandidateSource || !activeQuery) return [];
    return filterTagCandidates(mentionCandidates, activeQuery.query).slice(0, 8);
  }, [activeQuery, hasCandidateSource, mentionCandidates]);

  const filteredTagRefCandidates = useMemo(() => {
    if (!hasTagRefSource || !activeTagRefQuery) return [];
    return filterTagRefCandidates(tagRefCandidates, activeTagRefQuery.query, 8);
  }, [activeTagRefQuery, hasTagRefSource, tagRefCandidates]);

  // Table→tag picker when company is set; flat menu only as fallback.
  const showMentionMenu = Boolean(
    (focused || Boolean(activeQuery && companyObjectId))
    && hasCandidateSource
    && activeQuery
    && !mentionPickerDismissed
    && !showGhost
    && !activeTagRefQuery,
  );
  const useTagCommandPicker = Boolean(showMentionMenu && companyObjectId && qloopCandidates == null);
  const useAtToolPicker = Boolean(
    showMentionMenu
    && companyObjectId
    && qloopCandidates != null,
  );
  const useFlatMentionMenu = Boolean(showMentionMenu && !companyObjectId);
  const showTagRefMenu = Boolean(
    focused && hasTagRefSource && activeTagRefQuery && !showGhost && !activeQuery,
  );
  const filteredLibraryNameCandidates = useMemo(() => {
    if (!libraryNameInvokeEnabled || !activeLibraryNameQuery) return [];
    return filterLibraryNameCandidates(
      libraryNameCandidates,
      activeLibraryNameQuery.query,
      8,
    );
  }, [activeLibraryNameQuery, libraryNameCandidates, libraryNameInvokeEnabled]);

  const filteredAssignPathItems = useMemo(() => {
    if (!libraryAssignEnabled || !activeAssignPath) return [];
    return listLibraryAssignMenuItems(
      activeAssignPath,
      libraryAssignFiles,
      libraryAssignAssets,
      8,
    );
  }, [activeAssignPath, libraryAssignAssets, libraryAssignEnabled, libraryAssignFiles]);

  const assignPathEmptyReason = useMemo(() => {
    if (!libraryAssignEnabled || !activeAssignPath?.hasDot) return null;
    return libraryAssignMenuEmptyReason(
      activeAssignPath,
      libraryAssignFiles,
      libraryAssignAssets,
    );
  }, [activeAssignPath, libraryAssignAssets, libraryAssignEnabled, libraryAssignFiles]);

  const assignPathEmptyLabel = assignPathEmptyReason === "noFile"
    ? t("doc.library.assignPathEmptyFile")
    : assignPathEmptyReason === "noAsset"
      ? t("doc.library.assignPathEmptyAsset")
      : assignPathEmptyReason === "noAssetMatch"
        ? t("doc.library.assignPathEmptyAssetMatch")
        : "";

  const showAssignPathMenu = Boolean(
    focused
    && libraryAssignEnabled
    && activeAssignPath?.hasDot
    && filteredAssignPathItems.length > 0
    && !showGhost
    && !activeQuery
    && !activeTagRefQuery,
  );

  const showLibraryNameMenu = Boolean(
    focused
    && libraryNameInvokeEnabled
    && activeLibraryNameQuery
    && filteredLibraryNameCandidates.length > 0
    && !showGhost
    && !activeQuery
    && !activeTagRefQuery
    && !showAssignPathMenu,
  );

  const scheduleCaretCameraScroll = useCallback(() => {
    if (caretCameraRafRef.current) {
      cancelAnimationFrame(caretCameraRafRef.current);
    }
    caretCameraRafRef.current = requestAnimationFrame(() => {
      caretCameraRafRef.current = null;
      const el = textareaRef.current;
      if (!el) return;
      scrollTextareaCaretIntoCameraView(el, { behavior: "instant" });
    });
  }, [textareaRef]);

  const syncGhostPosition = useCallback(() => {
    if (!showGhost) {
      setGhostPos(null);
      return;
    }
    const el = textareaRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    setGhostPos(resolveSlashGhostOverlayPosition(el, wrap));
  }, [showGhost, textareaRef]);

  const clearMentionPickerDismiss = useCallback(() => {
    mentionPickerDismissedAtRef.current = null;
    mentionPickerDismissedRef.current = false;
    setMentionPickerDismissed(false);
  }, []);

  const armMentionPickerDismiss = useCallback((dismissAt) => {
    mentionPickerDismissedAtRef.current = Number.isFinite(dismissAt) ? dismissAt : null;
    mentionPickerDismissedRef.current = true;
    setMentionPickerDismissed(true);
  }, []);

  const shiftMentionPickerDismissAt = useCallback((prevText, nextText) => {
    const dismissedAt = mentionPickerDismissedAtRef.current;
    if (dismissedAt == null || dismissedAt < 0) return;
    if (String(prevText ?? "") === String(nextText ?? "")) return;
    const { editStart, removedLength, insertedLength } = computeTextEditDelta(prevText, nextText);
    const editEnd = editStart + removedLength;
    const delta = insertedLength - removedLength;
    if (dismissedAt >= editEnd) {
      mentionPickerDismissedAtRef.current = dismissedAt + delta;
      return;
    }
    if (dismissedAt >= editStart) {
      // The `@` sat inside the edited span. Keep dismiss only if an `@`
      // trigger is still sitting at the edit point.
      const next = String(nextText ?? "");
      const nextAt = editStart;
      if (
        nextAt < next.length
        && next[nextAt] === "@"
        && (nextAt === 0 || /\s/.test(next[nextAt - 1]))
      ) {
        mentionPickerDismissedAtRef.current = nextAt;
      } else {
        clearMentionPickerDismiss();
      }
    }
  }, [clearMentionPickerDismiss]);

  const syncMentionQuery = useCallback(() => {
    const el = textareaRef.current;
    // React's `focused` state can go stale when the field is focused
    // programmatically (focusBlockById, slash flows, remounts). Trust the DOM.
    const domFocused = Boolean(
      el && typeof document !== "undefined" && document.activeElement === el,
    );
    if (domFocused !== focused) setFocused(domFocused);
    if (!domFocused || !el) {
      const active = typeof document !== "undefined" ? document.activeElement : null;
      if (
        active instanceof Element
        && (
          active.closest(".doc-tag-command-picker")
          || active.closest(".at-tool-command-picker")
          || active.closest(".doc-mention-menu")
        )
      ) {
        return;
      }
      // Mid-click focus can land on <body> while the @ picker is still open.
      // Do not clear the query or the tables→tags step gets torn down.
      if (
        typeof document !== "undefined"
        && (
          document.querySelector(".doc-tag-command-picker")
          || document.querySelector(".at-tool-command-picker")
        )
      ) {
        return;
      }
      setActiveQuery(null);
      activeQueryRef.current = null;
      setMenuAnchor(null);
      setActiveTagRefQuery(null);
      setTagRefMenuAnchor(null);
      return;
    }
    const caret = el.selectionStart ?? 0;
    if ((el.selectionEnd ?? caret) !== caret) {
      setActiveQuery(null);
      setMenuAnchor(null);
      setActiveTagRefQuery(null);
      setTagRefMenuAnchor(null);
      return;
    }

    // Drop dismiss only when that exact `@` is gone from the text.
    let dismissedAt = mentionPickerDismissedAtRef.current;
    if (
      dismissedAt != null
      && dismissedAt >= 0
      && (dismissedAt >= el.value.length || el.value[dismissedAt] !== "@")
    ) {
      clearMentionPickerDismiss();
      dismissedAt = null;
    }

    const mentionQuery = hasCandidateSource
      ? getMentionQueryAtCaret(
        el.value,
        caret,
        normalizedMentions,
        mentionPickerDismissedRef.current ? dismissedAt : null,
      )
      : null;
    const tagRefQuery = hasTagRefSource
      ? getTagRefQueryAtCaret(el.value, caret)
      : null;

    // Prefer the query whose trigger is closest to the caret.
    let useMention = Boolean(mentionQuery);
    let useTagRef = Boolean(tagRefQuery);
    if (mentionQuery && tagRefQuery) {
      useMention = mentionQuery.start >= tagRefQuery.start;
      useTagRef = !useMention;
    }

    if (useMention && mentionQuery) {
      // While dismissed with no pinned index, keep the table shut for any `@`.
      if (mentionPickerDismissedRef.current && dismissedAt == null) {
        setActiveQuery(null);
        activeQueryRef.current = null;
        setMenuAnchor(null);
        setActiveTagRefQuery(null);
        setTagRefMenuAnchor(null);
        setActiveLibraryNameQuery(null);
        setLibraryNameMenuAnchor(null);
        return;
      }
      // A brand-new `@` elsewhere — allow the table again.
      if (
        mentionPickerDismissedRef.current
        && dismissedAt != null
        && dismissedAt !== mentionQuery.start
      ) {
        clearMentionPickerDismiss();
      }
      setActiveQuery(mentionQuery);
      setActiveTagRefQuery(null);
      setTagRefMenuAnchor(null);
      setActiveLibraryNameQuery(null);
      setLibraryNameMenuAnchor(null);
      const rect = getCaretClientRect(el, mentionQuery.start);
      const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 18;
      setMenuAnchor(buildFloatingMenuAnchor(rect, lineHeight));
      return;
    }

    setActiveQuery(null);
    setMenuAnchor(null);

    if (useTagRef && tagRefQuery) {
      setActiveTagRefQuery(tagRefQuery);
      setActiveLibraryNameQuery(null);
      setLibraryNameMenuAnchor(null);
      const rect = getCaretClientRect(el, tagRefQuery.start);
      const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 18;
      setTagRefMenuAnchor(buildFloatingMenuAnchor(rect, lineHeight));
      return;
    }

    setActiveTagRefQuery(null);
    setTagRefMenuAnchor(null);

    if (libraryAssignEnabled) {
      const assignPath = getLibraryAssignPathAtCaret(el.value, caret, libraryAssignFiles);
      if (assignPath?.hasDot) {
        setActiveAssignPath(assignPath);
        setActiveLibraryNameQuery(null);
        setLibraryNameMenuAnchor(null);
        const rect = getCaretClientRect(el, assignPath.start);
        const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 18;
        setAssignPathMenuAnchor(buildFloatingMenuAnchor(rect, lineHeight));
        return;
      }
    }

    setActiveAssignPath(null);
    setAssignPathMenuAnchor(null);

    if (libraryNameInvokeEnabled) {
      const nameQuery = getLibraryNameQueryAtCaret(
        el.value,
        caret,
        normalizedLibraryNameRefs,
      );
      if (nameQuery) {
        setActiveLibraryNameQuery(nameQuery);
        const rect = getCaretClientRect(el, nameQuery.start);
        const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 18;
        setLibraryNameMenuAnchor(buildFloatingMenuAnchor(rect, lineHeight));
        return;
      }
    }

    setActiveLibraryNameQuery(null);
    setLibraryNameMenuAnchor(null);
  }, [
    clearMentionPickerDismiss,
    focused,
    hasCandidateSource,
    hasTagRefSource,
    libraryAssignEnabled,
    libraryAssignFiles,
    libraryNameInvokeEnabled,
    normalizedLibraryNameRefs,
    normalizedMentions,
    textareaRef,
  ]);

  useEffect(() => {
    if (!qloopPickerForceOpen) {
      setForcedQloopPicker(false);
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    const caret = typeof el.selectionStart === "number" ? el.selectionStart : value.length;
    const rect = getCaretClientRect(el, caret);
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 18;
    setMenuAnchor(buildFloatingMenuAnchor(rect, lineHeight));
    setForcedQloopPicker(true);
  }, [qloopPickerForceOpen, textareaRef, value]);

  const dismissMentionPicker = useCallback(() => {
    const el = textareaRef.current;
    const liveQuery = activeQueryRef.current;
    let dismissAt = liveQuery && Number.isFinite(liveQuery.start) ? liveQuery.start : null;
    let queryEnd = liveQuery && Number.isFinite(liveQuery.end) ? liveQuery.end : null;

    if (el && (dismissAt == null || queryEnd == null)) {
      const caret = el.selectionEnd ?? el.selectionStart ?? el.value.length;
      // Pass null dismissedAt so we can still locate the live `@` being closed.
      const q = getMentionQueryAtCaret(el.value, caret, normalizedMentions, null);
      if (q) {
        dismissAt = q.start;
        queryEnd = q.end;
      } else {
        for (let i = el.value.length - 1; i >= 0; i -= 1) {
          if (el.value[i] !== "@") continue;
          if (i > 0 && !/\s/.test(el.value[i - 1])) continue;
          dismissAt = i;
          queryEnd = i + 1;
          while (
            queryEnd < el.value.length
            && /[A-Za-z0-9_.-]/.test(el.value[queryEnd])
          ) {
            queryEnd += 1;
          }
          break;
        }
      }
    }

    armMentionPickerDismiss(dismissAt);
    setActiveQuery(null);
    activeQueryRef.current = null;
    setMenuAnchor(null);

    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) {
        textareaRef.current?.focus?.({ preventScroll: true });
        syncMentionQuery();
        return;
      }
      // Keep `@` in the line; park caret at the end of that run so typing continues.
      let caret = field.selectionEnd ?? field.selectionStart ?? field.value.length;
      if (queryEnd != null) {
        caret = queryEnd;
      } else if (dismissAt != null && dismissAt < field.value.length && field.value[dismissAt] === "@") {
        let end = dismissAt + 1;
        while (end < field.value.length && /[A-Za-z0-9_.-]/.test(field.value[end])) end += 1;
        caret = end;
      }
      field.focus({ preventScroll: true });
      field.setSelectionRange(caret, caret);
      syncMentionQuery();
    });
  }, [armMentionPickerDismiss, normalizedMentions, syncMentionQuery, textareaRef]);

  const prevValueForDismissRef = useRef(value);
  useLayoutEffect(() => {
    const prev = prevValueForDismissRef.current;
    if (prev !== value) {
      shiftMentionPickerDismissAt(prev, value);
      prevValueForDismissRef.current = value;
    }
  }, [shiftMentionPickerDismissAt, value]);

  const syncMirrorTypography = useCallback(() => {
    const el = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;
    copyTextareaTypography(el, mirror);
    const style = window.getComputedStyle(el);
    mirror.style.position = "absolute";
    mirror.style.top = "0";
    mirror.style.left = "0";
    mirror.style.width = `${el.offsetWidth}px`;
    mirror.style.height = `${el.offsetHeight}px`;
    mirror.style.minHeight = style.minHeight;
    mirror.style.margin = style.margin;
    mirror.style.boxSizing = style.boxSizing;
    mirror.style.overflow = style.overflowY === "auto" ? "auto" : "hidden";
    mirror.style.wordBreak = style.wordBreak;
    mirror.style.overflowWrap = style.overflowWrap;
    mirror.style.zIndex = "0";
    mirror.scrollTop = el.scrollTop;
    mirror.scrollLeft = el.scrollLeft;
  }, [textareaRef]);

  useEffect(() => () => {
    if (caretCameraRafRef.current) cancelAnimationFrame(caretCameraRafRef.current);
  }, []);

  useEffect(() => {
    if (!showGhost) {
      setHintIndex(0);
      return;
    }
    const hints = Array.isArray(ghostHints) && ghostHints.length > 0
      ? ghostHints
      : DOC_SLASH_GHOST_HINTS;
    setHintIndex(0);
    const interval = setInterval(() => {
      setHintIndex((i) => (i + 1) % hints.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [showGhost, slash, ghostHints]);

  useEffect(() => {
    setMenuIndex(0);
  }, [activeQuery?.start, activeQuery?.query, showMentionMenu]);

  useEffect(() => {
    setTagRefMenuIndex(0);
  }, [activeTagRefQuery?.start, activeTagRefQuery?.query, showTagRefMenu]);

  useEffect(() => {
    setLibraryNameMenuIndex(0);
  }, [activeLibraryNameQuery?.start, activeLibraryNameQuery?.query, showLibraryNameMenu]);

  useEffect(() => {
    setAssignPathMenuIndex(0);
  }, [activeAssignPath?.start, activeAssignPath?.raw, showAssignPathMenu]);

  useLayoutEffect(() => {
    syncGhostPosition();
  }, [value, showGhost, hintIndex, syncGhostPosition]);

  useLayoutEffect(() => {
    if (!showGhost) return undefined;
    const el = textareaRef.current;
    if (!el) return undefined;

    const onScroll = () => syncGhostPosition();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    let ro;
    if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
      ro = new ResizeObserver(onScroll);
      ro.observe(wrapRef.current);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, [showGhost, syncGhostPosition, textareaRef]);

  const resolvedGhostHints = Array.isArray(ghostHints) && ghostHints.length > 0
    ? ghostHints
    : DOC_SLASH_GHOST_HINTS;
  const ghostHint = resolvedGhostHints[hintIndex] ?? resolvedGhostHints[0];

  const focusField = useCallback(
    (placeCaretAtEnd = false) => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (placeCaretAtEnd && "setSelectionRange" in el) {
        const pos = el.value.length;
        el.setSelectionRange(pos, pos);
      }
    },
    [textareaRef],
  );

  // Close button / top-right corner of the moodboard frame (beats open-slot).
  const TAGREF_BOX_CLOSE_HIT_PX = 32;

  const findTagRefBoxCloseIdAtPoint = useCallback((x, y) => {
    const mirror = mirrorRef.current;
    if (!mirror) return null;
    for (const span of mirror.querySelectorAll("[data-tagref-id][data-tagref-box='1']")) {
      const frame =
        span.querySelector?.(".doc-slash-field__tagref-box-frame")
        || span.querySelector?.(".doc-slash-field__tagref-box-img");
      const base = frame?.getBoundingClientRect?.();
      if (!base || base.width < 1 || base.height < 1) continue;
      const left = base.right - TAGREF_BOX_CLOSE_HIT_PX;
      const right = base.right + 6;
      const top = base.top - 6;
      const bottom = base.top + TAGREF_BOX_CLOSE_HIT_PX;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        return span.getAttribute("data-tagref-id");
      }
    }
    return null;
  }, []);

  // Chips live in the mirror, which is pointer-events:none while the field is
  // focused — so both hover and click are resolved by hit-testing the mention
  // span rects against the pointer position (works focused and blurred).
  const findChipSpanAtPoint = useCallback((x, y, attrName) => {
    const mirror = mirrorRef.current;
    if (!mirror) return null;
    for (const span of mirror.querySelectorAll(`[${attrName}]`)) {
      for (const rect of span.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return span;
        }
      }
      // Moodboard box: fixed frame under the label (may extend into spacer lines).
      if (attrName === "data-tagref-id" && span.getAttribute("data-tagref-box") === "1") {
        const frame =
          span.querySelector?.(".doc-slash-field__tagref-box-frame")
          || span.querySelector?.(".doc-slash-field__tagref-box-img");
        const base = frame?.getBoundingClientRect?.() || span.getClientRects()?.[0];
        if (base) {
          const left = base.left;
          const top = base.top;
          const right = left + Math.max(base.width, TAGREF_BOX_WIDTH_PX);
          const bottom = top + Math.max(base.height, TAGREF_BOX_HEIGHT_PX);
          if (x >= left && x <= right && y >= top && y <= bottom) {
            return span;
          }
        }
      }
    }
    return null;
  }, []);

  const snapCaretPastBoxFootprints = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !("selectionStart" in el)) return;
    if (el.selectionStart !== el.selectionEnd) return;
    const next = snapCaretOutOfTagRefBoxFootprint(
      value,
      normalizedTagRefs,
      el.selectionStart,
      tagRefCandidates,
    );
    if (next !== el.selectionStart) {
      el.setSelectionRange(next, next);
    }
  }, [normalizedTagRefs, tagRefCandidates, textareaRef, value]);

  const deleteTagRefRef = useRef(null);

  const handleWrapPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      // Capture + bubble both bound — skip the second pass.
      if (event.defaultPrevented) return;

      if (hasTagRefs) {
        // Prefer close (×) over opening the moodboard — mirror is often
        // pointer-events:none while focused, so the wrap owns the hit.
        const closeId = findTagRefBoxCloseIdAtPoint(event.clientX, event.clientY);
        if (closeId) {
          event.preventDefault();
          event.stopPropagation();
          setHoverCard(null);
          setHoveredTagRefId(null);
          deleteTagRefRef.current?.(closeId);
          return;
        }

        const span = findChipSpanAtPoint(event.clientX, event.clientY, "data-tagref-id");
        const tagRefId = span?.getAttribute("data-tagref-id");
        const tagRef = tagRefId
          ? normalizedTagRefs.find((item) => item.id === tagRefId)
          : null;
        if (tagRef) {
          event.preventDefault();
          event.stopPropagation();
          setHoverCard(null);
          // Keep caret on the free line under the frame (never on spacer lines).
          const el = textareaRef.current;
          if (el && "setSelectionRange" in el) {
            const writeAt = snapCaretOutOfTagRefBoxFootprint(
              value,
              normalizedTagRefs,
              tagRef.start,
              tagRefCandidates,
            );
            el.focus({ preventScroll: true });
            el.setSelectionRange(writeAt, writeAt);
          }
          setHoveredTagRefId(tagRef.id);
          scrollToMoodboardSlot({
            blockId: tagRef.blockId,
            slotId: tagRef.slotId,
            label: tagRef.label,
          });
          return;
        }
      }

      // Chip click = open the entry's affiliate / link URL in a new tab.
      if (hasMentions) {
        const span = findChipSpanAtPoint(event.clientX, event.clientY, "data-mention-id");
        const mentionId = span?.getAttribute("data-mention-id");
        const mention = mentionId
          ? normalizedMentions.find((item) => item.id === mentionId)
          : null;
        if (mention) {
          event.preventDefault();
          event.stopPropagation();
          setHoverCard(null);
          const href = String(mention.url ?? "").trim();
          if (href) {
            window.open(href, "_blank", "noopener,noreferrer");
          }
          return;
        }
      }
      const el = textareaRef.current;
      if (!el || event.target === el) return;
      event.preventDefault();
      focusField(true);
    },
    [
      findChipSpanAtPoint,
      findTagRefBoxCloseIdAtPoint,
      focusField,
      hasMentions,
      hasTagRefs,
      normalizedMentions,
      normalizedTagRefs,
      tagRefCandidates,
      textareaRef,
      value,
    ],
  );

  // Delay-close lets the pointer travel from the chip into the hover card
  // (portaled below the chip) without the card vanishing mid-way.
  const hoverCloseTimerRef = useRef(null);
  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);
  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimerRef.current = setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setHoverCard(null);
    }, 220);
  }, [cancelHoverClose]);

  useEffect(() => () => cancelHoverClose(), [cancelHoverClose]);

  // The mirror is pointer-events:none while the field is focused, so hover is
  // resolved by hit-testing mention span rects on wrap mousemove. Works both
  // focused (events come from the textarea) and blurred (from the mirror).
  const handleWrapMouseMove = useCallback((event) => {
    if (hasTagRefs) {
      const tagSpan = findChipSpanAtPoint(event.clientX, event.clientY, "data-tagref-id");
      if (tagSpan) {
        const tagRefId = tagSpan.getAttribute("data-tagref-id");
        if (tagRefId) {
          cancelHoverClose();
          setHoverCard(null);
          setHoveredTagRefId(tagRefId);
          return;
        }
      }
    }
    setHoveredTagRefId(null);

    if (!hasMentions) return;
    const hitSpan = findChipSpanAtPoint(event.clientX, event.clientY, "data-mention-id");
    if (!hitSpan) {
      scheduleHoverClose();
      return;
    }
    const mentionId = hitSpan.getAttribute("data-mention-id");
    const mention = normalizedMentions.find((item) => item.id === mentionId);
    if (!mention) return;
    cancelHoverClose();
    const rect = hitSpan.getBoundingClientRect();
    setHoverCard((prev) => (prev?.mention?.id === mentionId ? prev : {
      mention,
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
    }));
  }, [
    cancelHoverClose,
    findChipSpanAtPoint,
    hasMentions,
    hasTagRefs,
    normalizedMentions,
    scheduleHoverClose,
  ]);

  const handleWrapMouseLeave = useCallback(() => {
    setHoveredTagRefId(null);
    scheduleHoverClose();
  }, [scheduleHoverClose]);

  const isFieldVisible = useCallback((el) => {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const rects = el.getClientRects();
    return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
  }, []);

  const heightCap = maxHeightPx == null ? Number.POSITIVE_INFINITY : maxHeightPx;

  const syncHeight = useCallback((force = false) => {
    const el = textareaRef.current;
    if (!el) return;
    if (!force && !isFieldVisible(el)) return;
    // Collapsing to "auto" briefly shrinks the doc scrollHeight; preserve scrollTop
    // so bold/overlay toggles (and normal typing) don't jump the viewport.
    withPreservedWritingScroll(el, () => {
      el.style.height = "auto";
      const measured = el.scrollHeight;
      const next = Math.min(Math.max(measured, minHeightPx), heightCap);
      el.style.height = `${next}px`;
      el.style.overflowY = measured > next + 1 ? "auto" : "hidden";
    });
    if (hasOverlay) syncMirrorTypography();
  }, [hasOverlay, heightCap, isFieldVisible, minHeightPx, syncMirrorTypography, textareaRef]);

  useLayoutEffect(() => {
    syncHeight(true);
    syncGhostPosition();
    if (hasOverlay) syncMirrorTypography();
  }, [value, hasOverlay, syncHeight, syncGhostPosition, syncMirrorTypography, normalizedMentions, normalizedTagRefs, normalizedMarkers, normalizedBolds]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      syncHeight(true);
      syncGhostPosition();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncHeight, syncGhostPosition, textareaRef]);

  useLayoutEffect(() => {
    if (!autoFocus) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [autoFocus, textareaRef]);

  useLayoutEffect(() => {
    if (!showMentionMenu && !showTagRefMenu && !showLibraryNameMenu) return;
    syncMentionQuery();
  }, [showMentionMenu, showTagRefMenu, showLibraryNameMenu, value, syncMentionQuery]);

  const emitChange = useCallback((
    nextValue,
    nextMentions,
    nextMarkers,
    nextBolds,
    nextTagRefs,
    nextLibraryNameRefs,
    nextLibrarySpeakRefs,
  ) => {
    const collapsed = collapseDuplicateSlashTail(nextValue);
    let mentionsOut = nextMentions;
    let markersOut = nextMarkers;
    let boldsOut = nextBolds;
    let tagRefsOut = nextTagRefs;
    let libraryNameOut = nextLibraryNameRefs;
    let librarySpeakOut = nextLibrarySpeakRefs;
    if (collapsed !== nextValue) {
      if (mentionsEnabled) {
        mentionsOut = applyTextEditToMentions(nextValue, collapsed, nextMentions);
      }
      if (tagRefsEnabled) {
        tagRefsOut = applyTextEditToTagRefs(nextValue, collapsed, nextTagRefs);
      }
      if (libraryNameRefsEnabled) {
        libraryNameOut = applyTextEditToLibraryNameRefs(nextValue, collapsed, nextLibraryNameRefs);
      }
      if (librarySpeakRefsEnabled) {
        librarySpeakOut = applyTextEditToLibrarySpeakRefs(
          nextValue,
          collapsed,
          nextLibrarySpeakRefs ?? normalizedLibrarySpeakRefs,
        );
      }
      if (markersEnabled) {
        markersOut = applyTextEditToMarkerRanges(nextValue, collapsed, nextMarkers);
      }
      if (boldEnabled) {
        boldsOut = applyTextEditToBoldRanges(nextValue, collapsed, nextBolds);
      }
    }
    const normalized = mentionsEnabled
      ? normalizeMentions(collapsed, mentionsOut)
      : [];
    const normalizedTagRefsOut = tagRefsEnabled
      ? normalizeTagRefs(collapsed, tagRefsOut)
      : [];
    const normalizedLibraryNameOut = libraryNameRefsEnabled
      ? normalizeLibraryNameRefs(collapsed, libraryNameOut)
      : [];
    const normalizedLibrarySpeakOut = librarySpeakRefsEnabled
      ? normalizeLibrarySpeakRefs(collapsed, librarySpeakOut)
      : [];
    const normalizedMarkersOut = markersEnabled
      ? normalizeMarkerRanges(collapsed, markersOut)
      : [];
    const normalizedBoldsOut = boldEnabled
      ? normalizeBoldRanges(collapsed, boldsOut)
      : [];
    if (tagRefsEnabled) {
      setOptimisticTagRefs(normalizedTagRefsOut.length ? normalizedTagRefsOut : null);
    }
    const meta = {
      ...(mentionsEnabled ? { mentions: normalized } : {}),
      ...(tagRefsEnabled ? { tagRefs: normalizedTagRefsOut } : {}),
      ...(libraryNameRefsEnabled ? { libraryNameRefs: normalizedLibraryNameOut } : {}),
      ...(librarySpeakRefsEnabled ? { librarySpeakRefs: normalizedLibrarySpeakOut } : {}),
      ...(markersEnabled ? { markerRanges: normalizedMarkersOut } : {}),
      ...(boldEnabled ? { boldRanges: normalizedBoldsOut } : {}),
    };
    onChange(
      collapsed,
      Object.keys(meta).length ? meta : undefined,
    );
    if (mentionsEnabled) {
      onMentionsChange?.(normalized);
    }
    if (tagRefsEnabled) {
      onTagRefsChange?.(normalizedTagRefsOut);
    }
    if (libraryNameRefsEnabled) {
      onLibraryNameRefsChange?.(normalizedLibraryNameOut);
    }
    if (librarySpeakRefsEnabled) {
      onLibrarySpeakRefsChange?.(normalizedLibrarySpeakOut);
    }
    onAfterInput?.();
  }, [
    boldEnabled,
    libraryNameRefsEnabled,
    librarySpeakRefsEnabled,
    markersEnabled,
    mentionsEnabled,
    normalizedLibrarySpeakRefs,
    onAfterInput,
    onChange,
    onLibraryNameRefsChange,
    onLibrarySpeakRefsChange,
    onMentionsChange,
    onTagRefsChange,
    tagRefsEnabled,
  ]);

  const deleteTagRef = useCallback((tagRefId) => {
    if (!tagRefId) return;
    const result = removeTagRefById(value, normalizedTagRefs, tagRefId, tagRefCandidates);
    if (!result) return;
    setHoveredTagRefId(null);
    const nextMentions = mentionsEnabled
      ? applyTextEditToMentions(value, result.text, normalizedMentions)
      : [];
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(value, result.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(value, result.text, normalizedBolds)
      : [];
    const nextLibraryNames = libraryNameRefsEnabled
      ? applyTextEditToLibraryNameRefs(value, result.text, normalizedLibraryNameRefs)
      : [];
    emitChange(result.text, nextMentions, nextMarkers, nextBolds, result.tagRefs, nextLibraryNames);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
  }, [
    boldEnabled,
    emitChange,
    markersEnabled,
    mentionsEnabled,
    normalizedBolds,
    normalizedMarkers,
    normalizedMentions,
    normalizedTagRefs,
    syncMentionQuery,
    tagRefCandidates,
    textareaRef,
    value,
  ]);
  deleteTagRefRef.current = deleteTagRef;

  const insertQLoopSelection = useCallback(({ loop, query }) => {
    if (!onInsertQLoopQuery || !loop || !query) return;
    const queryAt = activeQueryRef.current || activeQuery;
    const el = textareaRef.current;
    const liveValue = el && typeof el.value === "string" ? el.value : value;
    const caret = el && typeof el.selectionStart === "number" ? el.selectionStart : liveValue.length;
    onInsertQLoopQuery({
      loop,
      query,
      mentionQuery: queryAt,
      textValue: liveValue,
      caretOffset: queryAt ? null : caret,
    });
    clearMentionPickerDismiss();
    setActiveQuery(null);
    activeQueryRef.current = null;
    setMenuAnchor(null);
    setForcedQloopPicker(false);
    onQloopPickerForceClose?.();
  }, [
    activeQuery,
    clearMentionPickerDismiss,
    onInsertQLoopQuery,
    onQloopPickerForceClose,
    textareaRef,
    value,
  ]);

  const insertCandidate = useCallback((candidate) => {
    const query = activeQueryRef.current || activeQuery;
    if (!candidate || !query) return;
    const el = textareaRef.current;
    const liveValue = el && typeof el.value === "string" ? el.value : value;
    const liveMentions = mentionsEnabled
      ? normalizeMentions(liveValue, mentions)
      : [];
    const liveMarkers = markersEnabled
      ? normalizeMarkerRanges(liveValue, markerRanges)
      : [];
    const liveBolds = boldEnabled
      ? normalizeBoldRanges(liveValue, boldRanges)
      : [];
    const liveTagRefs = tagRefsEnabled
      ? normalizeTagRefs(liveValue, optimisticTagRefs ?? tagRefs)
      : [];
    const liveLibraryNames = libraryNameRefsEnabled
      ? normalizeLibraryNameRefs(liveValue, libraryNameRefs)
      : [];
    const result = insertMentionAtQuery(liveValue, liveMentions, query, candidate);
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(liveValue, result.text, liveMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(liveValue, result.text, liveBolds)
      : [];
    const nextTagRefs = tagRefsEnabled
      ? applyTextEditToTagRefs(liveValue, result.text, liveTagRefs)
      : [];
    const nextLibraryNames = libraryNameRefsEnabled
      ? applyTextEditToLibraryNameRefs(liveValue, result.text, liveLibraryNames)
      : [];
    emitChange(result.text, result.mentions, nextMarkers, nextBolds, nextTagRefs, nextLibraryNames);
    clearMentionPickerDismiss();
    setActiveQuery(null);
    activeQueryRef.current = null;
    setMenuAnchor(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el || !("setSelectionRange" in el)) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
  }, [
    activeQuery,
    boldEnabled,
    boldRanges,
    clearMentionPickerDismiss,
    emitChange,
    libraryNameRefs,
    libraryNameRefsEnabled,
    markerRanges,
    markersEnabled,
    mentions,
    mentionsEnabled,
    optimisticTagRefs,
    syncMentionQuery,
    tagRefs,
    tagRefsEnabled,
    textareaRef,
    value,
  ]);

  const insertTagRefCandidate = useCallback((candidate) => {
    if (!candidate || !activeTagRefQuery) return;
    const el = textareaRef.current;
    const liveValue = el && typeof el.value === "string" ? el.value : value;
    const liveTagRefs = tagRefsEnabled
      ? normalizeTagRefs(liveValue, optimisticTagRefs ?? tagRefs)
      : [];
    const liveQuery = getTagRefQueryAtCaret(liveValue, el?.selectionStart ?? activeTagRefQuery.end)
      || activeTagRefQuery;
    const result = insertTagRefAtQuery(liveValue, liveTagRefs, liveQuery, candidate);
    if (!result.tagRefs?.length) return;
    setOptimisticTagRefs(result.tagRefs);
    const nextMentions = mentionsEnabled
      ? applyTextEditToMentions(liveValue, result.text, normalizedMentions)
      : [];
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(liveValue, result.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(liveValue, result.text, normalizedBolds)
      : [];
    const nextLibraryNames = libraryNameRefsEnabled
      ? applyTextEditToLibraryNameRefs(liveValue, result.text, normalizedLibraryNameRefs)
      : [];
    emitChange(result.text, nextMentions, nextMarkers, nextBolds, result.tagRefs, nextLibraryNames);
    setActiveTagRefQuery(null);
    setTagRefMenuAnchor(null);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
  }, [
    activeTagRefQuery,
    boldEnabled,
    emitChange,
    markersEnabled,
    mentionsEnabled,
    normalizedBolds,
    normalizedMarkers,
    normalizedMentions,
    optimisticTagRefs,
    syncMentionQuery,
    tagRefs,
    tagRefsEnabled,
    textareaRef,
    value,
  ]);

  const applyLibrarySpeakOpen = useCallback((speakPath, candidateFile = null) => {
    if (!speakPath) return false;
    const candidate = candidateFile
      || (libraryAssignFiles || []).find(
        (item) => normalizeLibraryNameKey(item?.tag || item?.name)
          === normalizeLibraryNameKey(speakPath.tag),
      );
    const opened = openLibrarySpeakQuotes(
      value,
      speakPath,
      candidate || { tag: speakPath.tag },
    );
    if (!opened.speakRef) return false;

    const tagStart = speakPath.start;
    const tagEnd = tagStart + opened.speakRef.tag.length;
    const nextNameRefs = normalizeLibraryNameRefs(opened.text, [
      ...normalizedLibraryNameRefs.filter(
        (item) => item.end <= tagStart || item.start >= tagEnd,
      ),
      {
        id: generateId("LNR"),
        itemId: String(candidate?.id || opened.speakRef.itemId || ""),
        tag: opened.speakRef.tag,
        setId: candidate?.setId ?? null,
        start: tagStart,
        end: tagEnd,
        insertedAt: new Date().toISOString(),
      },
    ]);
    const nextSpeakRefs = normalizeLibrarySpeakRefs(
      opened.text,
      [...normalizedLibrarySpeakRefs, opened.speakRef],
    );
    const nextMentions = mentionsEnabled
      ? applyTextEditToMentions(value, opened.text, normalizedMentions)
      : [];
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(value, opened.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(value, opened.text, normalizedBolds)
      : [];
    const nextTagRefs = tagRefsEnabled
      ? applyTextEditToTagRefs(value, opened.text, normalizedTagRefs)
      : [];
    emitChange(
      opened.text,
      nextMentions,
      nextMarkers,
      nextBolds,
      nextTagRefs,
      nextNameRefs,
      nextSpeakRefs,
    );
    setActiveAssignPath(null);
    setAssignPathMenuAnchor(null);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(opened.caret, opened.caret);
      syncMentionQuery();
    });
    return true;
  }, [
    boldEnabled,
    emitChange,
    libraryAssignFiles,
    markersEnabled,
    mentionsEnabled,
    normalizedBolds,
    normalizedLibraryNameRefs,
    normalizedLibrarySpeakRefs,
    normalizedMarkers,
    normalizedMentions,
    normalizedTagRefs,
    syncMentionQuery,
    tagRefsEnabled,
    textareaRef,
    value,
  ]);

  const insertAssignPathCandidate = useCallback((candidate) => {
    if (!candidate || !activeAssignPath) return;
    if (candidate.kind === "speak" && candidate.file) {
      const fileTag = String(candidate.file.tag || "").trim();
      if (!fileTag) return;
      // Open quotes from the live token (`Gina.s`), not from a rewritten
      // `Gina.speak` string — those offsets would eat the following newline.
      const opened = applyLibrarySpeakOpen({
        start: activeAssignPath.start,
        end: activeAssignPath.end,
        tag: fileTag,
        fileQuery: activeAssignPath.fileQuery,
      }, candidate.file);
      if (opened) return;
    }
    const fileTag = String(candidate.file?.tag || candidate.tag || "").trim();
    const result = candidate.kind === "asset" && fileTag
      ? insertLibraryNameRefAtQuery(
        value,
        normalizedLibraryNameRefs,
        { start: activeAssignPath.start, end: activeAssignPath.end },
        {
          id: candidate.file?.id,
          tag: fileTag,
          setId: candidate.asset?.id ?? null,
        },
      )
      : (() => {
        const token = candidate.kind === "file" && candidate.file?.tag
          ? `${candidate.file.tag}.`
          : fileTag;
        const replaced = replaceLibraryAssignPathToken(value, activeAssignPath, token);
        return {
          text: replaced.text,
          caret: replaced.caret,
          libraryNameRefs: libraryNameRefsEnabled
            ? applyTextEditToLibraryNameRefs(value, replaced.text, normalizedLibraryNameRefs)
            : [],
        };
      })();
    const nextMentions = mentionsEnabled
      ? applyTextEditToMentions(value, result.text, normalizedMentions)
      : [];
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(value, result.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(value, result.text, normalizedBolds)
      : [];
    const nextTagRefs = tagRefsEnabled
      ? applyTextEditToTagRefs(value, result.text, normalizedTagRefs)
      : [];
    emitChange(
      result.text,
      nextMentions,
      nextMarkers,
      nextBolds,
      nextTagRefs,
      result.libraryNameRefs,
    );
    setActiveAssignPath(null);
    setAssignPathMenuAnchor(null);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
    if (candidate.kind === "asset" && candidate.file && candidate.asset) {
      onLibraryAssignSelect?.(candidate.file, candidate.asset);
    }
  }, [
    activeAssignPath,
    applyLibrarySpeakOpen,
    boldEnabled,
    emitChange,
    libraryNameRefsEnabled,
    markersEnabled,
    mentionsEnabled,
    normalizedBolds,
    normalizedLibraryNameRefs,
    normalizedMarkers,
    normalizedMentions,
    normalizedTagRefs,
    onLibraryAssignSelect,
    syncMentionQuery,
    tagRefsEnabled,
    textareaRef,
    value,
  ]);

  const insertLibraryNameCandidate = useCallback((candidate) => {
    if (!candidate || !activeLibraryNameQuery) return;
    if (typeof canInsertLibraryNameRef === "function" && !canInsertLibraryNameRef(candidate)) {
      return;
    }
    const result = insertLibraryNameRefAtQuery(
      value,
      normalizedLibraryNameRefs,
      activeLibraryNameQuery,
      candidate,
    );
    const nextMentions = mentionsEnabled
      ? applyTextEditToMentions(value, result.text, normalizedMentions)
      : [];
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(value, result.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(value, result.text, normalizedBolds)
      : [];
    const nextTagRefs = tagRefsEnabled
      ? applyTextEditToTagRefs(value, result.text, normalizedTagRefs)
      : [];
    emitChange(
      result.text,
      nextMentions,
      nextMarkers,
      nextBolds,
      nextTagRefs,
      result.libraryNameRefs,
    );
    setActiveLibraryNameQuery(null);
    setLibraryNameMenuAnchor(null);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
  }, [
    activeLibraryNameQuery,
    boldEnabled,
    canInsertLibraryNameRef,
    emitChange,
    libraryNameRefsEnabled,
    markersEnabled,
    mentionsEnabled,
    normalizedBolds,
    normalizedLibraryNameRefs,
    normalizedMarkers,
    normalizedMentions,
    normalizedTagRefs,
    syncMentionQuery,
    tagRefsEnabled,
    textareaRef,
    value,
  ]);

  const openLibrarySpeakOnEnter = useCallback((event) => {
    if (event.key !== "Enter" || event.shiftKey) return false;
    if (showLibraryNameMenu || showTagRefMenu || showMentionMenu) return false;
    if (!libraryAssignEnabled || !librarySpeakRefsEnabled) return false;
    const el = textareaRef.current;
    if (!el || !("selectionStart" in el)) return false;
    const caret = el.selectionStart ?? 0;
    const path = getLibrarySpeakPathAtCaret(el.value, caret, libraryAssignFiles);
    if (!path) return false;

    event.preventDefault();
    return applyLibrarySpeakOpen(path);
  }, [
    applyLibrarySpeakOpen,
    libraryAssignEnabled,
    libraryAssignFiles,
    librarySpeakRefsEnabled,
    showLibraryNameMenu,
    showMentionMenu,
    showTagRefMenu,
    textareaRef,
  ]);

  const handleMentionKeyDown = useCallback((event) => {
    if (openLibrarySpeakOnEnter(event)) return true;
    if (showAssignPathMenu) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveAssignPath(null);
        setAssignPathMenuAnchor(null);
        return true;
      }
      if (!filteredAssignPathItems.length) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setAssignPathMenuIndex((i) => (i + 1) % filteredAssignPathItems.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setAssignPathMenuIndex((i) => (
          (i - 1 + filteredAssignPathItems.length) % filteredAssignPathItems.length
        ));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertAssignPathCandidate(
          filteredAssignPathItems[assignPathMenuIndex]
          || filteredAssignPathItems[0],
        );
        return true;
      }
      return false;
    }

    if (showLibraryNameMenu) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveLibraryNameQuery(null);
        setLibraryNameMenuAnchor(null);
        return true;
      }
      if (!filteredLibraryNameCandidates.length) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLibraryNameMenuIndex((i) => (i + 1) % filteredLibraryNameCandidates.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLibraryNameMenuIndex((i) => (
          (i - 1 + filteredLibraryNameCandidates.length) % filteredLibraryNameCandidates.length
        ));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertLibraryNameCandidate(
          filteredLibraryNameCandidates[libraryNameMenuIndex]
          || filteredLibraryNameCandidates[0],
        );
        return true;
      }
      return false;
    }

    if (showTagRefMenu) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveTagRefQuery(null);
        setTagRefMenuAnchor(null);
        return true;
      }
      if (!filteredTagRefCandidates.length) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setTagRefMenuIndex((i) => (i + 1) % filteredTagRefCandidates.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setTagRefMenuIndex((i) => (
          (i - 1 + filteredTagRefCandidates.length) % filteredTagRefCandidates.length
        ));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertTagRefCandidate(
          filteredTagRefCandidates[tagRefMenuIndex] || filteredTagRefCandidates[0],
        );
        return true;
      }
      return false;
    }

    if (!showMentionMenu) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      dismissMentionPicker();
      return true;
    }
    // DocTagCommandPicker / AtToolCommandPicker own keyboard while open.
    if (useTagCommandPicker || useAtToolPicker || forcedQloopPicker) return false;
    if (!filteredCandidates.length) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMenuIndex((i) => (i + 1) % filteredCandidates.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMenuIndex((i) => (i - 1 + filteredCandidates.length) % filteredCandidates.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertCandidate(filteredCandidates[menuIndex] || filteredCandidates[0]);
      return true;
    }
    return false;
  }, [
    dismissMentionPicker,
    filteredCandidates,
    filteredLibraryNameCandidates,
    filteredTagRefCandidates,
    assignPathMenuIndex,
    filteredAssignPathItems,
    openLibrarySpeakOnEnter,
    insertAssignPathCandidate,
    insertCandidate,
    insertLibraryNameCandidate,
    insertTagRefCandidate,
    libraryNameMenuIndex,
    menuIndex,
    showAssignPathMenu,
    showLibraryNameMenu,
    showMentionMenu,
    showTagRefMenu,
    tagRefMenuIndex,
    useTagCommandPicker,
    useAtToolPicker,
    forcedQloopPicker,
  ]);

  const handleTagRefChipKeyDown = useCallback((event) => {
    if (!tagRefsEnabled || !hasTagRefs) return false;
    if (event.key !== "Backspace" && event.key !== "Delete") return false;
    const el = textareaRef.current;
    if (!el || !("selectionStart" in el)) return false;

    const result = deleteTagRefAtomically(
      value,
      normalizedTagRefs,
      el.selectionStart,
      el.selectionEnd,
      event.key,
    );
    if (!result) return false;

    event.preventDefault();
    const nextMentions = mentionsEnabled
      ? applyTextEditToMentions(value, result.text, normalizedMentions)
      : [];
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(value, result.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(value, result.text, normalizedBolds)
      : [];
    const nextLibraryNames = libraryNameRefsEnabled
      ? applyTextEditToLibraryNameRefs(value, result.text, normalizedLibraryNameRefs)
      : [];
    emitChange(result.text, nextMentions, nextMarkers, nextBolds, result.tagRefs, nextLibraryNames);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field || !("setSelectionRange" in field)) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
    return true;
  }, [
    boldEnabled,
    emitChange,
    hasTagRefs,
    markersEnabled,
    mentionsEnabled,
    normalizedBolds,
    normalizedMarkers,
    normalizedMentions,
    normalizedTagRefs,
    syncMentionQuery,
    tagRefsEnabled,
    textareaRef,
    value,
  ]);

  const fieldClass = [
    "doc-slash-field__input",
    className,
    hideTextareaGlyphs ? "doc-slash-field__input--mentions" : "",
    hideTextareaGlyphs && !focused ? "doc-slash-field__input--mentions-idle" : "",
  ].filter(Boolean).join(" ");

  const hoveredMentionId = hoverCard?.mention?.id || null;
  const hoveredMention = hoverCard?.mention || null;
  const hoveredName = (() => {
    if (!hoveredMention) return "";
    const entryId = hoveredMention.sourceEntryId;
    if (entryId && Array.isArray(mentionCandidates)) {
      const live = mentionCandidates.find((item) => item.entryId === entryId);
      if (live?.name) return String(live.name);
    }
    return String(hoveredMention.name ?? "");
  })();

  return (
    <div
      ref={wrapRef}
      className={[
        "doc-slash-field",
        hasMentions ? "doc-slash-field--mentions" : "",
        hasTagRefs ? "doc-slash-field--tagrefs" : "",
        hasMarkers ? "doc-slash-field--markers" : "",
        hasBold ? "doc-slash-field--bolds" : "",
        hasLibraryNameRefs ? "doc-slash-field--library-names" : "",
        hoveredMentionId || hoveredTagRefId ? "doc-slash-field--chip-hover" : "",
        wrapClassName,
      ].filter(Boolean).join(" ")}
      onMouseDownCapture={handleWrapPointerDown}
      onMouseDown={handleWrapPointerDown}
      onMouseMove={handleWrapMouseMove}
      onMouseLeave={handleWrapMouseLeave}
    >
      {/* Always mount the mirror node so toggling bold/mentions never remounts
          the textarea (that wipe native undo + jumps scroll on --bold). */}
      <div
        ref={mirrorRef}
        className={
          "doc-slash-field__mirror"
          + (!focused ? " doc-slash-field__mirror--interactive" : "")
          + (!hideTextareaGlyphs ? " doc-slash-field__mirror--ink-only" : "")
        }
        aria-hidden
        hidden={!hasOverlay}
      >
        {hasOverlay ? (
          <MirrorContent
            text={value}
            mentions={normalizedMentions}
            tagRefs={normalizedTagRefs}
            libraryNameRefs={normalizedLibraryNameRefs}
            markerRanges={normalizedMarkers}
            boldRanges={normalizedBolds}
            tagRefCandidates={tagRefCandidates}
            hoveredMentionId={hoveredMentionId}
            hoveredTagRefId={hoveredTagRefId}
            onDeleteTagRef={deleteTagRef}
          />
        ) : null}
      </div>
      <textarea
        ref={attachTextareaRef}
        className={fieldClass}
        value={value}
        placeholder={showPlaceholder ? placeholder : ""}
        rows={1}
        onChange={(e) => {
          setHoverCard(null);
          setHoveredTagRefId(null);
          const nextValue = e.target.value;
          const nextMentions = mentionsEnabled
            ? applyTextEditToMentions(value, nextValue, normalizedMentions)
            : [];
          const nextTagRefs = tagRefsEnabled
            ? applyTextEditToTagRefs(value, nextValue, normalizedTagRefs)
            : [];
          const nextMarkers = markersEnabled
            ? applyTextEditToMarkerRanges(value, nextValue, normalizedMarkers)
            : [];
          const nextBolds = boldEnabled
            ? applyTextEditToBoldRanges(value, nextValue, normalizedBolds)
            : [];
          const nextLibraryNames = libraryNameRefsEnabled
            ? applyTextEditToLibraryNameRefs(value, nextValue, normalizedLibraryNameRefs)
            : [];
          const caret = e.target.selectionStart ?? 0;
          const shiftedSpeak = librarySpeakRefsEnabled
            ? applyTextEditToLibrarySpeakRefs(value, nextValue, normalizedLibrarySpeakRefs)
            : [];
          const nextSpeakRefs = librarySpeakRefsEnabled
            ? refreshSpeakDialogueBounds(nextValue, caret, shiftedSpeak)
            : undefined;
          emitChange(
            nextValue,
            nextMentions,
            nextMarkers,
            nextBolds,
            nextTagRefs,
            nextLibraryNames,
            nextSpeakRefs,
          );
          requestAnimationFrame(() => syncMentionQuery());
          if (e.target.closest(".node-query-modal__content-scroll--paged")) {
            scheduleCaretCameraScroll();
          }
        }}
        onKeyDown={(e) => {
          if (handleMentionKeyDown(e)) return;
          if (handleTagRefChipKeyDown(e)) return;
          onKeyDown?.(e);
          if (!e.defaultPrevented && CARET_CAMERA_KEYS.has(e.key)) {
            scheduleCaretCameraScroll();
            requestAnimationFrame(() => snapCaretPastBoxFootprints());
          }
        }}
        onSelect={() => {
          snapCaretPastBoxFootprints();
          syncGhostPosition();
          syncMentionQuery();
        }}
        onKeyUp={() => {
          snapCaretPastBoxFootprints();
          syncGhostPosition();
          syncMentionQuery();
        }}
        onClick={() => {
          snapCaretPastBoxFootprints();
          syncGhostPosition();
          syncMentionQuery();
        }}
        onScroll={() => {
          if (hasOverlay) syncMirrorTypography();
        }}
        onPaste={(e) => {
          onPaste?.(e);
          if (!e.defaultPrevented && onAfterPaste) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => onAfterPaste());
            });
          }
        }}
        onBlur={(e) => {
          const next = e.relatedTarget;
          if (
            next instanceof Element
            && (
              next.closest(".doc-tag-command-picker")
              || next.closest(".doc-mention-menu")
              || next.closest(".doc-tagref-menu")
            )
          ) {
            onBlur?.(e);
            return;
          }
          // Choosing a table/tag uses preventDefault; relatedTarget can be null
          // while the picker is still mounted — keep the @ session alive.
          if (
            typeof document !== "undefined"
            && (
              document.querySelector(".doc-tag-command-picker")
              || document.querySelector(".doc-mention-menu")
            )
          ) {
            onBlur?.(e);
            return;
          }
          setFocused(false);
          setActiveQuery(null);
          activeQueryRef.current = null;
          setMenuAnchor(null);
          setActiveTagRefQuery(null);
          setTagRefMenuAnchor(null);
          onBlur?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          setHoverCard(null);
          setHoveredTagRefId(null);
          onFocus?.(e);
          syncGhostPosition();
          syncMentionQuery();
        }}
        spellCheck={false}
        aria-label={ariaLabel}
        aria-expanded={showMentionMenu || showTagRefMenu || showLibraryNameMenu || showAssignPathMenu || undefined}
        aria-autocomplete={mentionsEnabled || tagRefsEnabled || libraryNameInvokeEnabled || libraryAssignEnabled ? "list" : undefined}
      />
      {showGhost && ghostPos ? (
        <span
          className="doc-slash-field__ghost-overlay"
          aria-hidden
          style={{
            left: `${ghostPos.left}px`,
            top: `${ghostPos.top}px`,
            lineHeight: `${ghostPos.lineHeight}px`,
          }}
        >
          {ghostHint}
        </span>
      ) : null}
      <DocTagCommandPicker
        open={useTagCommandPicker}
        companyObjectId={companyObjectId}
        anchor={menuAnchor}
        onClose={dismissMentionPicker}
        onSelect={insertCandidate}
      />
      <AtToolCommandPicker
        open={useAtToolPicker || forcedQloopPicker}
        companyObjectId={companyObjectId}
        anchor={menuAnchor}
        qloopCandidates={qloopCandidates || []}
        docBlocks={docBlocksForQLoop || []}
        onClose={() => {
          dismissMentionPicker();
          setForcedQloopPicker(false);
          onQloopPickerForceClose?.();
        }}
        onInsertQLoopQuery={insertQLoopSelection}
        onSelectUrlTag={insertCandidate}
        initialStep={forcedQloopPicker ? "qloops" : "root"}
      />
      <DocMentionMenu
        open={useFlatMentionMenu}
        items={filteredCandidates}
        activeIndex={menuIndex}
        anchor={menuAnchor}
        onHoverIndex={setMenuIndex}
        onSelect={insertCandidate}
        onClose={dismissMentionPicker}
      />
      <DocTagRefMenu
        open={showTagRefMenu}
        items={filteredTagRefCandidates}
        activeIndex={tagRefMenuIndex}
        anchor={tagRefMenuAnchor}
        onHoverIndex={setTagRefMenuIndex}
        onSelect={insertTagRefCandidate}
        onClose={() => {
          setActiveTagRefQuery(null);
          setTagRefMenuAnchor(null);
        }}
      />
      <DocLibraryNameMenu
        open={showLibraryNameMenu}
        items={filteredLibraryNameCandidates}
        activeIndex={libraryNameMenuIndex}
        anchor={libraryNameMenuAnchor}
        onHoverIndex={setLibraryNameMenuIndex}
        onSelect={insertLibraryNameCandidate}
        onClose={() => {
          setActiveLibraryNameQuery(null);
          setLibraryNameMenuAnchor(null);
        }}
      />
      <DocLibraryNameMenu
        open={showAssignPathMenu}
        items={filteredAssignPathItems}
        activeIndex={assignPathMenuIndex}
        anchor={assignPathMenuAnchor}
        emptyLabel={assignPathEmptyLabel}
        onHoverIndex={setAssignPathMenuIndex}
        onSelect={insertAssignPathCandidate}
        onClose={() => {
          setActiveAssignPath(null);
          setAssignPathMenuAnchor(null);
        }}
      />
      <DocMentionHoverCard
        open={Boolean(hoverCard && hasMentions)}
        anchor={hoverCard}
        name={hoveredName}
        description={hoverCard?.mention?.description}
        onMouseEnter={cancelHoverClose}
        onMouseLeave={scheduleHoverClose}
      />
    </div>
  );
}
