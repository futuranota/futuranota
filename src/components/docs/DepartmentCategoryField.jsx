import { useEffect, useMemo, useRef, useState } from "react";
import {
  findDepartmentById,
  listCategoriesForDepartment,
  listDepartmentsForObject,
} from "../../lib/departments.js";
import { useI18n } from "../../i18n/useI18n.js";

/** Parent department (room) picker for a folder. */
export function DepartmentParentField({
  departmentId = null,
  onDepartmentIdChange,
  onCategoryChange,
  departments = [],
  objectId = null,
  placeholder = "Select department",
}) {
  const { t } = useI18n();
  const leaveTimerRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const options = useMemo(
    () => listDepartmentsForObject(departments, objectId),
    [departments, objectId],
  );

  const selected = useMemo(
    () => findDepartmentById(options, departmentId),
    [options, departmentId],
  );

  const displayValue = selected?.category?.trim() || "";

  useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  const openPicker = () => {
    if (!options.length) return;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setPickerOpen(true);
  };

  const scheduleClosePicker = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setPickerOpen(false), 140);
  };

  const pick = (dept) => {
    onDepartmentIdChange?.(dept.id);
    // Changing room clears category — tags belong to the selected room.
    onCategoryChange?.("");
    setPickerOpen(false);
  };

  const clear = () => {
    onDepartmentIdChange?.(null);
    onCategoryChange?.("");
    setPickerOpen(false);
  };

  const showPicker = pickerOpen && options.length > 0;

  return (
    <div className="doc-meta-field">
      <span className="doc-meta-field-k">{t("sidebar.departmentFilterLabel")}</span>
      <div
        className={
          "doc-product-category-wrap"
          + (options.length ? " doc-product-category-wrap--pickable" : "")
        }
        onMouseEnter={openPicker}
        onMouseLeave={scheduleClosePicker}
      >
        <button
          type="button"
          className={
            "doc-new-meta-input doc-meta-field-input doc-department-category-trigger"
            + (!displayValue ? " is-empty" : "")
          }
          onClick={(e) => {
            e.stopPropagation();
            openPicker();
          }}
          aria-haspopup="listbox"
          aria-expanded={showPicker}
        >
          {displayValue || placeholder}
        </button>
        {showPicker ? (
          <ul
            className="doc-product-category-picker"
            role="listbox"
            onMouseEnter={() => {
              if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
              }
            }}
            onMouseLeave={scheduleClosePicker}
          >
            <li role="option">
              <button
                type="button"
                className="doc-product-category-picker__item"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
              >
                {t("sidebar.departmentParentNone")}
              </button>
            </li>
            {options.map((dept) => (
              <li key={dept.id} role="option">
                <button
                  type="button"
                  className={
                    "doc-product-category-picker__item"
                    + (selected?.id === dept.id ? " is-active" : "")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(dept);
                  }}
                >
                  {dept.category || t("sidebar.departmentsTitle")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {!options.length ? (
        <p className="doc-meta-schedule-hint">{t("sidebar.departmentParentEmptyHint")}</p>
      ) : null}
    </div>
  );
}

/**
 * Folder Category picker — only tags from the selected parent department.
 */
export function DepartmentCategoryField({
  value = "",
  departmentId = null,
  onChange,
  departments = [],
  placeholder = "Select category",
}) {
  const { t } = useI18n();
  const leaveTimerRef = useRef(null);
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

  useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  const openPicker = () => {
    if (!departmentId || !options.length) return;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setPickerOpen(true);
  };

  const scheduleClosePicker = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setPickerOpen(false), 140);
  };

  const pick = (label) => {
    onChange?.(label);
    setPickerOpen(false);
  };

  const clear = () => {
    onChange?.("");
    setPickerOpen(false);
  };

  const showPicker = pickerOpen && options.length > 0;
  const disabled = !departmentId;

  return (
    <div className="doc-meta-field">
      <span className="doc-meta-field-k">{t("meta.category")}</span>
      <div
        className={
          "doc-product-category-wrap"
          + (!disabled && options.length ? " doc-product-category-wrap--pickable" : "")
        }
        onMouseEnter={openPicker}
        onMouseLeave={scheduleClosePicker}
      >
        <button
          type="button"
          className={
            "doc-new-meta-input doc-meta-field-input doc-department-category-trigger"
            + (!displayValue ? " is-empty" : "")
          }
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            openPicker();
          }}
          aria-haspopup="listbox"
          aria-expanded={showPicker}
        >
          {displayValue
            || (disabled
              ? t("sidebar.departmentCategoryNeedParent")
              : placeholder)}
        </button>
        {showPicker ? (
          <ul
            className="doc-product-category-picker"
            role="listbox"
            onMouseEnter={() => {
              if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
              }
            }}
            onMouseLeave={scheduleClosePicker}
          >
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
