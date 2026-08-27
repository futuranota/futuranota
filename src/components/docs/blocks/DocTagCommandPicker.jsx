import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  collectTagCandidatesForObject,
  normalizeTagKey,
} from "../../../lib/urlTableTags.js";
import { useUrlTableStore } from "../../../stores/urlTableStore.js";

const URL_TABLE_ICON = "/uploads/url-table.svg";

/**
 * @ mention picker: list company links by Business name; insert uses tag (affiliate link label).
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
  const entries = useUrlTableStore((s) => s.entries);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wasOpenRef = useRef(false);

  const candidates = useMemo(
    () => collectTagCandidatesForObject(entries, companyObjectId),
    [companyObjectId, entries],
  );

  const filteredCandidates = useMemo(() => {
    const q = normalizeTagKey(query);
    if (!q) {
      return candidates.slice().sort((a, b) => (
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        || a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" })
      ));
    }
    return candidates.filter((item) => (
      normalizeTagKey(item.name).includes(q)
      || normalizeTagKey(item.tag).includes(q)
    )).sort((a, b) => (
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      || a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" })
    ));
  }, [candidates, query]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

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
        onClose?.();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector(`[data-tag-picker-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open || !anchor || typeof document === "undefined") return null;

  const selectCandidate = (candidate) => {
    onSelect?.(candidate);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!filteredCandidates.length) return;
      setActiveIndex((i) => (i + 1) % filteredCandidates.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!filteredCandidates.length) return;
      setActiveIndex((i) => (i - 1 + filteredCandidates.length) % filteredCandidates.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filteredCandidates[activeIndex];
      if (item) selectCandidate(item);
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
      aria-label="Insert link from URL table"
      style={style}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="doc-tag-command-picker__header">
        <p className="doc-tag-command-picker__title">Choose a link</p>
        <button
          type="button"
          className="doc-tag-command-picker__close"
          aria-label="Close link picker"
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
          Open a document inside a company to insert links.
        </p>
      ) : (
        <>
          <input
            ref={searchRef}
            type="search"
            className="doc-tag-command-picker__search"
            value={query}
            placeholder="Search by name…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search links by name"
          />

          <div className="doc-tag-command-picker__list" role="listbox">
            {filteredCandidates.length === 0 ? (
              <p className="doc-tag-command-picker__empty">No matching links</p>
            ) : (
              filteredCandidates.map((item, index) => (
                <button
                  key={item.entryId}
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
                    selectCandidate(item);
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
                    {item.name?.trim() || "Untitled"}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
