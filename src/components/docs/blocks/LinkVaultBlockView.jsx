import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createLinkEntry,
  LINK_DESCRIPTION_MAX_LENGTH,
  normalizeUrlInput,
} from "../../../lib/vaultBlocks.js";
import { formatAffiliateRowMeta, hasAffiliateData } from "../../../lib/urlTableAffiliate.js";

const EMPTY_DRAFT = { name: "", tag: "", category: "", description: "", url: "" };
const URL_FIELD_ICON = "/uploads/url-table.svg";

const DEFAULT_LABELS = {
  name: "Title",
  tag: "Tag",
  category: "Category",
  description: "Description",
  url: "URL",
  save: "Save",
  status: "Status",
  view: "View",
  daysLeft: "{days}d left",
  statusPending: "Pending",
  statusActive: "Active",
  statusExpired: "Expired",
};

export function LinkVaultBlockView({
  entries = [],
  onEntriesChange,
  onSaveEntry = null,
  onDeleteEntry = null,
  onDeleteVault,
  openAddForm = false,
  compact = false,
  multilineDescription = false,
  slashStack = false,
  labels,
  filterQuery = "",
  hideAddButton = false,
  addFormRequest = 0,
  flushDraftRef = null,
  draft: controlledDraft = null,
  onDraftChange = null,
  objectId = null,
  tableId = null,
  showRowView = false,
  onViewEntry = null,
}) {
  const L = { ...DEFAULT_LABELS, ...(labels || {}) };
  const isDraftControlled = controlledDraft != null && typeof onDraftChange === "function";
  const [uncontrolledDraft, setUncontrolledDraft] = useState(EMPTY_DRAFT);
  const draft = isDraftControlled ? controlledDraft : uncontrolledDraft;
  const setDraft = isDraftControlled ? onDraftChange : setUncontrolledDraft;
  const [isAdding, setIsAdding] = useState(entries.length === 0);
  const [openPicker, setOpenPicker] = useState(/** @type {null|'tag'|'category'} */ (null));
  const nameRef = useRef(null);
  const descRef = useRef(null);
  const pickerRef = useRef(null);
  const draftRef = useRef(draft);
  const entriesRef = useRef(entries);
  draftRef.current = draft;
  entriesRef.current = entries;

  useEffect(() => {
    if (!multilineDescription && !slashStack) return;
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.description, multilineDescription, slashStack, isAdding]);

  useEffect(() => {
    if (entries.length === 0) {
      setIsAdding(true);
    }
  }, [entries.length]);

  const rootRef = useRef(null);

  const focusDraftField = useCallback((preferredEl) => {
    const root = rootRef.current;
    const active = document.activeElement;
    if (
      root
      && active instanceof HTMLElement
      && root.contains(active)
      && active.matches("input, textarea")
    ) {
      return;
    }
    preferredEl?.focus({ preventScroll: true });
  }, []);

  const handleCardPointerDown = useCallback((event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input, textarea, select, button, a, label")) return;
    event.preventDefault();
    setIsAdding(true);
    window.requestAnimationFrame(() => {
      nameRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!openAddForm) return;
    setIsAdding(true);
    const timer = window.setTimeout(() => focusDraftField(nameRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [openAddForm, focusDraftField]);

  useEffect(() => {
    if (!addFormRequest) return;
    setIsAdding(true);
    setDraft(EMPTY_DRAFT);
    const timer = window.setTimeout(() => focusDraftField(nameRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [addFormRequest, focusDraftField]);

  useEffect(() => {
    if (!flushDraftRef) return undefined;
    flushDraftRef.current = () => {
      const currentDraft = draftRef.current;
      const currentEntries = entriesRef.current;
      const canCommitDraft = Boolean(
        currentDraft.name.trim() && currentDraft.url.trim(),
      );
      if (!canCommitDraft) return currentEntries;

      const entry = createLinkEntry({
        ...currentDraft,
        url: normalizeUrlInput(currentDraft.url),
      });
      const nextEntries = [...currentEntries, entry];
      onEntriesChange?.(nextEntries);
      setDraft(EMPTY_DRAFT);
      setIsAdding(false);
      return nextEntries;
    };
    return () => {
      flushDraftRef.current = null;
    };
  }, [flushDraftRef, onEntriesChange]);

  const visibleEntries = useMemo(() => {
    const normalized = String(filterQuery ?? "").trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => (
      String(entry.name ?? "").toLowerCase().includes(normalized)
      || String(entry.tag ?? "").toLowerCase().includes(normalized)
      || String(entry.category ?? "").toLowerCase().includes(normalized)
      || String(entry.description ?? "").toLowerCase().includes(normalized)
      || String(entry.url ?? "").toLowerCase().includes(normalized)
    ));
  }, [entries, filterQuery]);

  const canSave = Boolean(draft.name.trim() && draft.url.trim());

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const entry = createLinkEntry({
      ...draft,
      url: normalizeUrlInput(draft.url),
    });
    if (onSaveEntry) {
      const result = onSaveEntry(entry);
      if (result === false || result === null) return;
      setDraft(EMPTY_DRAFT);
      // Keep form open so the user can add another row in the overlay.
      setIsAdding(true);
      return;
    }
    onEntriesChange?.([
      ...entries,
      entry,
    ]);
    setDraft(EMPTY_DRAFT);
    setIsAdding(false);
  }, [canSave, draft, entries, onEntriesChange, onSaveEntry, setDraft]);

  const handleRemoveEntry = useCallback((entryId) => {
    // #region agent log
    fetch('http://127.0.0.1:7764/ingest/1d5b49ee-76e8-4907-8f7a-6cd7282ea736',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5c112'},body:JSON.stringify({sessionId:'b5c112',runId:'post-fix',hypothesisId:'H-A',location:'LinkVaultBlockView.jsx:handleRemoveEntry',message:'row delete requested',data:{entryId,tableId,entriesBefore:entries.length,hasStoreDelete:Boolean(onDeleteEntry)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // Delete from the SQL-backed store immediately (same immediacy as row Save),
    // so a later row Save cannot resurrect the row from the store.
    onDeleteEntry?.(entryId);
    onEntriesChange?.(entries.filter((entry) => entry.id !== entryId));
  }, [entries, onDeleteEntry, onEntriesChange, tableId]);

  const applyChipValue = useCallback((field, value) => {
    const next = String(value ?? "").trim();
    if (!next) return;
    setIsAdding(true);
    setDraft((prev) => ({ ...prev, [field]: next }));
    setOpenPicker(null);
  }, [setDraft]);

  /** Clear a tag/category value from every row that has it (picker delete). */
  const removeFieldValue = useCallback((field, value) => {
    const target = String(value ?? "").trim().toLowerCase();
    if (!target) return;
    onEntriesChange?.(
      entries.map((entry) => {
        const current = String(entry[field] ?? "").trim();
        if (current.toLowerCase() !== target) return entry;
        return { ...entry, [field]: "" };
      }),
    );
    setDraft((prev) => {
      const current = String(prev[field] ?? "").trim();
      if (current.toLowerCase() !== target) return prev;
      return { ...prev, [field]: "" };
    });
  }, [entries, onEntriesChange, setDraft]);

  const uniqueTags = useMemo(() => {
    const seen = new Set();
    const values = [];
    for (const entry of entries) {
      const value = String(entry.tag ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
    return values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [entries]);

  const uniqueCategories = useMemo(() => {
    const seen = new Set();
    const values = [];
    for (const entry of entries) {
      const value = String(entry.category ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
    return values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [entries]);

  const [pickerMenuStyle, setPickerMenuStyle] = useState(null);
  const pickerMenuRef = useRef(null);
  const pickerTriggerRef = useRef(null);

  useLayoutEffect(() => {
    if (!openPicker || !pickerTriggerRef.current) {
      setPickerMenuStyle(null);
      return undefined;
    }
    const update = () => {
      const rect = pickerTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPickerMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        zIndex: 10050,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [openPicker]);

  useEffect(() => {
    if (!openPicker) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (pickerRef.current?.contains(target)) return;
      if (pickerMenuRef.current?.contains(target)) return;
      setOpenPicker(null);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpenPicker(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPicker]);

  const renderColumnPicker = (field, label, values, emptyLabel) => {
    const isOpen = openPicker === field;
    return (
      <div
        className={
          "doc-vault-block__col-picker"
          + (isOpen ? " is-open" : "")
        }
        ref={isOpen ? pickerRef : undefined}
      >
        <button
          type="button"
          ref={isOpen ? pickerTriggerRef : undefined}
          className="doc-vault-block__col-picker-trigger"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onClick={(e) => {
            e.stopPropagation();
            const next = openPicker === field ? null : field;
            if (next) {
              const rect = e.currentTarget.getBoundingClientRect();
              pickerTriggerRef.current = e.currentTarget;
              setPickerMenuStyle({
                position: "fixed",
                top: rect.bottom + 6,
                left: rect.left,
                zIndex: 10050,
              });
            } else {
              setPickerMenuStyle(null);
            }
            setOpenPicker(next);
          }}
        >
          <span>{label}</span>
          <span className="doc-vault-block__col-picker-chevron" aria-hidden />
        </button>
        {isOpen && pickerMenuStyle
          ? createPortal(
            <div
              ref={pickerMenuRef}
              className="doc-vault-block__col-picker-menu doc-vault-block__col-picker-menu--portal"
              role="listbox"
              aria-label={label}
              style={pickerMenuStyle}
            >
              {values.length ? (
                values.map((value) => (
                  <div key={value} className="doc-vault-block__col-picker-row">
                    <button
                      type="button"
                      role="option"
                      className="doc-vault-block__col-picker-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyChipValue(field, value);
                      }}
                    >
                      {value}
                    </button>
                    <button
                      type="button"
                      className="doc-vault-block__col-picker-remove"
                      aria-label={field === "tag" ? `Delete tag ${value}` : `Delete category ${value}`}
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFieldValue(field, value);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p className="doc-vault-block__col-picker-empty">{emptyLabel}</p>
              )}
            </div>,
            document.body,
          )
          : null}
      </div>
    );
  };

  const showAddForm = isAdding;
  const showAddButton = !hideAddButton && entries.length > 0 && !isAdding;
  const useMultilineDescription = multilineDescription || slashStack;

  const renderDraftFields = () => (
    <>
      <td>
        <input
          ref={nameRef}
          className="doc-vault-block__input"
          type="text"
          value={draft.name}
          placeholder={L.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </td>
      <td>
        <div className="doc-vault-block__tag-field">
          <input
            className="doc-vault-block__input"
            type="text"
            value={draft.tag ?? ""}
            placeholder={L.tag}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, tag: e.target.value }));
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </td>
      <td>
        <input
          className="doc-vault-block__input"
          type="text"
          value={draft.category ?? ""}
          placeholder={L.category}
          onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </td>
      <td>
        {useMultilineDescription ? (
          <textarea
            ref={descRef}
            rows={1}
            className="doc-vault-block__input doc-vault-block__input--description-multiline"
            value={draft.description}
            placeholder={L.description}
            maxLength={LINK_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <input
            className="doc-vault-block__input"
            type="text"
            value={draft.description}
            placeholder={L.description}
            maxLength={LINK_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
      </td>
      <td>
        <input
          className="doc-vault-block__input doc-vault-block__input--url"
          type="url"
          value={draft.url}
          placeholder={L.url}
          onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </td>
      {showRowView ? <td aria-hidden /> : null}
      <td className="doc-vault-block__row-actions">
        <button
          type="button"
          className="doc-vault-block__save"
          disabled={!canSave}
          onClick={handleSave}
        >
          {L.save}
        </button>
      </td>
    </>
  );

  const renderAffiliateStatusCell = (entry) => {
    if (!hasAffiliateData(entry)) {
      return <span className="doc-vault-block__empty">—</span>;
    }
    const meta = formatAffiliateRowMeta(entry);
    const statusLabel = meta.affiliateStatus === "pending"
      ? L.statusPending
      : meta.affiliateStatus === "active"
        ? L.statusActive
        : meta.affiliateStatus === "expired"
          ? L.statusExpired
          : null;
    return (
      <span
        className={
          "doc-vault-block__affiliate-status"
          + (meta.affiliateStatus ? ` is-${meta.affiliateStatus}` : "")
        }
      >
        {statusLabel ? (
          <span className="doc-vault-block__affiliate-status-label">{statusLabel}</span>
        ) : null}
        {meta.parts.length ? (
          <span className="doc-vault-block__affiliate-status-meta">
            {meta.parts.join(" · ")}
          </span>
        ) : null}
      </span>
    );
  };

  if (slashStack) {
    return (
      <div
        ref={rootRef}
        className={
          "doc-vault-block doc-vault-block--link doc-vault-block--slash-stack"
          + (compact ? " doc-vault-block--compact" : "")
          + (entries.length === 0 ? " doc-vault-block--empty" : "")
        }
      >
        {entries.length === 0 && onDeleteVault ? (
          <div className="doc-vault-block__slash-header">
            <div className="doc-vault-block__slash-hover-actions">
              <button
                type="button"
                className="doc-vault-block__slash-delete"
                onClick={onDeleteVault}
                aria-label="Delete"
              >
                delete
              </button>
            </div>
          </div>
        ) : null}

        <div
          className="doc-vault-block__slash-card"
          onMouseDown={handleCardPointerDown}
        >
          {visibleEntries.length > 0 ? (
            <ul className="doc-vault-block__stack-list">
              {visibleEntries.map((entry) => (
                <li key={entry.id} className="doc-vault-block__stack-entry">
                  <div className="doc-vault-block__stack-entry-body">
                    <span className="doc-vault-block__stack-name">{entry.name}</span>
                    {(entry.tag || entry.category) ? (
                      <span className="doc-vault-block__stack-meta">
                        {[entry.tag, entry.category].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {entry.description ? (
                      <span className="doc-vault-block__stack-description">{entry.description}</span>
                    ) : null}
                    <a
                      className="doc-vault-block__stack-link"
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {entry.url}
                    </a>
                  </div>
                  <button
                    type="button"
                    className="doc-vault-block__stack-remove"
                    onClick={() => handleRemoveEntry(entry.id)}
                    aria-label={`Eliminar ${entry.name}`}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showAddForm ? (
            <div className="doc-vault-block__stack-form">
              <input
                ref={nameRef}
                className="doc-vault-block__stack-field doc-vault-block__stack-field--name"
                type="text"
                value={draft.name}
                placeholder={L.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="doc-vault-block__tag-field">
                <input
                  className="doc-vault-block__stack-field doc-vault-block__stack-field--tag"
                  type="text"
                  value={draft.tag ?? ""}
                  placeholder={L.tag}
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, tag: e.target.value }));
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <input
                className="doc-vault-block__stack-field doc-vault-block__stack-field--category"
                type="text"
                value={draft.category ?? ""}
                placeholder={L.category}
                onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <textarea
                ref={descRef}
                rows={1}
                className="doc-vault-block__stack-field doc-vault-block__stack-field--description"
                value={draft.description}
                placeholder={L.description}
                maxLength={LINK_DESCRIPTION_MAX_LENGTH}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="doc-vault-block__stack-url-wrap">
                <img
                  src={URL_FIELD_ICON}
                  alt=""
                  aria-hidden
                  className="doc-vault-block__stack-url-icon"
                />
                <input
                  className="doc-vault-block__stack-field doc-vault-block__stack-field--url"
                  type="url"
                  value={draft.url}
                  placeholder=""
                  aria-label={L.url}
                  onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <button
                type="button"
                className="doc-vault-block__stack-save"
                disabled={!canSave}
                onClick={handleSave}
              >
                {L.save}
              </button>
            </div>
          ) : null}

          {showAddButton ? (
            <button
              type="button"
              className="doc-vault-block__stack-add"
              onClick={() => {
                setIsAdding(true);
                setDraft(EMPTY_DRAFT);
                window.requestAnimationFrame(() => nameRef.current?.focus());
              }}
              aria-label="Añadir link"
            >
              + link
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "doc-vault-block doc-vault-block--link"
        + (compact ? " doc-vault-block--compact" : "")
        + (entries.length === 0 ? " doc-vault-block--empty" : "")
      }
    >
      {entries.length === 0 && onDeleteVault ? (
        <div className="doc-vault-block__block-actions">
          <button
            type="button"
            className="doc-vault-block__action doc-vault-block__action--close"
            onClick={onDeleteVault}
            aria-label="Eliminar bloque de links"
            title="Eliminar"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="doc-vault-block__table-wrap">
        <table className="doc-vault-block__table">
          <thead>
            <tr>
              <th>{L.name}</th>
              <th>{renderColumnPicker("tag", L.tag, uniqueTags, "No tags yet")}</th>
              <th>{renderColumnPicker("category", L.category, uniqueCategories, "No categories yet")}</th>
              <th>
                <span className="doc-vault-block__th-with-icon">
                  <span className="doc-vault-block__th-icon doc-vault-block__th-icon--info" aria-hidden />
                  {L.description}
                </span>
              </th>
              <th>{L.url}</th>
              {showRowView ? <th>{L.status}</th> : null}
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.id} className="doc-vault-block__row">
                <td>
                  {entry.name ? (
                    <span className="doc-vault-block__name-chip">
                      <span className="doc-vault-block__name-chip-label">{entry.name}</span>
                    </span>
                  ) : (
                    <span className="doc-vault-block__empty">—</span>
                  )}
                </td>
                <td>
                  {entry.tag ? (
                    showRowView ? (
                      <span className="doc-vault-block__chip doc-vault-block__chip--tag doc-vault-block__chip--static">
                        <span className="doc-vault-block__chip-at" aria-hidden>@</span>
                        <span className="doc-vault-block__chip-label">{entry.tag}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="doc-vault-block__chip doc-vault-block__chip--tag"
                        onClick={() => applyChipValue("tag", entry.tag)}
                        title={`Use tag “${entry.tag}”`}
                      >
                        <span className="doc-vault-block__chip-at" aria-hidden>@</span>
                        <span className="doc-vault-block__chip-label">{entry.tag}</span>
                      </button>
                    )
                  ) : (
                    <span className="doc-vault-block__empty">—</span>
                  )}
                </td>
                <td>
                  {entry.category ? (
                    showRowView ? (
                      <span className="doc-vault-block__chip doc-vault-block__chip--category doc-vault-block__chip--static">
                        <span className="doc-vault-block__chip-label">{entry.category}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="doc-vault-block__chip doc-vault-block__chip--category"
                        onClick={() => applyChipValue("category", entry.category)}
                        title={`Use category “${entry.category}”`}
                      >
                        <span className="doc-vault-block__chip-label">{entry.category}</span>
                      </button>
                    )
                  ) : (
                    <span className="doc-vault-block__empty">—</span>
                  )}
                </td>
                <td>{entry.description || <span className="doc-vault-block__empty">—</span>}</td>
                <td>
                  {entry.url ? (
                    showRowView ? (
                      <span className="doc-vault-block__link doc-vault-block__link--static">
                        {entry.url}
                      </span>
                    ) : (
                      <a
                        className="doc-vault-block__link"
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.url}
                      </a>
                    )
                  ) : (
                    <span className="doc-vault-block__empty">—</span>
                  )}
                </td>
                {showRowView ? (
                  <td className="doc-vault-block__affiliate-cell">
                    {renderAffiliateStatusCell(entry)}
                  </td>
                ) : null}
                <td className="doc-vault-block__row-actions">
                  <div className="doc-vault-block__row-actions-inner">
                    {showRowView ? (
                      <button
                        type="button"
                        className="doc-vault-block__action doc-vault-block__action--view"
                        onClick={() => onViewEntry?.(entry)}
                        aria-label={`${L.view} ${entry.name || ""}`}
                        title={L.view}
                      >
                        {L.view}
                      </button>
                    ) : null}
                    <div className="doc-vault-block__hover-actions">
                      <button
                        type="button"
                        className="doc-vault-block__action doc-vault-block__action--close"
                        onClick={() => handleRemoveEntry(entry.id)}
                        aria-label={`Eliminar ${entry.name}`}
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {showAddForm ? (
            <tfoot>
              <tr className="doc-vault-block__form-row">
                {renderDraftFields()}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {showAddButton ? (
        <button
          type="button"
          className="doc-vault-block__add"
          onClick={() => {
            setIsAdding(true);
            setDraft(EMPTY_DRAFT);
            window.requestAnimationFrame(() => nameRef.current?.focus());
          }}
          aria-label="Añadir link"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
