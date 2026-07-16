import { EmbeddedCalendarBlockView } from "./EmbeddedCalendarBlockView.jsx";
import { EmbeddedForecastBlockView } from "./EmbeddedForecastBlockView.jsx";
import { EmbeddedWidgetSnapshotView } from "./EmbeddedWidgetSnapshotView.jsx";
import { isWidgetSnapshotEmbedded } from "../../../lib/captureWidgetSnapshot.js";
import { getCalendarEventDisplayModel } from "../../../lib/calendarEventDisplay.js";
import { useI18n } from "../../../i18n/useI18n.js";

/**
 * Renders a calendar/forecast/snapshot widget above the writing surface.
 * Does not replace the textarea — parent keeps SlashAwareTextarea below.
 */
export function EmbeddedWidgetStack({
  embedded = null,
  fallbackValue = null,
  onRemove = null,
  removeLabel,
}) {
  const { t } = useI18n();
  if (!embedded) return null;

  const label = removeLabel || t("canvas.detachFromDoc");

  if (isWidgetSnapshotEmbedded(embedded)) {
    return (
      <div className="doc-embedded-widget-stack">
        <EmbeddedWidgetSnapshotView
          src={embedded.src}
          alt={embedded.alt || t("canvas.widgetSnapshotAlt")}
          onRemove={onRemove}
          removeLabel={t("canvas.removeWidgetSnapshot")}
        />
      </div>
    );
  }

  if (embedded.kind === "calendar-event") {
    const displayModel = embedded.displayModel
      || getCalendarEventDisplayModel(fallbackValue);
    if (!displayModel) return null;
    return (
      <div className="doc-embedded-widget-stack">
        <EmbeddedCalendarBlockView
          displayModel={displayModel}
          onRemove={onRemove}
          removeLabel={label}
        />
      </div>
    );
  }

  if (embedded.kind === "weather-forecast" && embedded.payload) {
    return (
      <div className="doc-embedded-widget-stack">
        <EmbeddedForecastBlockView
          payload={embedded.payload}
          onRemove={onRemove}
          removeLabel={label}
        />
      </div>
    );
  }

  return null;
}

/**
 * @param {object|null|undefined} embedded
 * @param {unknown} [fallbackValue]
 */
export function hasRenderableEmbeddedWidget(embedded, fallbackValue = null) {
  if (!embedded) return false;
  if (isWidgetSnapshotEmbedded(embedded)) return true;
  if (embedded.kind === "calendar-event") {
    return Boolean(
      embedded.displayModel || getCalendarEventDisplayModel(fallbackValue),
    );
  }
  if (embedded.kind === "weather-forecast") {
    return Boolean(embedded.payload);
  }
  return false;
}
