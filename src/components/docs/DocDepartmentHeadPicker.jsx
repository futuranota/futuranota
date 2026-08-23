import { useEffect, useMemo, useRef, useState } from "react";
import {
  findDepartmentById,
  listDepartmentsForObject,
} from "../../lib/departments.js";
import { useI18n } from "../../i18n/useI18n.js";

const SORTING_ICON = "/uploads/sorting-05.svg";

/**
 * Head-level department picker for folders (next to Departments.svg).
 * Label is read-only; sorting-05.svg (hover) opens the change menu.
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

  const canAssign = Boolean(onDepartmentIdChange);
  const label = selected
    ? String(selected.category || "").trim() || t("sidebar.departmentUnassigned")
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
    if (!canAssign) return;
    onDepartmentIdChange?.(id || null);
    if (!id || id !== departmentId) {
      onCategoryChange?.("");
    }
    setOpen(false);
  };

  return (
    <div
      className={
        "doc-department-head-picker"
        + (open ? " is-open" : "")
        + (!selected ? " is-empty" : "")
      }
      ref={rootRef}
    >
      <div className="doc-department-head-picker__row">
        <span
          className={
            "doc-department-of-label"
            + (!selected ? " is-empty" : "")
          }
          title={label}
        >
          {label}
        </span>
        {canAssign ? (
          <button
            type="button"
            className={
              "doc-department-sort"
              + (open ? " is-open" : "")
            }
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={t("sidebar.departmentChange")}
            title={t("sidebar.departmentChange")}
          >
            <img
              className="doc-department-sort__icon"
              src={SORTING_ICON}
              alt=""
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {open && canAssign ? (
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
