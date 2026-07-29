import { useEffect, useMemo, useRef, useState } from "react";
import {
  findDepartmentById,
  listCategoriesForDepartment,
} from "../../lib/departments.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Folder Category picker — only tags from the selected parent department.
 * Click to open; hover highlights one option at a time.
 */
export function DepartmentCategoryField({
  value = "",
  departmentId = null,
  onChange,
  departments = [],
  placeholder = "Select category",
}) {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const department = useMemo(
    () => findDepartmentById(departments, departmentId),
    [departments, departmentId],
  );

  const options = useMemo(
    () => listCategoriesForDepartment(department),
    [department],
  );

  const displayValue = value || "";
  const disabled = !departmentId;
  const showPicker = pickerOpen && options.length > 0;

  useEffect(() => {
    if (!showPicker) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showPicker]);

  const pick = (label) => {
    onChange?.(label);
    setPickerOpen(false);
  };

  const clear = () => {
    onChange?.("");
    setPickerOpen(false);
  };

  return (
    <div className="doc-meta-field">
      <span className="doc-meta-field-k">{t("meta.category")}</span>
      <div
        ref={wrapRef}
        className={
          "doc-product-category-wrap"
          + (!disabled && options.length ? " doc-product-category-wrap--pickable" : "")
          + (showPicker ? " is-open" : "")
        }
      >
        <button
          type="button"
          className={
            "doc-new-meta-input doc-meta-field-input doc-department-category-trigger"
            + (!displayValue ? " is-empty" : "")
          }
          disabled={disabled}
          title={
            disabled
              ? t("sidebar.departmentCategoryNeedParent")
              : !options.length
                ? t("sidebar.departmentCategoryEmptyHint")
                : undefined
          }
          onClick={(e) => {
            e.stopPropagation();
            if (disabled || !options.length) return;
            setPickerOpen((open) => !open);
          }}
          aria-haspopup="listbox"
          aria-expanded={showPicker}
        >
          {displayValue
            || (disabled
              ? t("sidebar.departmentCategoryNeedParent")
              : !options.length
                ? t("sidebar.departmentCategoryEmptyHint")
                : placeholder)}
        </button>
        {showPicker ? (
          <ul className="doc-product-category-picker" role="listbox">
            <li role="option">
              <button
                type="button"
                className="doc-product-category-picker__item"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
              >
                {t("sidebar.departmentCategoryNone")}
              </button>
            </li>
            {options.map((label) => (
              <li key={label} role="option">
                <button
                  type="button"
                  className={
                    "doc-product-category-picker__item"
                    + (value === label ? " is-active" : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(label);
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {departmentId && !options.length ? (
        <p className="doc-meta-schedule-hint">{t("sidebar.departmentCategoryEmptyHint")}</p>
      ) : null}
    </div>
  );
}
