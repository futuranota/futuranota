import { ForecastNodeView } from "../../intel/ForecastNodeView.jsx";

export function EmbeddedForecastBlockView({
  payload,
  onRemove,
  removeLabel = "Desvincular del documento",
}) {
  if (!payload) return null;

  return (
    <div className="doc-embedded-forecast">
      <div className="doc-embedded-forecast__capture" data-widget-capture-root>
        <ForecastNodeView payload={payload} compact={false} className="doc-embedded-forecast__body" />
      </div>
      {onRemove ? (
        <div className="doc-embedded-forecast__actions">
          <button
            type="button"
            className="doc-embedded-forecast__remove btn xs ghost"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
