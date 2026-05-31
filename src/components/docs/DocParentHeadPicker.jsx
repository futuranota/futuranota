import { useEffect, useRef, useState } from "react";
import { DOC_FILE_TXT_ICON } from "../../lib/docMediumAssets.js";

export function DocParentHeadPicker({
  parentId = "",
  onParentIdChange,
  objects = [],
  iconSrc = DOC_FILE_TXT_ICON,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const parentObject = objects.find((o) => o.id === parentId) ?? null;
  const canPick = Boolean(onParentIdChange && objects?.length);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pick = (id) => {
    onParentIdChange?.(id);
    setOpen(false);
  };

  return (
    <div className="doc-parent-head-picker" ref={rootRef}>
      <button
        type="button"
        className={
          "doc-parent-head-picker__trigger"
          + (canPick ? " is-clickable" : "")
          + (open ? " is-open" : "")
          + (!parentId ? " is-empty" : "")
        }
        onClick={(e) => {
          e.stopPropagation();
          if (canPick) setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={parentObject ? `Parent: ${parentObject.name}` : "Select parent object"}
        disabled={!canPick}
      >
        <img className="doc-new-head-icon" src={iconSrc} alt="" aria-hidden />
        <span className="doc-new-doc-label">
          {parentObject?.name || "Select parent"}
        </span>
      </button>
      {open && canPick ? (
        <ul className="doc-parent-head-picker__menu" role="listbox">
          <li>
            <button
              type="button"
              className={"doc-parent-head-picker__item" + (!parentId ? " is-active" : "")}
              onClick={() => pick("")}
            >
              No parent
            </button>
          </li>
          {objects.map((obj) => (
            <li key={obj.id}>
              <button
                type="button"
                className={"doc-parent-head-picker__item" + (obj.id === parentId ? " is-active" : "")}
                onClick={() => pick(obj.id)}
              >
                {obj.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
