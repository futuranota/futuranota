import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";

const BOX_CLOSED = "/uploads/box-closed.svg";
const BOX_OPEN = "/uploads/open-box.svg";

/**
 * Compact folder destination picker for Intel YouTube notes.
 * @param {{
 *   folders: { id: string, label: string }[],
 *   selectedId: string|null,
 *   selectedLabel: string,
 *   locked?: boolean,
 *   onSelect: (folderId: string) => void,
 * }} props
 */
export function YoutubeFolderPicker({
  folders = [],
  selectedId = null,
  selectedLabel = "",
  locked = false,
  onSelect,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const hasSelection = Boolean(selectedId);
  const empty = folders.length === 0;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (locked) return;
    setOpen((prev) => !prev);
  };

  const handlePick = (folderId) => {
    onSelect?.(folderId);
    setOpen(false);
  };

  const ariaLabel = locked
    ? t("intel.youtubeFolderLockedAria", { folder: selectedLabel || t("intel.youtubeFolderPick") })
    : t("intel.youtubeFolderAria");

  return (
    <div className="note-taker__folder" ref={wrapRef}>
      <button
        type="button"
        className={
          "note-taker__folder-btn"
          + (hasSelection ? " is-selected" : "")
          + (locked ? " is-locked" : "")
        }
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={locked}
        title={selectedLabel || t("intel.youtubeFolderPick")}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleToggle}
      >
        <img
          src={hasSelection || open ? BOX_OPEN : BOX_CLOSED}
          alt=""
          aria-hidden
          className="note-taker__folder-icon"
        />
        {hasSelection ? (
          <span className="note-taker__folder-name">{selectedLabel}</span>
        ) : null}
      </button>
      {open && !locked ? (
        <div className="note-taker__folder-popover" role="listbox" aria-label={t("intel.youtubeFolderAria")}>
          {empty ? (
            <p className="note-taker__folder-empty">{t("intel.youtubeFolderEmpty")}</p>
          ) : (
            folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="option"
                aria-selected={folder.id === selectedId}
                className={
                  "note-taker__folder-option"
                  + (folder.id === selectedId ? " is-active" : "")
                }
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handlePick(folder.id)}
              >
                {folder.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
