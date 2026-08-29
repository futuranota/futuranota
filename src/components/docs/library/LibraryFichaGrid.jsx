import { useI18n } from "../../../i18n/useI18n.js";
import { libraryGridFaceOptions } from "../../../lib/libraryFichaPreview.js";
import { LibrarySponsoredTag } from "../LibrarySponsoredTag.jsx";
import { renderLibraryFichaFace } from "./libraryFichaFace.jsx";

/**
 * @typedef {{ ownerKind: "folder"|"document", ownerId: string, item: object }} LibraryPickRow
 */

/**
 * @param {Object} props
 * @param {LibraryPickRow[]} props.picks
 * @param {"visual"|"skill"|"prompt"} props.faceTab
 * @param {(row: LibraryPickRow) => void} props.onOpenItem
 * @param {(row: LibraryPickRow) => void} [props.onEditItem]
 * @param {(row: LibraryPickRow) => void} [props.onDeleteItem]
 * @param {boolean} [props.showEditDelete]
 * @param {boolean} [props.showAddCell]
 * @param {() => void} [props.onAdd]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.addLabel]
 */
export function LibraryFichaGrid({
  picks = [],
  faceTab = "visual",
  onOpenItem,
  onEditItem,
  onDeleteItem,
  showEditDelete = false,
  showAddCell = false,
  onAdd,
  emptyMessage = "",
  addLabel = "",
}) {
  const { t } = useI18n();
  const sponsoredLabel = t("doc.library.sponsoredTag");
  const face = libraryGridFaceOptions(faceTab, true);

  if (!picks.length) {
    return (
      <div className="folder-library-overlay__empty">
        <p>{emptyMessage}</p>
        {showAddCell && onAdd ? (
          <button
            type="button"
            className="folder-library-overlay__empty-add"
            onClick={onAdd}
          >
            {addLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="folder-library-overlay__grid">
      {picks.map((row) => {
        const item = row.item;
        return (
          <li
            key={`${row.ownerKind}:${row.ownerId}:${item.id}`}
            className="folder-library-overlay__cell"
          >
            <button
              type="button"
              className="folder-library-overlay__cell-main"
              onClick={() => onOpenItem?.(row)}
              title={item.tag}
            >
              {renderLibraryFichaFace(
                item,
                face.prefer,
                sponsoredLabel,
                { tabLocked: face.tabLocked },
              )}
              <span className="folder-library-overlay__cell-meta">
                <span className="folder-library-overlay__cell-tag-row">
                  <span className="folder-library-overlay__cell-tag">{item.tag}</span>
                  {item.sponsored ? (
                    <LibrarySponsoredTag label={sponsoredLabel} />
                  ) : null}
                </span>
                {item.frameAspect ? (
                  <span className="folder-library-overlay__cell-frame">{item.frameAspect}</span>
                ) : null}
                {item.promptClass ? (
                  <span className="folder-library-overlay__cell-class">{item.promptClass}</span>
                ) : null}
              </span>
            </button>
            {showEditDelete && (item.category === "image"
              || item.category === "video"
              || item.category === "skill"
              || item.category === "pdf") ? (
              <button
                type="button"
                className="folder-library-overlay__cell-edit"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditItem?.(row);
                }}
                aria-label={t("doc.library.edit")}
                title={t("doc.library.edit")}
              >
                {t("doc.library.edit")}
              </button>
            ) : null}
            {showEditDelete ? (
              <button
                type="button"
                className="folder-library-overlay__cell-delete"
                onClick={() => onDeleteItem?.(row)}
                aria-label={t("doc.library.delete")}
                title={t("doc.library.delete")}
              >
                ×
              </button>
            ) : null}
          </li>
        );
      })}
      {showAddCell && onAdd ? (
        <li className="folder-library-overlay__cell folder-library-overlay__cell--add">
          <button
            type="button"
            className="folder-library-overlay__cell-add"
            onClick={onAdd}
            aria-label={addLabel}
            title={addLabel}
          >
            +
          </button>
        </li>
      ) : null}
    </ul>
  );
}
