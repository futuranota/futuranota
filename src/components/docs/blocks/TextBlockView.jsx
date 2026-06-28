import { useRef } from "react";
import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";
import { EmbeddedCalendarBlockView } from "./EmbeddedCalendarBlockView.jsx";
import { LinkedNodeDocActions } from "./LinkedNodeDocActions.jsx";
import { AnimatedReportText } from "../../intel/AnimatedReportText.jsx";
import { isCalendarEventNodeContent } from "../../../lib/eventCalendarSearch.js";
import { getCalendarEventDisplayModel } from "../../../lib/calendarEventDisplay.js";
import { splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import { useI18n } from "../../../i18n/useI18n.js";

export function TextBlockView({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onAfterInput,
  placeholder,
  autoFocus = false,
  showPlaceholder = true,
  maxHeightPx = null,
  embedded = null,
  linkedNodeId = null,
  onRemoveEmbedded = null,
  onEditEmbedded = null,
  onDetachFromNode = null,
  detachFromNodeLabel,
  wrapClassName = "",
  continuationValue = null,
  onContinuationChange = null,
  onContinuationKeyDown = null,
  onContinuationFocus = null,
  continuationPlaceholder = "",
  continuationAutoFocus = false,
  analystReportStyle = false,
  reportAnimate = false,
  onReportAnimationComplete = null,
}) {
  const { t } = useI18n();
  const continuationRef = useRef(null);
  const hasInlineContinuation = onContinuationChange != null;

  const legacyCalendarModel = !embedded?.displayModel && isCalendarEventNodeContent(value)
    ? getCalendarEventDisplayModel(value)
    : null;

  const focusContinuation = () => {
    const el = continuationRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if ("setSelectionRange" in el) {
      const pos = el.value.length;
      el.setSelectionRange(pos, pos);
    }
  };

  const handleAnswerKeyDown = (e) => {
    if (hasInlineContinuation && e.key === "Enter" && !e.shiftKey) {
      const el = e.currentTarget;
      const caretStart = el.selectionStart ?? 0;
      const caretEnd = el.selectionEnd ?? caretStart;
      const atEnd = caretStart === el.value.length && caretEnd === el.value.length;
      const { slash } = splitBodyForSlash(el.value ?? "");
      if (atEnd && !slash) {
        e.preventDefault();
        focusContinuation();
        return;
      }
    }
    onKeyDown?.(e);
  };

  if (embedded?.kind === "calendar-event" && embedded.displayModel) {
    return (
      <div className="doc-text-block doc-text-block--embedded">
        <EmbeddedCalendarBlockView
          displayModel={embedded.displayModel}
          linkedNodeId={linkedNodeId ?? embedded.linkedNodeId ?? null}
          onRemove={onRemoveEmbedded}
          onEditAsText={onEditEmbedded}
          removeLabel={t("canvas.removeFromDoc")}
          editLabel={t("canvas.editAsText")}
        />
      </div>
    );
  }

  if (legacyCalendarModel) {
    return (
      <div className="doc-text-block doc-text-block--embedded">
        <EmbeddedCalendarBlockView
          displayModel={legacyCalendarModel}
          linkedNodeId={linkedNodeId}
          onRemove={onRemoveEmbedded}
          onEditAsText={onEditEmbedded}
          removeLabel={t("canvas.removeFromDoc")}
          editLabel={t("canvas.editAsText")}
        />
      </div>
    );
  }

  const rootClass = [
    "doc-text-block",
    hasInlineContinuation ? "doc-text-block--linked-bundle" : "",
    analystReportStyle ? "doc-text-block--analyst-report" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const reportWrapClass = [
    "doc-text-block__wrap",
    analystReportStyle ? "doc-analyst-report" : "",
    wrapClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const reportFieldClass = [
    "doc-text-block__field",
    "doc-text-block__field--node-answer",
    analystReportStyle ? "doc-analyst-report" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (reportAnimate) {
    return (
      <div className={rootClass}>
        <AnimatedReportText
          text={value || ""}
          onComplete={onReportAnimationComplete}
        />
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <SlashAwareTextarea
        value={value}
        onChange={onChange}
        onKeyDown={handleAnswerKeyDown}
        onFocus={onFocus}
        onAfterInput={onAfterInput}
        placeholder={placeholder}
        showPlaceholder={showPlaceholder}
        autoFocus={autoFocus}
        wrapClassName={reportWrapClass}
        className={reportFieldClass}
        minHeightPx={28}
        maxHeightPx={maxHeightPx}
      />
      {onDetachFromNode ? (
        <LinkedNodeDocActions
          onDetach={onDetachFromNode}
          label={detachFromNodeLabel || t("canvas.removeFromNode")}
        />
      ) : null}
      {hasInlineContinuation ? (
        <SlashAwareTextarea
          inputRef={continuationRef}
          value={continuationValue ?? ""}
          onChange={onContinuationChange}
          onKeyDown={onContinuationKeyDown}
          onFocus={onContinuationFocus}
          placeholder={continuationPlaceholder}
          showPlaceholder
          autoFocus={continuationAutoFocus}
          wrapClassName="doc-text-block__wrap doc-text-block__wrap--continuation"
          className="doc-text-block__field doc-text-block__field--continuation"
          minHeightPx={28}
          maxHeightPx={maxHeightPx}
        />
      ) : null}
    </div>
  );
}
