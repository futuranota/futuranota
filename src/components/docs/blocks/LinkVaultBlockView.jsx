import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createLinkEntry, normalizeUrlInput } from "../../../lib/vaultBlocks.js";

const EMPTY_DRAFT = { name: "", tag: "", category: "", description: "", url: "" };
const URL_FIELD_ICON = "/uploads/url-table.svg";

const DEFAULT_LABELS = {
  name: "Name",
  tag: "Tag",
  category: "Category",
  description: "Description",
  url: "URL",
  save: "Save",
};

export function LinkVaultBlockView({
  entries = [],
  onEntriesChange,
  onSaveEntry = null,
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
      onSaveEntry(entry);
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
  }, [canSave, draft, entries, onEntriesChange, onSaveEntry]);

  const handleRemoveEntry = useCallback((entryId) => {
    onEntriesChange?.(entries.filter((entry) => entry.id !== entryId));
  }, [entries, onEntriesChange]);

  const applyChipValue = useCallback((field, value) => {
    const next = String(value ?? "").trim();
    if (!next) return;
    setIsAdding(true);
    setDraft((prev) => ({ ...prev, [field]: next }));
    setOpenPicker(null);
  }, [setDraft]);

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
                  <button
                    key={value}
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
        <input
          className="doc-vault-block__input"
          type="text"
          value={draft.tag ?? ""}
          placeholder={L.tag}
          onChange={(e) => setDraft((prev) => ({ ...prev, tag: e.target.value }))}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
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
              <input
                className="doc-vault-block__stack-field doc-vault-block__stack-field--tag"
                type="text"
                value={draft.tag ?? ""}
                placeholder={L.tag}
                onChange={(e) => setDraft((prev) => ({ ...prev, tag: e.target.value }))}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
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
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.id} className="doc-vault-block__row">
                <td>{entry.name}</td>
                <td>
                  {entry.tag ? (
                    <button
                      type="button"
                      className="doc-vault-block__chip doc-vault-block__chip--tag"
                      onClick={() => applyChipValue("tag", entry.tag)}
                      title={`Use tag “${entry.tag}”`}
                    >
                      <svg
                        className="doc-vault-block__chip-icon doc-vault-block__chip-icon--tag"
                        width="11"
                        height="11"
                        viewBox="0 0 27 27"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path
                          d="M25.6616 14.3438L15.1875 3.86966C15.0314 3.71228 14.8455 3.5875 14.6407 3.50258C14.436 3.41767 14.2163 3.3743 13.9947 3.37501H4.21876C3.99498 3.37501 3.78037 3.4639 3.62214 3.62214C3.4639 3.78037 3.37501 3.99498 3.37501 4.21876V13.9947C3.3743 14.2163 3.41767 14.436 3.50258 14.6407C3.5875 14.8455 3.71228 15.0314 3.86966 15.1875L14.3438 25.6616C14.5005 25.8183 14.6865 25.9427 14.8913 26.0275C15.096 26.1123 15.3155 26.156 15.5371 26.156C15.7588 26.156 15.9782 26.1123 16.183 26.0275C16.3878 25.9427 16.5738 25.8183 16.7305 25.6616L25.6616 16.7305C25.8183 16.5738 25.9427 16.3878 26.0275 16.183C26.1123 15.9782 26.156 15.7588 26.156 15.5371C26.156 15.3155 26.1123 15.096 26.0275 14.8913C25.9427 14.6865 25.8183 14.5005 25.6616 14.3438ZM15.5366 24.4688L5.06251 13.9947V5.06251H13.9947L24.4688 15.5366L15.5366 24.4688ZM10.125 8.85938C10.125 9.1097 10.0508 9.3544 9.91171 9.56253C9.77264 9.77066 9.57498 9.93288 9.34372 10.0287C9.11245 10.1245 8.85798 10.1495 8.61247 10.1007C8.36696 10.0519 8.14145 9.93132 7.96445 9.75432C7.78745 9.57731 7.66691 9.3518 7.61808 9.1063C7.56924 8.86079 7.59431 8.60631 7.6901 8.37505C7.78589 8.14379 7.94811 7.94612 8.15624 7.80705C8.36437 7.66799 8.60907 7.59376 8.85938 7.59376C9.19505 7.59376 9.51696 7.7271 9.75432 7.96445C9.99167 8.2018 10.125 8.52372 10.125 8.85938Z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="doc-vault-block__chip-label">{entry.tag}</span>
                    </button>
                  ) : (
                    <span className="doc-vault-block__empty">—</span>
                  )}
                </td>
                <td>
                  {entry.category ? (
                    <button
                      type="button"
                      className="doc-vault-block__chip doc-vault-block__chip--category"
                      onClick={() => applyChipValue("category", entry.category)}
                      title={`Use category “${entry.category}”`}
                    >
                      {entry.category}
                    </button>
                  ) : (
                    <span className="doc-vault-block__empty">—</span>
                  )}
                </td>
                <td>{entry.description || <span className="doc-vault-block__empty">—</span>}</td>
                <td>
                  <a
                    className="doc-vault-block__link"
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.url}
                  </a>
                </td>
                <td className="doc-vault-block__row-actions">
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
