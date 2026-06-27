import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";
import { EmbeddedCalendarBlockView } from "./EmbeddedCalendarBlockView.jsx";
import { isCalendarEventNodeContent } from "../../../lib/eventCalendarSearch.js";
import { getCalendarEventDisplayModel } from "../../../lib/calendarEventDisplay.js";

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
}) {
  const legacyCalendarModel = !embedded?.displayModel && isCalendarEventNodeContent(value)
    ? getCalendarEventDisplayModel(value)
    : null;

  if (embedded?.kind === "calendar-event" && embedded.displayModel) {
    return (
      <div className="doc-text-block doc-text-block--embedded">
        <EmbeddedCalendarBlockView
          displayModel={embedded.displayModel}
          linkedNodeId={linkedNodeId ?? embedded.linkedNodeId ?? null}
          onRemove={onRemoveEmbedded}
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
        />
      </div>
    );
  }

  return (
    <div className="doc-text-block">
      <SlashAwareTextarea
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onAfterInput={onAfterInput}
        placeholder={placeholder}
        showPlaceholder={showPlaceholder}
        autoFocus={autoFocus}
        wrapClassName="doc-text-block__wrap"
        className="doc-text-block__field"
        minHeightPx={28}
        maxHeightPx={maxHeightPx}
      />
    </div>
  );
}
