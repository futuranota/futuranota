import { useI18n } from "../../../i18n/useI18n.js";

/**
 * Card media chrome.
 * Saved: solo Editar (revela herramientas).
 * Editing: Agregar · Editar imagen · Guardar · Quitar.
 */
export function DocCardMediaActions({
  isEdit,
  canSave,
  showAdd = true,
  showEditImage = false,
  onAddImage,
  onEditImage,
  onSave,
  onEdit,
  onRemove,
  saveLabelKey = "doc.imageSplit.save",
  className = "doc-card-float-actions doc-card-media-actions",
  btnClassName = "doc-card-float-btn",
}) {
  const { t } = useI18n();

  if (!isEdit) {
    return (
      <div
        className={`${className} doc-card-media-actions--saved`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={btnClassName}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.();
          }}
        >
          {t("doc.cardMedia.edit")}
        </button>
      </div>
    );
  }

  return (
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {showAdd ? (
        <button
          type="button"
          className={btnClassName}
          onClick={(event) => {
            event.stopPropagation();
            onAddImage?.();
          }}
        >
          {t("doc.cardMedia.add")}
        </button>
      ) : null}
      {showEditImage ? (
        <button
          type="button"
          className={btnClassName}
          onClick={(event) => {
            event.stopPropagation();
            onEditImage?.();
          }}
        >
          {t("doc.library.edit")}
        </button>
      ) : null}
      <button
        type="button"
        className={btnClassName}
        disabled={!canSave}
        onClick={(event) => {
          event.stopPropagation();
          if (!canSave) return;
          onSave?.();
        }}
      >
        {t(saveLabelKey)}
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
