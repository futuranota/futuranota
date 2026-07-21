import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DOC_SLASH_GHOST_HINTS, getSlashTail, splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import {
  applyTextEditToMentions,
  getMentionQueryAtCaret,
  insertMentionAtQuery,
  mentionsToSegments,
  normalizeMentions,
} from "../../../lib/docMentions.js";
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

function MentionMirrorContent({ text, mentions, interactive }) {
  const segments = mentionsToSegments(text, mentions);
  return segments.map((segment, index) => {
    if (!segment.text) return null;
    if (segment.type === "mention" && segment.mention) {
      const url = String(segment.mention.url || "").trim();
      return (
        <span
          key={segment.mention.id || index}
          className={
            "doc-slash-field__mention"
            + (interactive && url ? " doc-slash-field__mention--linked" : "")
          }
          data-mention-id={segment.mention.id}
          onMouseDown={interactive && url ? (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(url, "_blank", "noopener,noreferrer");
          } : undefined}
        >
          {segment.text}
        </span>
      );
    }
    return <span key={index}>{segment.text}</span>;
  });
}

/**
 * Textarea for slash commands at end of a line.
 * Optional company @tag mentions: autocomplete + pink mirror + hover card.
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

  const handleWrapPointerDown = useCallback(
    (event) => {
      const el = textareaRef.current;
      if (!el || event.target === el) return;
      // Allow hover interactions on mention spans while blurred.
      if (
        !focused
        && event.target instanceof Element
        && event.target.closest(".doc-slash-field__mention")
      ) {
        return;
      }
      event.preventDefault();
      focusField(true);
    },
    [focusField, focused, textareaRef],
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
    const mirror = mirrorRef.current;
    if (!mirror) return;
    const x = event.clientX;
    const y = event.clientY;
    let hitSpan = null;
    for (const span of mirror.querySelectorAll("[data-mention-id]")) {
      for (const rect of span.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          hitSpan = span;
          break;
        }
      }
      if (hitSpan) break;
    }
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
  }, [cancelHoverClose, hasMentions, normalizedMentions, scheduleHoverClose]);

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
    if (hasMentions) syncMirrorTypography();
  }, [hasMentions, heightCap, isFieldVisible, minHeightPx, syncMirrorTypography, textareaRef]);

  useLayoutEffect(() => {
    syncHeight(true);
    syncGhostPosition();
    if (hasMentions) syncMirrorTypography();
  }, [value, hasMentions, syncHeight, syncGhostPosition, syncMirrorTypography, normalizedMentions]);

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

  const emitChange = useCallback((nextValue, nextMentions) => {
    const collapsed = collapseDuplicateSlashTail(nextValue);
    let mentionsOut = nextMentions;
    if (collapsed !== nextValue && mentionsEnabled) {
      mentionsOut = applyTextEditToMentions(nextValue, collapsed, nextMentions);
    }
    const normalized = mentionsEnabled
      ? normalizeMentions(collapsed, mentionsOut)
      : [];
    // Second arg lets parents patch text + mentions in one updateAt (avoids races).
    onChange(
      collapsed,
      mentionsEnabled ? { mentions: normalized } : undefined,
    );
    if (mentionsEnabled) {
      onMentionsChange?.(normalized);
    }
    onAfterInput?.();
  }, [mentionsEnabled, onAfterInput, onChange, onMentionsChange]);

  const insertCandidate = useCallback((candidate) => {
    if (!candidate || !activeQuery) return;
    const result = insertMentionAtQuery(value, normalizedMentions, activeQuery, candidate);
    emitChange(result.text, result.mentions);
    setActiveQuery(null);
    setMenuAnchor(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el || !("setSelectionRange" in el)) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(result.caret, result.caret);
      syncMentionQuery();
    });
  }, [activeQuery, emitChange, normalizedMentions, syncMentionQuery, textareaRef, value]);

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
    hasMentions ? "doc-slash-field__input--mentions" : "",
    hasMentions && !focused ? "doc-slash-field__input--mentions-idle" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={wrapRef}
      className={`doc-slash-field ${hasMentions ? "doc-slash-field--mentions" : ""} ${wrapClassName}`.trim()}
      onMouseDown={handleWrapPointerDown}
      onMouseMove={handleWrapMouseMove}
      onMouseLeave={handleWrapMouseLeave}
    >
      {hasMentions ? (
        <div
          ref={mirrorRef}
          className={
            "doc-slash-field__mirror"
            + (!focused ? " doc-slash-field__mirror--interactive" : "")
          }
          aria-hidden
        >
          <MentionMirrorContent
            text={value}
            mentions={normalizedMentions}
            interactive={!focused}
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
          if (mentionsEnabled) {
            const nextMentions = applyTextEditToMentions(value, nextValue, normalizedMentions);
            emitChange(nextValue, nextMentions);
          } else {
            emitChange(nextValue, []);
          }
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
          if (hasMentions) syncMirrorTypography();
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
        description={hoverCard?.mention?.description}
        url={hoverCard?.mention?.url}
        onMouseEnter={cancelHoverClose}
        onMouseLeave={scheduleHoverClose}
        onOpenTable={hoverCard?.mention ? () => {
          const mention = hoverCard.mention;
          setHoverCard(null);
          cancelHoverClose();
          openUrlTableForMention(mention);
        } : null}
      />
    </div>
  );
}
