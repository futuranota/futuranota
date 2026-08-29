import { useI18n } from "../../../i18n/useI18n.js";
import { LibraryScopeBar } from "./LibraryScopeBar.jsx";

/**
 * Embedded library shell (toolbar) or inner workspace chrome.
 * @param {Object} props
 * @param {() => void} props.onClose
 * @param {string} [props.titleKey]
 * @param {boolean} [props.embedded]
 * @param {boolean} [props.showScopeBar]
 * @param {"workspace"|"folder"|"docs"} [props.scope]
 * @param {boolean} [props.scopeLocked]
 * @param {string} [props.searchQuery]
 * @param {(value: string) => void} [props.onSearchChange]
 * @param {boolean} [props.showSearch]
 * @param {import("react").ReactNode} props.children
 */
export function LibraryWorkspaceShell({
  onClose,
  titleKey = "doc.library.title",
  embedded = true,
  showScopeBar = false,
  scope = "workspace",
  scopeLocked = false,
  searchQuery = "",
  onSearchChange,
  showSearch = false,
  children,
}) {
  const { t } = useI18n();

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  return (
    <div className={"folder-library-panel-embed" + (embedded ? " folder-library-panel-embed--toolbar" : "")}>
      <div
        className={
          "folder-library-overlay__shell"
          + (embedded ? " folder-library-overlay__shell--embedded" : "")
        }
      >
        <header className="folder-library-overlay__header">
          <div className="folder-library-overlay__title-row">
            <h2 className="folder-library-overlay__title">{t(titleKey)}</h2>
          </div>
          <div className="folder-library-overlay__header-actions">
            <button
              type="button"
              className="folder-library-overlay__close"
              onClick={onClose}
              aria-label={t("doc.library.close")}
            >
              ×
            </button>
          </div>
        </header>

        {showScopeBar ? (
          <LibraryScopeBar scope={scope} locked={scopeLocked} />
        ) : null}

        {showSearch && typeof onSearchChange === "function" ? (
          <div className="folder-library-overlay__workspace-search lp-library-toolbar">
            <div className="lp-library-search-wrap">
              <span className="lp-library-search-icon" aria-hidden />
              <input
                type="search"
                className="lp-library-search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("doc.library.integratedVisualsSearch")}
                aria-label={t("doc.library.integratedVisualsSearch")}
                onKeyDown={stopBubble}
                onKeyUp={stopBubble}
                onMouseDown={stopBubble}
              />
            </div>
          </div>
        ) : null}

        {embedded ? children : (
          <div className="folder-library-overlay__workspace folder-library-overlay__workspace--tabs">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
