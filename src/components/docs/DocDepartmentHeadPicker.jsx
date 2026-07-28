import { useEffect, useMemo, useRef, useState } from "react";
import {
  findDepartmentById,
  formatDepartmentOfLabel,
  listDepartmentsForObject,
} from "../../lib/departments.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Head-level department picker for folders (next to folder icon).
 * Mirrors DocParentHeadPicker: assign department outside the meta toggle.
 */
export function DocDepartmentHeadPicker({
  departmentId = null,
  onDepartmentIdChange,
  onCategoryChange,
  departments = [],
  objectId = null,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const options = useMemo(
    () => listDepartmentsForObject(departments, objectId),
    [departments, objectId],
  );

  const selected = useMemo(
    () => findDepartmentById(options, departmentId),
    [options, departmentId],
  );

  const canPick = Boolean(onDepartmentIdChange);
  const label = selected
    ? formatDepartmentOfLabel(selected)
    : t("sidebar.departmentUnassigned");

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
    onDepartmentIdChange?.(id || null);
    if (!id || id !== departmentId) {
      onCategoryChange?.("");
    }
    setOpen(false);
  };

  return (
    <div className="doc-department-head-picker" ref={rootRef}>
      <button
        type="button"
        className={
          "doc-department-head-picker__trigger"
          + (canPick ? " is-clickable" : "")
          + (open ? " is-open" : "")
          + (!selected ? " is-empty" : "")
        }
        onClick={(e) => {
          e.stopPropagation();
          if (canPick) setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={!canPick}
      >
        <span className="doc-department-of-label">{label}</span>
      </button>
      {open && canPick ? (
        <ul className="doc-department-head-picker__menu" role="listbox">
          <li>
            <button
              type="button"
              className={
                "doc-department-head-picker__item"
                + (!departmentId ? " is-active" : "")
              }
              onClick={() => pick(null)}
            >
              {t("sidebar.departmentUnassigned")}
            </button>
          </li>
          {options.length ? (
            options.map((dept) => (
              <li key={dept.id}>
                <button
                  type="button"
                  className={
                    "doc-department-head-picker__item"
                    + (selected?.id === dept.id ? " is-active" : "")
                  }
                  onClick={() => pick(dept.id)}
                >
                  {dept.category || t("sidebar.departmentsTitle")}
                </button>
              </li>
            ))
          ) : (
            <li>
              <span className="doc-department-head-picker__empty">
                {t("sidebar.departmentParentEmptyHint")}
              </span>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
