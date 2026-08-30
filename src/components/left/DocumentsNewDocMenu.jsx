import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import {
  listAdoptableDocs,
  resolveAdoptableDocLabel,
} from "../../lib/nodeParentAdoption.js";

const BOX_CLOSED = "/uploads/box-closed.svg";
const FILE_ICON = "/uploads/futuranota-file.svg";

/**
 * Selector-area menu: list folders, create a new document in one.
 * @param {{
 *   docsById: Record<string, object>,
 *   parentObjectId: string | null,
 *   disabled?: boolean,
 *   onCreateInFolder: (folderDoc: object) => void,
 * }} props
 */
export function DocumentsNewDocMenu({
  docsById = {},
  parentObjectId = null,
  disabled = false,
  onCreateInFolder,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const folders = useMemo(() => (
    listAdoptableDocs(docsById, { parentObjectId }).map((doc) => ({
      id: doc.id,
      label: resolveAdoptableDocLabel(doc),
      doc,
    }))
  ), [docsById, parentObjectId]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const handleToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const handleNew = (folder) => {
    setOpen(false);
    onCreateInFolder?.(folder.doc || folder);
  };

  return (
    <div className="lp-new-doc-menu" ref={wrapRef}>
      <button
        type="button"
        className={"lp-new-btn" + (open ? " is-open" : "")}
        onClick={handleToggle}
        disabled={disabled}
        title={disabled ? t("sidebar.openFolderFirst") : t("sidebar.createNewDocument")}
        aria-label={t("sidebar.createNewDocument")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="lp-new-label">{t("sidebar.newButton")}</span>
      </button>
      {open ? (
        <div className="lp-new-doc-menu__panel" role="menu" aria-label={t("sidebar.createNewDocument")}>
          {folders.length === 0 ? (
            <p className="lp-new-doc-menu__empty">{t("sidebar.noFoldersForNewDoc")}</p>
          ) : (
            <ul className="lp-new-doc-menu__list">
              {folders.map((folder) => (
                <li key={folder.id} className="lp-new-doc-menu__row">
                  <span className="lp-new-doc-menu__folder">
                    <img
                      src={BOX_CLOSED}
                      alt=""
                      aria-hidden
                      className="lp-new-doc-menu__folder-icon"
                    />
                    <span className="lp-new-doc-menu__folder-name">{folder.label}</span>
                  </span>
                  <button
                    type="button"
                    className="lp-new-doc-menu__new"
                    role="menuitem"
                    onClick={() => handleNew(folder)}
                    title={t("sidebar.createNewDocument")}
                    aria-label={`${t("sidebar.createNewDocument")}: ${folder.label}`}
                  >
                    <img
                      src={FILE_ICON}
                      alt=""
                      aria-hidden
                      className="lp-new-doc-menu__file-icon"
                    />
                    <span>+ New</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
