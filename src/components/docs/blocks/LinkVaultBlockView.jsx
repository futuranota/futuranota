import { useCallback, useEffect, useRef, useState } from "react";
import { createLinkEntry, normalizeUrlInput } from "../../../lib/vaultBlocks.js";

const EMPTY_DRAFT = { name: "", description: "", url: "" };

export function LinkVaultBlockView({
  entries = [],
  onEntriesChange,
  onDeleteVault,
  openAddForm = false,
  compact = false,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [isAdding, setIsAdding] = useState(entries.length === 0);
  const nameRef = useRef(null);

  useEffect(() => {
    if (entries.length === 0) {
      setIsAdding(true);
    }
  }, [entries.length]);

  useEffect(() => {
    if (!openAddForm) return;
    setIsAdding(true);
    const timer = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [openAddForm]);

  const canSave = Boolean(draft.name.trim() && draft.url.trim());

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onEntriesChange?.([
      ...entries,
      createLinkEntry({
        ...draft,
        url: normalizeUrlInput(draft.url),
      }),
    ]);
    setDraft(EMPTY_DRAFT);
    setIsAdding(false);
  }, [canSave, draft, entries, onEntriesChange]);

  const handleRemoveEntry = useCallback((entryId) => {
    onEntriesChange?.(entries.filter((entry) => entry.id !== entryId));
  }, [entries, onEntriesChange]);

  const showAddForm = isAdding;
  const showAddButton = entries.length > 0 && !isAdding;

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

      {entries.length > 0 ? (
        <div className="doc-vault-block__table-wrap">
          <table className="doc-vault-block__table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Link</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="doc-vault-block__row">
                  <td>{entry.name}</td>
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
          </table>
        </div>
      ) : null}

      {showAddForm ? (
        <div className="doc-vault-block__form doc-vault-block__form--link">
          <input
            ref={nameRef}
            className="doc-vault-block__input"
            type="text"
            value={draft.name}
            placeholder="Nombre"
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <input
            className="doc-vault-block__input"
            type="text"
            value={draft.description}
            placeholder="Descripción"
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <input
            className="doc-vault-block__input doc-vault-block__input--url"
            type="url"
            value={draft.url}
            placeholder="Link"
            onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="doc-vault-block__save"
            disabled={!canSave}
            onClick={handleSave}
          >
            Guardar
          </button>
        </div>
      ) : null}

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
