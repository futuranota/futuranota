import { ForecastNodeView } from "../../intel/ForecastNodeView.jsx";

const DELETE_ICON = "/uploads/delete.svg";

export function EmbeddedForecastBlockView({
  payload,
  onRemove,
  removeLabel = "Desvincular del documento",
}) {
  if (!payload) return null;

  return (
    <div className="doc-embedded-forecast">
      <div className="doc-embedded-forecast__capture" data-widget-capture-root data-widget-kind="weather-forecast">
        <ForecastNodeView payload={payload} compact={false} className="doc-embedded-forecast__body" />
      </div>
      {onRemove ? (
        <button
          type="button"
          className="doc-embedded-forecast__remove-corner"
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
        >
          <img src={DELETE_ICON} alt="" aria-hidden className="doc-embedded-forecast__remove-icon" />
        </button>
      ) : null}
    </div>
  );
}
