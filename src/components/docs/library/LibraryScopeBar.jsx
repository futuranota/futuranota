import { useI18n } from "../../../i18n/useI18n.js";

export const LIBRARY_SCOPE_OPTIONS = [
  { id: "workspace", labelKey: "doc.library.scopeWorkspace", iconSrc: "/uploads/docs-main.svg" },
  { id: "folder", labelKey: "doc.library.scopeFolder", iconSrc: "/uploads/folder-main.svg" },
  { id: "docs", labelKey: "doc.library.scopeDocs", iconSrc: "/uploads/folder-view.svg" },
];

/**
 * Todo | Esta librería | Por Documentos — same chrome as folder library overlay.
 * @param {Object} props
 * @param {"workspace"|"folder"|"docs"} props.scope
 * @param {(scope: "workspace"|"folder"|"docs") => void} [props.onScope]
 * @param {boolean} [props.locked] — toolbar workspace: show bar, only active scope
 * @param {Array<typeof LIBRARY_SCOPE_OPTIONS[number]>} [props.options]
 */
export function LibraryScopeBar({
  scope = "workspace",
  onScope,
  locked = false,
  options = LIBRARY_SCOPE_OPTIONS,
}) {
  const { t } = useI18n();

  return (
    <div
      className={
        "folder-library-overlay__scope"
        + ` folder-library-overlay__scope--${options.length}`
      }
      role="tablist"
      aria-label={t("doc.library.scopeAria")}
    >
      {options.map((option) => {
        const isActive = scope === option.id;
        const isDisabled = locked && !isActive;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            className={
              "folder-library-overlay__scope-btn"
              + (isActive ? " is-active" : "")
              + (isDisabled ? " is-disabled" : "")
            }
            onClick={() => {
              if (isDisabled || isActive) return;
              onScope?.(option.id);
            }}
          >
            <img
              className="folder-library-overlay__scope-icon"
              src={option.iconSrc}
              alt=""
              aria-hidden
              draggable={false}
            />
            <span>{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
