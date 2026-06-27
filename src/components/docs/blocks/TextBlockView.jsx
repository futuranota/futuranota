import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";
import { EmbeddedCalendarBlockView } from "./EmbeddedCalendarBlockView.jsx";
import { LinkedNodeDocActions } from "./LinkedNodeDocActions.jsx";
import { isCalendarEventNodeContent } from "../../../lib/eventCalendarSearch.js";
import { getCalendarEventDisplayModel } from "../../../lib/calendarEventDisplay.js";
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
}) {
  const { t } = useI18n();
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
      {onDetachFromNode ? (
        <LinkedNodeDocActions
          onDetach={onDetachFromNode}
          label={detachFromNodeLabel || t("canvas.removeFromNode")}
        />
      ) : null}
    </div>
  );
}
