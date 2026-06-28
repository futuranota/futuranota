export function EmbeddedWidgetSnapshotView({
  src,
  alt = "Widget snapshot",
  onRemove,
  removeLabel = "Eliminar imagen",
}) {
  if (!src) return null;

  return (
    <div className="doc-widget-snapshot">
      <img
        className="doc-widget-snapshot__img"
        src={src}
        alt={alt}
        draggable={false}
      />
      {onRemove ? (
        <div className="doc-widget-snapshot__actions">
          <button
            type="button"
            className="doc-widget-snapshot__remove btn xs ghost"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
