import { useI18n } from "../../../i18n/useI18n.js";

/**
 * Moodboard-style media chrome: Cambiar · Guardar/Editar · Quitar.
 * Shown on image cards, banners, and specs cards (including empty insert state).
 */
export function DocCardMediaActions({
  isEdit,
  canSave,
  showChange = true,
  onChangeImage,
  onEditAction,
  onRemove,
  saveLabelKey = "doc.imageSplit.save",
  className = "doc-card-float-actions doc-card-media-actions",
  btnClassName = "doc-card-float-btn",
}) {
  const { t } = useI18n();

  return (
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {showChange ? (
        <button
          type="button"
          className={btnClassName}
          onClick={(event) => {
            event.stopPropagation();
            onChangeImage?.();
          }}
        >
          {t("doc.imageBlock.replace")}
        </button>
      ) : null}
      <button
        type="button"
        className={btnClassName}
        disabled={isEdit && !canSave}
        onClick={(event) => {
          event.stopPropagation();
          onEditAction?.();
        }}
      >
        {isEdit ? t(saveLabelKey) : t("doc.library.edit")}
      </button>
      <button
        type="button"
        className={btnClassName}
        onClick={(event) => {
          event.stopPropagation();
          onRemove?.();
        }}
      >
        {t("doc.imageBlock.remove")}
      </button>
    </div>
  );
}
