import { useRef } from "react";
import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";
import { EmbeddedCalendarBlockView } from "./EmbeddedCalendarBlockView.jsx";
import { EmbeddedForecastBlockView } from "./EmbeddedForecastBlockView.jsx";
import { EmbeddedWidgetSnapshotView } from "./EmbeddedWidgetSnapshotView.jsx";
import { isWidgetSnapshotEmbedded } from "../../../lib/captureWidgetSnapshot.js";
import { LinkedNodeDocActions } from "./LinkedNodeDocActions.jsx";
import { AnimatedReportText } from "../../intel/AnimatedReportText.jsx";
import { ReportMarkdownBody } from "../../intel/ReportMarkdownBody.jsx";
import { isCalendarEventNodeContent } from "../../../lib/eventCalendarSearch.js";
import { getCalendarEventDisplayModel } from "../../../lib/calendarEventDisplay.js";
import { splitBodyForSlash } from "../../../lib/docBlockSlash.js";
import { useI18n } from "../../../i18n/useI18n.js";

export function TextBlockView({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onPaste,
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
  continuationMentions = null,
  onContinuationMentionsChange = null,
  continuationTagRefs = null,
  onContinuationTagRefsChange = null,
  continuationMarkerRanges = null,
  continuationBoldRanges = null,
  analystReportStyle = false,
  reportAnimate = false,
  onReportAnimationComplete = null,
  reportStaticView = false,
  onSelectAllRequest = null,
  ghostHints,
  mentions = null,
  onMentionsChange = null,
  mentionCandidates = null,
  tagRefs = null,
  onTagRefsChange = null,
  tagRefCandidates = null,
  markerRanges = null,
  boldRanges = null,
}) {
  const { t } = useI18n();
  const continuationRef = useRef(null);
  const hasInlineContinuation = onContinuationChange != null;

  const handleReportSelectAllKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a") return;
    e.preventDefault();
    onSelectAllRequest?.(e.currentTarget);
  };

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

  if (isWidgetSnapshotEmbedded(embedded)) {
    return (
      <div className="doc-text-block doc-text-block--embedded">
        <EmbeddedWidgetSnapshotView
          src={embedded.src}
          alt={embedded.alt || t("canvas.widgetSnapshotAlt")}
          onRemove={onRemoveEmbedded}
          removeLabel={t("canvas.removeWidgetSnapshot")}
        />
      </div>
    );
  }

  if (embedded?.kind === "calendar-event") {
    const displayModel = embedded.displayModel || getCalendarEventDisplayModel(value);
    if (displayModel) {
      return (
        <div className="doc-text-block doc-text-block--embedded">
          <EmbeddedCalendarBlockView
            displayModel={displayModel}
            onRemove={onRemoveEmbedded}
            removeLabel={t("canvas.detachFromDoc")}
          />
        </div>
      );
    }
  }

  if (embedded?.kind === "weather-forecast" && embedded.payload) {
    return (
      <div className="doc-text-block doc-text-block--embedded">
        <EmbeddedForecastBlockView
          payload={embedded.payload}
          onRemove={onRemoveEmbedded}
          removeLabel={t("canvas.detachFromDoc")}
        />
      </div>
    );
  }

  if (legacyCalendarModel) {
    return (
      <div className="doc-text-block doc-text-block--embedded">
        <EmbeddedCalendarBlockView
          displayModel={legacyCalendarModel}
          onRemove={onRemoveEmbedded}
          removeLabel={t("canvas.detachFromDoc")}
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
      <div
        className={rootClass}
        tabIndex={0}
        role="article"
        onKeyDown={handleReportSelectAllKeyDown}
      >
        <AnimatedReportText
          text={value || ""}
          onComplete={onReportAnimationComplete}
        />
      </div>
    );
  }

  if (reportStaticView) {
    return (
      <div
        className={rootClass}
        tabIndex={0}
        role="article"
        onKeyDown={handleReportSelectAllKeyDown}
      >
        <ReportMarkdownBody
          text={value || ""}
          className="doc-marketing-guide"
          imageFillWidth
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
        onPaste={onPaste}
        onFocus={onFocus}
        onAfterInput={onAfterInput}
        placeholder={placeholder}
        showPlaceholder={showPlaceholder}
        autoFocus={autoFocus}
        wrapClassName={reportWrapClass}
        className={reportFieldClass}
        minHeightPx={28}
        maxHeightPx={maxHeightPx}
        ghostHints={ghostHints}
        mentions={mentions}
        onMentionsChange={onMentionsChange}
        mentionCandidates={mentionCandidates}
        tagRefs={Array.isArray(tagRefCandidates) ? (tagRefs || []) : null}
        onTagRefsChange={onTagRefsChange}
        tagRefCandidates={tagRefCandidates}
        markerRanges={markerRanges}
        boldRanges={boldRanges}
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
          ghostHints={ghostHints}
          mentions={continuationMentions}
          onMentionsChange={onContinuationMentionsChange}
          mentionCandidates={mentionCandidates}
          tagRefs={Array.isArray(tagRefCandidates) ? (continuationTagRefs || []) : null}
          onTagRefsChange={onContinuationTagRefsChange}
          tagRefCandidates={tagRefCandidates}
          markerRanges={continuationMarkerRanges}
          boldRanges={continuationBoldRanges}
        />
      ) : null}
    </div>
  );
}
