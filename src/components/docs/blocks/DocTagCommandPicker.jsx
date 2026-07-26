import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  collectTagCandidatesForTable,
  filterTagCandidates,
  formatMentionToken,
  normalizeTagKey,
} from "../../../lib/urlTableTags.js";
import { useUrlTableStore } from "../../../stores/urlTableStore.js";
import { useUrlTablesStore } from "../../../stores/urlTablesStore.js";

const URL_TABLE_ICON = "/uploads/url-table.svg";

/**
 * @ mention picker: choose a URL table title, then Name · @tag.
 */
export function DocTagCommandPicker({
  open,
  companyObjectId = null,
  anchor = null,
  onClose,
  onSelect,
}) {
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const tables = useUrlTablesStore((s) => s.tables);
  const entries = useUrlTableStore((s) => s.entries);
  const [step, setStep] = useState(/** @type {'tables'|'tags'} */ ("tables"));
  const [selectedTableId, setSelectedTableId] = useState(/** @type {string|null} */ (null));
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const companyTables = useMemo(() => {
    if (!companyObjectId) return [];
    return tables
      .filter((table) => table.objectId === companyObjectId)
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }, [companyObjectId, tables]);

  const filteredTables = useMemo(() => {
    const q = normalizeTagKey(query);
    if (!q) return companyTables;
    return companyTables.filter((table) => (
      normalizeTagKey(table.title || "URL table").includes(q)
    ));
  }, [companyTables, query]);

  const selectedTable = useMemo(
    () => companyTables.find((table) => table.id === selectedTableId) || null,
    [companyTables, selectedTableId],
  );

  const tableCandidates = useMemo(() => {
    if (!selectedTableId) return [];
    return collectTagCandidatesForTable(entries, selectedTableId).map((item) => ({
      ...item,
      tableTitle: selectedTable?.title || "",
    }));
  }, [entries, selectedTable?.title, selectedTableId]);

  const filteredCandidates = useMemo(
    () => filterTagCandidates(tableCandidates, query),
    [query, tableCandidates],
  );

  const items = step === "tables" ? filteredTables : filteredCandidates;
  const wasOpenRef = useRef(false);

  // Reset wizard only when the picker freshly opens — never while navigating
  // tables → tags (a mid-click focus blip used to flip `open` and wipe the step).
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep("tables");
      setSelectedTableId(null);
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [step, query, selectedTableId]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".doc-tag-command-picker")) return;
      onClose?.();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (step === "tags") {
          setStep("tables");
          setSelectedTableId(null);
          setQuery("");
          return;
        }
        onClose?.();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, step]);

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector(`[data-tag-picker-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open, step]);

  if (!open || !anchor || typeof document === "undefined") return null;

  const selectTable = (table) => {
    if (!table?.id) return;
    setSelectedTableId(table.id);
    setStep("tags");
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  };

  const selectCandidate = (candidate) => {
    onSelect?.(candidate);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!items.length) return;
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!items.length) return;
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (!item) return;
      if (step === "tables") selectTable(item);
      else selectCandidate(item);
      return;
    }
    if (event.key === "Backspace" && !query && step === "tags") {
      event.preventDefault();
      setStep("tables");
      setSelectedTableId(null);
    }
  };

  const style = {
    position: "fixed",
    top: anchor.top,
    left: anchor.left,
    zIndex: 10065,
  };

  return createPortal(
    <div
      ref={menuRef}
      className="doc-tag-command-picker"
      role="dialog"
      aria-label="Insert tag from URL table"
      style={style}
      onMouseDown={(event) => {
        // Keep focus inside the picker while choosing a table/tag.
        event.stopPropagation();
      }}
    >
      <div className="doc-tag-command-picker__header">
        {step === "tags" ? (
          <button
            type="button"
            className="doc-tag-command-picker__back"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setStep("tables");
              setSelectedTableId(null);
              setQuery("");
            }}
          >
            ← Back
          </button>
        ) : null}
        <p className="doc-tag-command-picker__title">
          {step === "tables"
            ? "Choose a URL table"
            : `Tags in ${selectedTable?.title?.trim() || "URL table"}`}
        </p>
        <button
          type="button"
          className="doc-tag-command-picker__close"
          aria-label="Close tag picker"
          title="Keep typing with @"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose?.();
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose?.();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose?.();
          }}
        >
          ×
        </button>
      </div>

      {!companyObjectId ? (
        <p className="doc-tag-command-picker__empty">
          Open a document inside a company to insert tags.
        </p>
      ) : (
        <>
          <input
            ref={searchRef}
            type="search"
            className="doc-tag-command-picker__search"
            value={query}
            placeholder={step === "tables" ? "Search tables…" : "Search Name or @tag…"}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={step === "tables" ? "Search URL tables" : "Search tags"}
          />

          <div className="doc-tag-command-picker__list" role="listbox">
            {step === "tables" ? (
              filteredTables.length === 0 ? (
                <p className="doc-tag-command-picker__empty">No URL tables yet</p>
              ) : (
                filteredTables.map((table, index) => (
                  <button
                    key={table.id}
                    type="button"
                    role="option"
                    data-tag-picker-index={index}
                    aria-selected={index === activeIndex}
                    className={
                      "doc-tag-command-picker__item"
                      + (index === activeIndex ? " is-active" : "")
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      selectTable(table);
                    }}
                  >
                    <img
                      src={URL_TABLE_ICON}
                      alt=""
                      className="doc-tag-command-picker__icon"
                      width={16}
                      height={16}
                    />
                    <span className="doc-tag-command-picker__label">
                      {table.title?.trim() || "URL table"}
                    </span>
                  </button>
                ))
              )
            ) : filteredCandidates.length === 0 ? (
              <p className="doc-tag-command-picker__empty">No tags in this table</p>
            ) : (
              filteredCandidates.map((item, index) => {
                const token = formatMentionToken(item.tag);
                const description = String(item.description || "").trim();
                const preview = description
                  ? (description.length > 72 ? `${description.slice(0, 72)}…` : description)
                  : "No description";
                return (
                  <button
                    key={item.entryId}
                    type="button"
                    role="option"
                    data-tag-picker-index={index}
                    aria-selected={index === activeIndex}
                    className={
                      "doc-tag-command-picker__item doc-tag-command-picker__item--tag"
                      + (index === activeIndex ? " is-active" : "")
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      selectCandidate(item);
                    }}
                  >
                    <span className="doc-tag-command-picker__name-tag">
                      <span className="doc-tag-command-picker__name">
                        {item.name || "Untitled"}
                      </span>
                      <span className="doc-tag-command-picker__token">{token}</span>
                    </span>
                    <span className="doc-tag-command-picker__desc">{preview}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
