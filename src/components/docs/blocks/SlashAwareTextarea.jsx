import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOC_SLASH_GHOST_HINTS, getSlashTail, splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import {
  applyTextEditToMentions,
  getMentionQueryAtCaret,
  insertMentionAtQuery,
  normalizeMentions,
} from "../../../lib/docMentions.js";
import {
  applyTextEditToMarkerRanges,
  normalizeMarkerRanges,
} from "../../../lib/docTextMarkerRanges.js";
import {
  applyTextEditToBoldRanges,
  normalizeBoldRanges,
} from "../../../lib/docTextBoldRanges.js";
import { markerStrokeSeed } from "../../../lib/docTextMarkerColors.js";
import { buildMirrorSegments } from "../../../lib/docTextMirrorSegments.js";
import { filterTagCandidates } from "../../../lib/urlTableTags.js";
import { openUrlTableForMention } from "../../../lib/docMentionActions.js";
import {
  copyTextareaTypography,
  getCaretClientRect,
  resolveSlashGhostOverlayPosition,
  scrollTextareaCaretIntoCameraView,
} from "../../../lib/textareaSelectionRect.js";
import { DocMentionHoverCard } from "./DocMentionHoverCard.jsx";
import { DocMentionMenu } from "./DocMentionMenu.jsx";

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

function collapseDuplicateSlashTail(value) {
  const tail = getSlashTail(value);
  if (!tail || !tail.startsWith("//")) return value;
  const { prefix } = splitBodyForSlash(value);
  const fixedTail = "/" + tail.replace(/^\/+/, "");
  return prefix + fixedTail;
}

