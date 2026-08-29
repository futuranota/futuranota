import { useI18n } from "../../../i18n/useI18n.js";

/**
 * Adjuntos | Imágenes as a 2-button scope bar (toolbar workspace card).
 * @param {Object} props
 * @param {"visual"|"skill"} props.filterTab
 * @param {(tab: "visual"|"skill") => void} props.onFilterTab
 */
export function LibraryWorkspaceScopeTabs({ filterTab, onFilterTab }) {
  const { t } = useI18n();

  return (
    <div
      className="folder-library-overlay__scope folder-library-overlay__scope--2"
      role="tablist"
      aria-label={t("doc.library.filterAria")}
    >
      <button
        type="button"
        role="tab"
        aria-selected={filterTab === "skill"}
        className={
          "folder-library-overlay__scope-btn"
          + (filterTab === "skill" ? " is-active" : "")
        }
        onClick={() => onFilterTab("skill")}
      >
        <img
          className="folder-library-overlay__scope-icon"
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
          "folder-library-overlay__scope-btn"
          + (filterTab === "visual" ? " is-active" : "")
        }
        onClick={() => onFilterTab("visual")}
      >
        <img
          className="folder-library-overlay__scope-icon"
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
