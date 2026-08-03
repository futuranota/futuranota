import { useCallback, useLayoutEffect, useRef } from "react";
import { computeTextEditDelta, rangesToSegments, shiftBoldRanges } from "../../../lib/docTextBoldRanges.js";
import {
  copyTextareaTypography,
  syncAutoGrowTextareaHeight,
} from "../../../lib/textareaSelectionRect.js";

function BoldMirrorContent({ text, boldRanges }) {
  const segments = rangesToSegments(text, boldRanges);
  return segments.map((segment, index) => {
    if (!segment.text) return null;
    if (segment.type === "bold") {
      return <strong key={index}>{segment.text}</strong>;
    }
    return <span key={index}>{segment.text}</span>;
  });
}

export function BoldMirrorTextarea({
  value = "",
  boldRanges = [],
  onChange,
  onKeyDown,
  onMouseDown,
  onPaste,
  onFocus,
  autoFocus = false,
  className = "",
  wrapClassName = "",
  placeholder = "",
  rows = 1,
  inputRef,
}) {
  const internalRef = useRef(null);
  const mirrorRef = useRef(null);
  const textareaRef = inputRef || internalRef;
  const hasBold = Array.isArray(boldRanges) && boldRanges.length > 0;

  useLayoutEffect(() => {
    if (!autoFocus) return undefined;
    const el = textareaRef.current;
    el?.focus({ preventScroll: true });
    return undefined;
  }, [autoFocus, textareaRef]);

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
    mirror.style.pointerEvents = "none";
    mirror.style.color = style.color;
    mirror.style.zIndex = "0";
    mirror.scrollTop = el.scrollTop;
  }, [textareaRef]);

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    syncAutoGrowTextareaHeight(el);
    syncMirrorTypography();
  }, [syncMirrorTypography, textareaRef]);

  const syncScroll = useCallback(() => {
    syncMirrorTypography();
  }, [syncMirrorTypography]);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, boldRanges, syncHeight, hasBold]);

  useLayoutEffect(() => {
    if (!hasBold) return undefined;
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => syncMirrorTypography());
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasBold, syncMirrorTypography, textareaRef]);

  const handleChange = (event) => {
    const nextText = event.target.value;
    const prevText = value ?? "";
    if (hasBold && prevText !== nextText) {
      const { editStart, removedLength, insertedLength } = computeTextEditDelta(prevText, nextText);
      const nextRanges = shiftBoldRanges(
        boldRanges,
        editStart,
        removedLength,
        insertedLength,
        nextText.length,
      );
      onChange?.(nextText, nextRanges);
      return;
    }
    onChange?.(nextText, boldRanges);
  };

  const wrapClass = ["bold-mirror-textarea", wrapClassName].filter(Boolean).join(" ");
  const fieldClass = ["bold-mirror-textarea__input", className].filter(Boolean).join(" ");

  return (
    <div className={wrapClass}>
      {/* Stable mirror sibling — toggling bold must not remount the textarea
          (native undo / caret scroll). */}
      <div
        ref={mirrorRef}
        className="bold-mirror-textarea__mirror"
        aria-hidden
        hidden={!hasBold}
      >
        {hasBold ? (
          <BoldMirrorContent text={value} boldRanges={boldRanges} />
        ) : null}
      </div>
      <textarea
        ref={textareaRef}
        className={fieldClass + (hasBold ? " bold-mirror-textarea__input--overlay" : "")}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onPaste={onPaste}
        onFocus={onFocus}
        onScroll={syncScroll}
        spellCheck={false}
      />
    </div>
  );
}
