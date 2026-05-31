import { useEffect, useRef, useState } from "react";
import { listProductVersionOptions } from "../../lib/templateDoc.js";

export function ProductVersionField({
  onCommit,
  parentId = "",
  category = "",
  allDocs = null,
  docId = null,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const userEditedRef = useRef(false);
  const options = listProductVersionOptions(allDocs, parentId, category);
  const [editing, setEditing] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [displayCommitted, setDisplayCommitted] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setInputValue("");
    setDisplayCommitted("");
    setEditing(true);
    setPickerOpen(false);
    userEditedRef.current = false;
  }, [docId]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  const finishCommit = (raw) => {
    const version = raw.trim();
    if (!version) return;
    onCommit?.(version);
    setInputValue("");
    setDisplayCommitted(version);
    setEditing(false);
    setPickerOpen(false);
    userEditedRef.current = false;
  };

  const startNewVersion = () => {
    setDisplayCommitted("");
    setInputValue("");
    setEditing(true);
    setPickerOpen(false);
    userEditedRef.current = false;
  };

  const handleChange = (e) => {
    userEditedRef.current = true;
    const next = e.target.value;
    if (/\s{2,}$/.test(next)) {
      finishCommit(next);
      return;
    }
    setInputValue(next);
  };

  const handleBlur = () => {
    if (!userEditedRef.current) return;
    const draft = inputValue.trim();
    if (draft) {
      finishCommit(draft);
      return;
    }
    userEditedRef.current = false;
  };

  const openPicker = () => {
    if (!options.length) return;
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

  const showTag = Boolean(displayCommitted) && !editing;
  const showInput = !showTag;
  const showHoverPicker = pickerOpen && options.length > 0;
  const canPick = options.length > 0;

  return (
    <div className="doc-meta-field">
      <span className="doc-meta-field-k">Version</span>
      <div
        ref={wrapRef}
        className={
          "doc-product-version-wrap"
          + (showTag ? " doc-product-version-wrap--committed" : "")
          + (canPick ? " doc-product-version-wrap--pickable" : "")
        }
        onMouseEnter={openPicker}
        onMouseLeave={scheduleClosePicker}
      >
        {showTag ? (
          <span className="doc-product-version-tag" aria-label={`Version ${displayCommitted}`}>
            {displayCommitted}
          </span>
        ) : null}
        {showInput ? (
          <input
            ref={inputRef}
            type="text"
            className="doc-new-meta-input doc-meta-field-input doc-product-version-input"
            value={inputValue}
            onChange={handleChange}
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
                if (inputValue.trim()) finishCommit(inputValue);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setInputValue("");
                userEditedRef.current = false;
                if (displayCommitted) setEditing(false);
              }
            }}
            placeholder={canPick ? "Select below or type new" : "Type your version"}
            spellCheck={false}
          />
        ) : null}
        {showHoverPicker ? (
          <ul
            className="doc-product-version-picker"
            role="listbox"
            aria-label="Product versions"
            onMouseEnter={keepPickerOpen}
            onMouseLeave={scheduleClosePicker}
          >
            {options.map(({ docId: optionDocId, version }) => (
              <li key={optionDocId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={version === displayCommitted}
                  className={
                    "doc-product-version-picker__item"
                    + (version === displayCommitted ? " is-active" : "")
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    finishCommit(version);
                  }}
                >
                  {version}
                </button>
              </li>
            ))}
            <li className="doc-product-version-picker__divider" aria-hidden />
            <li>
              <button
                type="button"
                className="doc-product-version-picker__item doc-product-version-picker__item--new"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  startNewVersion();
                }}
              >
                New version…
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