function MirrorContent({ text, mentions, markerRanges, boldRanges, hoveredId = null }) {
  const segments = buildMirrorSegments(text, mentions, markerRanges, boldRanges);
  return segments.map((segment, index) => {
    if (!segment.text) return null;

    // Clicks are resolved by rect hit-testing on the wrap (works focused
    // and blurred); the span itself carries no handlers.
    let inner = segment.mention ? (
      <span
        className={
          "doc-slash-field__mention"
          + (hoveredId && segment.mention.id === hoveredId
            ? " doc-slash-field__mention--hovered"
            : "")
        }
        data-mention-id={segment.mention.id}
      >
        {segment.text}
      </span>
    ) : segment.text;

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

    if (segment.mention || segment.bold) {
      return <span key={segment.mention?.id || index}>{inner}</span>;
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
  markerRanges = null,
  boldRanges = null,
}) {
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
  const [hintIndex, setHintIndex] = useState(0);
  const [ghostPos, setGhostPos] = useState(null);
  const [focused, setFocused] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activeQuery, setActiveQuery] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);

  // null/undefined candidates => company missing; @ stays plain text.
  const mentionsEnabled = Array.isArray(mentionCandidates);
  const hasCandidateSource = mentionsEnabled;
  const normalizedMentions = useMemo(
    () => (mentionsEnabled ? normalizeMentions(value, mentions) : []),
    [mentions, mentionsEnabled, value],
  );
  const hasMentions = normalizedMentions.length > 0;

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
  // Mirror overlay for chips, ink, and/or faux-bold glyphs.
  const hasOverlay = hasMentions || hasMarkers || hasBold;
  // Glyph overlays require transparent textarea text (same as mentions).
  const hideTextareaGlyphs = hasMentions || hasBold;

  const { slash } = splitBodyForSlash(value);
  const showGhost = Boolean(slash) && /^\/\s*$/.test(slash) && !activeQuery;

  const filteredCandidates = useMemo(() => {
    if (!hasCandidateSource || !activeQuery) return [];
    return filterTagCandidates(mentionCandidates, activeQuery.query).slice(0, 8);
  }, [activeQuery, hasCandidateSource, mentionCandidates]);

  const showMentionMenu = Boolean(
    focused && hasCandidateSource && activeQuery && !showGhost,
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

  const syncMentionQuery = useCallback(() => {
    const el = textareaRef.current;
    // React's `focused` state can go stale when the field is focused
    // programmatically (focusBlockById, slash flows, remounts). Trust the DOM.
    const domFocused = Boolean(
      el && typeof document !== "undefined" && document.activeElement === el,
    );
    if (domFocused !== focused) setFocused(domFocused);
    if (!hasCandidateSource || !domFocused || !el) {
      setActiveQuery(null);
      setMenuAnchor(null);
      return;
    }
    const caret = el.selectionStart ?? 0;
    if ((el.selectionEnd ?? caret) !== caret) {
      setActiveQuery(null);
      setMenuAnchor(null);
      return;
    }
    const query = getMentionQueryAtCaret(el.value, caret);
    setActiveQuery(query);
    if (!query) {
      setMenuAnchor(null);
      return;
    }
    const rect = getCaretClientRect(el, query.start);
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 18;
    setMenuAnchor({
      top: Math.min(window.innerHeight - 12, rect.bottom + 6),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
      lineHeight,
    });
  }, [focused, hasCandidateSource, textareaRef]);

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

  // Chips live in the mirror, which is pointer-events:none while the field is
  // focused — so both hover and click are resolved by hit-testing the mention
  // span rects against the pointer position (works focused and blurred).
  const findMentionSpanAtPoint = useCallback((x, y) => {
    const mirror = mirrorRef.current;
    if (!mirror) return null;
    for (const span of mirror.querySelectorAll("[data-mention-id]")) {
      for (const rect of span.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return span;
        }
      }
    }
    return null;
  }, []);

  const handleWrapPointerDown = useCallback(
    (event) => {
      // Chip click = link: open the entry's URL table with the tag prefilled
      // in the search filter. Beats caret placement even while focused.
      if (hasMentions && event.button === 0) {
        const span = findMentionSpanAtPoint(event.clientX, event.clientY);
        const mentionId = span?.getAttribute("data-mention-id");
        const mention = mentionId
          ? normalizedMentions.find((item) => item.id === mentionId)
          : null;
        if (mention) {
          event.preventDefault();
          event.stopPropagation();
          setHoverCard(null);
          openUrlTableForMention(mention);
          return;
        }
      }
      const el = textareaRef.current;
      if (!el || event.target === el) return;
      event.preventDefault();
      focusField(true);
    },
    [findMentionSpanAtPoint, focusField, hasMentions, normalizedMentions, textareaRef],
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
    if (!hasMentions) return;
    const hitSpan = findMentionSpanAtPoint(event.clientX, event.clientY);
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
  }, [cancelHoverClose, findMentionSpanAtPoint, hasMentions, normalizedMentions, scheduleHoverClose]);

  const handleWrapMouseLeave = useCallback(() => {
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
    el.style.height = "auto";
    const measured = el.scrollHeight;
    const next = Math.min(Math.max(measured, minHeightPx), heightCap);
    if (Math.abs(el.offsetHeight - next) > 1) {
      el.style.height = `${next}px`;
    }
    el.style.overflowY = measured > next + 1 ? "auto" : "hidden";
    if (hasOverlay) syncMirrorTypography();
  }, [hasOverlay, heightCap, isFieldVisible, minHeightPx, syncMirrorTypography, textareaRef]);

  useLayoutEffect(() => {
    syncHeight(true);
    syncGhostPosition();
    if (hasOverlay) syncMirrorTypography();
  }, [value, hasOverlay, syncHeight, syncGhostPosition, syncMirrorTypography, normalizedMentions, normalizedMarkers, normalizedBolds]);

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
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus, textareaRef]);

  useLayoutEffect(() => {
    if (!showMentionMenu) return;
    syncMentionQuery();
  }, [showMentionMenu, value, syncMentionQuery]);

  const emitChange = useCallback((nextValue, nextMentions, nextMarkers, nextBolds) => {
    const collapsed = collapseDuplicateSlashTail(nextValue);
    let mentionsOut = nextMentions;
    let markersOut = nextMarkers;
    let boldsOut = nextBolds;
    if (collapsed !== nextValue) {
      if (mentionsEnabled) {
        mentionsOut = applyTextEditToMentions(nextValue, collapsed, nextMentions);
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
    const normalizedMarkersOut = markersEnabled
      ? normalizeMarkerRanges(collapsed, markersOut)
      : [];
    const normalizedBoldsOut = boldEnabled
      ? normalizeBoldRanges(collapsed, boldsOut)
      : [];
    const meta = {
      ...(mentionsEnabled ? { mentions: normalized } : {}),
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
    onAfterInput?.();
  }, [boldEnabled, markersEnabled, mentionsEnabled, onAfterInput, onChange, onMentionsChange]);

  const insertCandidate = useCallback((candidate) => {
    if (!candidate || !activeQuery) return;
    const result = insertMentionAtQuery(value, normalizedMentions, activeQuery, candidate);
    const nextMarkers = markersEnabled
      ? applyTextEditToMarkerRanges(value, result.text, normalizedMarkers)
      : [];
    const nextBolds = boldEnabled
      ? applyTextEditToBoldRanges(value, result.text, normalizedBolds)
      : [];
    emitChange(result.text, result.mentions, nextMarkers, nextBolds);
    setActiveQuery(null);
    setMenuAnchor(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el || !("setSelectionRange" in el)) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
  }, [activeQuery, boldEnabled, emitChange, markersEnabled, normalizedBolds, normalizedMarkers, normalizedMentions, syncMentionQuery, textareaRef, value]);

  const handleMentionKeyDown = useCallback((event) => {
    if (!showMentionMenu) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      setActiveQuery(null);
      setMenuAnchor(null);
      return true;
    }
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
  }, [filteredCandidates, insertCandidate, menuIndex, showMentionMenu]);

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
        hasMarkers ? "doc-slash-field--markers" : "",
        hasBold ? "doc-slash-field--bolds" : "",
        hoveredMentionId ? "doc-slash-field--chip-hover" : "",
        wrapClassName,
      ].filter(Boolean).join(" ")}
      onMouseDown={handleWrapPointerDown}
      onMouseMove={handleWrapMouseMove}
      onMouseLeave={handleWrapMouseLeave}
    >
      {hasOverlay ? (
        <div
          ref={mirrorRef}
          className={
            "doc-slash-field__mirror"
            + (!focused ? " doc-slash-field__mirror--interactive" : "")
            + (!hideTextareaGlyphs ? " doc-slash-field__mirror--ink-only" : "")
          }
          aria-hidden
        >
          <MirrorContent
            text={value}
            mentions={normalizedMentions}
            markerRanges={normalizedMarkers}
            boldRanges={normalizedBolds}
            hoveredId={hoveredMentionId}
          />
        </div>
      ) : null}
      <textarea
        ref={attachTextareaRef}
        className={fieldClass}
        value={value}
        placeholder={showPlaceholder ? placeholder : ""}
        rows={1}
        onChange={(e) => {
          setHoverCard(null);
          const nextValue = e.target.value;
          const nextMentions = mentionsEnabled
            ? applyTextEditToMentions(value, nextValue, normalizedMentions)
            : [];
          const nextMarkers = markersEnabled
            ? applyTextEditToMarkerRanges(value, nextValue, normalizedMarkers)
            : [];
          const nextBolds = boldEnabled
            ? applyTextEditToBoldRanges(value, nextValue, normalizedBolds)
            : [];
          emitChange(nextValue, nextMentions, nextMarkers, nextBolds);
          requestAnimationFrame(() => syncMentionQuery());
        }}
        onKeyDown={(e) => {
          if (handleMentionKeyDown(e)) return;
          onKeyDown?.(e);
          if (!e.defaultPrevented && CARET_CAMERA_KEYS.has(e.key)) {
            scheduleCaretCameraScroll();
          }
        }}
        onSelect={() => {
          syncGhostPosition();
          syncMentionQuery();
        }}
        onKeyUp={() => {
          syncGhostPosition();
          syncMentionQuery();
        }}
        onClick={() => {
          syncGhostPosition();
          syncMentionQuery();
        }}
        onScroll={() => {
          if (hasOverlay) syncMirrorTypography();
        }}
        onPaste={onPaste}
        onBlur={(e) => {
          setFocused(false);
          setActiveQuery(null);
          setMenuAnchor(null);
          onBlur?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          setHoverCard(null);
          onFocus?.(e);
          syncGhostPosition();
          syncMentionQuery();
        }}
        spellCheck={false}
        aria-label={ariaLabel}
        aria-expanded={showMentionMenu || undefined}
        aria-autocomplete={mentionsEnabled ? "list" : undefined}
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
      <DocMentionMenu
        open={showMentionMenu}
        items={filteredCandidates}
        activeIndex={menuIndex}
        anchor={menuAnchor}
        onHoverIndex={setMenuIndex}
        onSelect={insertCandidate}
        onClose={() => {
          setActiveQuery(null);
          setMenuAnchor(null);
        }}
      />
      <DocMentionHoverCard
        open={Boolean(hoverCard && hasMentions)}
        anchor={hoverCard}
        tag={hoverCard?.mention?.tag}
        name={hoveredName}
        description={hoverCard?.mention?.description}
        onMouseEnter={cancelHoverClose}
        onMouseLeave={scheduleHoverClose}
      />
    </div>
  );
}
