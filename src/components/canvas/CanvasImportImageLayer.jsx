export function CanvasImportImageLayer({
  image,
  onEmbed,
  onRemove,
  t,
}) {
  const embedded = Boolean(image.embedded);

  return (
    <div
      className={
        "canvas-import-image"
        + (embedded ? " canvas-import-image--embedded" : " canvas-import-image--locked")
      }
      style={{
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
      }}
      onPointerDown={(e) => {
        if (!embedded) e.stopPropagation();
      }}
    >
      <img
        src={image.src}
        alt={image.name}
        className="canvas-import-image__img"
        draggable={false}
      />
      {!embedded ? (
        <>
          <div className="canvas-import-image__lock-scrim" aria-hidden />
          <button
            type="button"
            className="canvas-import-image__embed-cta"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEmbed();
            }}
          >
            <span className="canvas-import-image__embed-cta-title">
              {t("canvas.importImageEmbed")}
            </span>
            <span className="canvas-import-image__embed-cta-sub">
              {t("canvas.importImageEmbedHint")}
            </span>
          </button>
          <button
            type="button"
            className="canvas-import-image__remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title={t("canvas.importImageRemove")}
          >
            ×
          </button>
        </>
      ) : null}
    </div>
  );
}
