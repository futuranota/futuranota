import { useI18n } from "../../i18n/useI18n.js";

const FOLDER_BOX_ICON_SRC = "/uploads/open-box.svg";

/**
 * @param {Object} props
 * @param {string} [props.folderTitle]
 * @param {string|null} [props.folderId]
 * @param {boolean} [props.canOpenFolder]
 * @param {(folderId: string) => void} [props.onOpenFolder]
 */
export function LazyTodoFolderChip({
  folderTitle = "",
  folderId = null,
  canOpenFolder = false,
  onOpenFolder,
}) {
  const { t } = useI18n();
  const label = String(folderTitle || "").trim() || t("lazyTodos.folderUnknown");
  const hint = canOpenFolder
    ? t("lazyTodos.openFolderNamed", { name: label })
    : label;

  return (
    <button
      type="button"
      className="lazy-todo-folder-chip"
      onClick={() => {
        if (canOpenFolder && folderId) onOpenFolder?.(folderId);
      }}
      disabled={!canOpenFolder}
      title={hint}
      aria-label={hint}
    >
      <img
        src={FOLDER_BOX_ICON_SRC}
        alt=""
        aria-hidden
        draggable={false}
        className="lazy-todo-folder-chip__icon"
      />
      <span className="lazy-todo-folder-chip__label">{label}</span>
    </button>
  );
}
