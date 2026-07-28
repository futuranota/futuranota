import { useEffect, useMemo, useRef, useState } from "react";
import {
  findDepartmentById,
  formatDepartmentOfLabel,
  listDepartmentsForObject,
} from "../../lib/departments.js";
import { useI18n } from "../../i18n/useI18n.js";

const LOCKED_ICON = "/uploads/locked.svg";
const UNLOCKED_ICON = "/uploads/unlocked.svg";

/**
 * Head-level department picker for folders (next to folder icon).
 * Lock toggle: locked = picker disabled; unlocked = can open menu.
 * Lock tones from SVG refs — swap `lockTone` ("a" | "b") to compare.
 *   a = #A1A1A1 (locked.svg) · b = #343330 (unlocked.svg)
 */
export function DocDepartmentHeadPicker({
  departmentId = null,
  onDepartmentIdChange,
  onCategoryChange,
  departments = [],
  objectId = null,
  /** @type {"a"|"b"} SVG refill colors — change to pick preferred look */
  lockTone = "a",
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(true);
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
  const canPick = canAssign && !locked;
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

  useEffect(() => {
    if (locked) setOpen(false);
  }, [locked]);

  const pick = (id) => {
    if (!canPick) return;
    onDepartmentIdChange?.(id || null);
    if (!id || id !== departmentId) {
      onCategoryChange?.("");
    }
    setOpen(false);
  };

  const toggleLock = (e) => {
    e.stopPropagation();
    if (!canAssign) return;
    setLocked((v) => !v);
  };

  return (
    <div
      className={
        "doc-department-head-picker"
        + (locked ? " is-locked" : " is-unlocked")
        + (lockTone === "b" ? " doc-department-head-picker--lock-tone-b" : " doc-department-head-picker--lock-tone-a")
      }
      ref={rootRef}
    >
      <div className="doc-department-head-picker__row">
        <button
          type="button"
          className={
            "doc-department-head-picker__trigger"
            + (canPick ? " is-clickable" : "")
            + (open ? " is-open" : "")
            + (!selected ? " is-empty" : "")
            + (locked ? " is-locked" : "")
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
        {canAssign ? (
          <button
            type="button"
            className={
              "doc-department-lock"
              + (locked ? " is-locked" : " is-unlocked")
            }
            onClick={toggleLock}
            aria-pressed={locked}
            aria-label={
              locked
                ? t("sidebar.departmentUnlock")
                : t("sidebar.departmentLock")
            }
            title={
              locked
                ? t("sidebar.departmentUnlock")
                : t("sidebar.departmentLock")
            }
          >
            <span
              className="doc-department-lock__icon"
              style={{
                WebkitMaskImage: `url(${locked ? LOCKED_ICON : UNLOCKED_ICON})`,
                maskImage: `url(${locked ? LOCKED_ICON : UNLOCKED_ICON})`,
              }}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
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
