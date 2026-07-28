import { useEffect, useMemo, useRef, useState } from "react";
import {
  listUniqueCategoriesFromDocs,
  resolveCanonicalCategory,
} from "../../lib/docListGrouping.js";
import { isKnowledgeDoc } from "../../lib/templateDoc.js";

export function ProductCategoryField({
  value,
  onChange,
  placeholder = "Type product category",
  parentId = "",
  allDocs = null,
  docId = null,
  knowledgeMode = false,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const options = useMemo(() => {
    if (!allDocs) return [];
    const pool = Object.values(allDocs).filter((doc) => {
      if (docId && doc.id === docId) return false;
      if (knowledgeMode) return isKnowledgeDoc(doc);
      if (!parentId) return false;
      return doc.parentObjectId === parentId;
    });
    return listUniqueCategoriesFromDocs(pool);
  }, [allDocs, docId, knowledgeMode, parentId]);

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter((label) => label.toLowerCase().includes(query));
  }, [options, value]);

  useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  const commitValue = (raw) => {
    onChange(resolveCanonicalCategory(raw, options));
  };

  const handleBlur = () => {
    const raw = value;
    window.setTimeout(() => {
      commitValue(raw);
    }, 0);
  };

  const openPicker = () => {
    if (!filteredOptions.length) return;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setPickerOpen(true);
  };

  const keepPickerOpen = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const scheduleClosePicker = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setPickerOpen(false), 140);
  };

  const showPicker = pickerOpen && filteredOptions.length > 0;
  const canPick = filteredOptions.length > 0;

  return (
    <div className="doc-meta-field">
      <span className="doc-meta-field-k">Category</span>
      <div
        ref={wrapRef}
        className={
          "doc-product-category-wrap"
          + (canPick ? " doc-product-category-wrap--pickable" : "")
          + (showPicker ? " is-open" : "")
        }
        onMouseEnter={openPicker}
        onMouseLeave={scheduleClosePicker}
      >
        <input
          ref={inputRef}
          type="text"
          className="doc-new-meta-input doc-meta-field-input doc-product-category-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => {
            e.stopPropagation();
            openPicker();
          }}
          onBlur={handleBlur}
          onMouseEnter={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitValue(value);
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setPickerOpen(false);
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        {showPicker ? (
          <ul
            className="doc-product-category-picker"
            role="listbox"
            aria-label="Categories"
            onMouseEnter={keepPickerOpen}
            onMouseLeave={scheduleClosePicker}
          >
            {filteredOptions.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={resolveCanonicalCategory(value, options) === label}
                  className={
                    "doc-product-category-picker__item"
                    + (resolveCanonicalCategory(value, options) === label ? " is-active" : "")
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(label);
                    setPickerOpen(false);
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
