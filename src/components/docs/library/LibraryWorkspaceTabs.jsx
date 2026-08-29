import { useI18n } from "../../../i18n/useI18n.js";

/**
 * Imágenes | Adjuntos tab row (same chrome as folder library overlay).
 * @param {Object} props
 * @param {"visual"|"skill"} props.filterTab
 * @param {(tab: "visual"|"skill") => void} props.onFilterTab
 */
export function LibraryWorkspaceTabs({ filterTab, onFilterTab }) {
  const { t } = useI18n();

  return (
    <div
      className="folder-library-overlay__prompt-row folder-library-overlay__prompt-row--workspace"
      role="tablist"
      aria-label={t("doc.library.filterAria")}
    >
      <button
        type="button"
        role="tab"
        aria-selected={filterTab === "skill"}
        className={
          "folder-library-overlay__tab folder-library-overlay__tab--with-icon"
          + (filterTab === "skill" ? " is-active" : "")
        }
        onClick={() => onFilterTab("skill")}
      >
        <img
          className="folder-library-overlay__tab-icon"
          src="/uploads/attachment.svg"
          alt=""
          aria-hidden
          draggable={false}
        />
        <span>{t("doc.library.tabSkills")}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={filterTab === "visual"}
        className={
          "folder-library-overlay__prompt-label"
          + (filterTab === "visual" ? " is-active" : "")
        }
        onClick={() => onFilterTab("visual")}
      >
        <img
          className="folder-library-overlay__tab-icon"
          src="/uploads/Palette.svg"
          alt=""
          aria-hidden
          draggable={false}
        />
        <span>{t("doc.library.tabImageCards")}</span>
      </button>
    </div>
  );
}
