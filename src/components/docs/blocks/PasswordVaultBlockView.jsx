import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPasswordEntry } from "../../../lib/vaultBlocks.js";
import { VaultEyeIcon } from "./VaultEyeIcon.jsx";

const EMPTY_DRAFT = { description: "", password: "" };

const DEFAULT_LABELS = {
  description: "Description",
  password: "Password",
  save: "Save",
};

export function PasswordVaultBlockView({
  entries = [],
  onEntriesChange,
  onSaveEntry = null,
  onDeleteVault,
  openAddForm = false,
  compact = false,
  slashStack = false,
  labels,
  filterQuery = "",
  hideAddButton = false,
  addFormRequest = 0,
}) {
  const L = { ...DEFAULT_LABELS, ...(labels || {}) };
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showPassword, setShowPassword] = useState(false);
  const [revealedEntryIds, setRevealedEntryIds] = useState(() => new Set());
  const [isAdding, setIsAdding] = useState(entries.length === 0);
  const descriptionRef = useRef(null);

  useEffect(() => {
    if (entries.length === 0) {
      setIsAdding(true);
    }
  }, [entries.length]);

  useEffect(() => {
    if (!openAddForm) return;
    setIsAdding(true);
    const timer = window.setTimeout(() => descriptionRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [openAddForm]);

  useEffect(() => {
    if (!addFormRequest) return;
    setIsAdding(true);
    setDraft(EMPTY_DRAFT);
    setShowPassword(false);
    const timer = window.setTimeout(() => descriptionRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [addFormRequest]);

  const visibleEntries = useMemo(() => {
    const normalized = String(filterQuery ?? "").trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => (
      String(entry.description ?? "").toLowerCase().includes(normalized)
      || String(entry.tag ?? "").toLowerCase().includes(normalized)
    ));
  }, [entries, filterQuery]);

  const canSave = Boolean(draft.description.trim() && draft.password.trim());

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const entry = createPasswordEntry(draft);
    if (onSaveEntry) {
      onSaveEntry(entry);
      return;
    }
    onEntriesChange?.([
      ...entries,
      entry,
    ]);
    setDraft(EMPTY_DRAFT);
    setShowPassword(false);
    setIsAdding(false);
  }, [canSave, draft, entries, onEntriesChange, onSaveEntry]);

  const handleRemoveEntry = useCallback((entryId) => {
    onEntriesChange?.(entries.filter((entry) => entry.id !== entryId));
  }, [entries, onEntriesChange]);

  const toggleRevealEntry = useCallback((entryId) => {
    setRevealedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const showAddForm = isAdding;
  const showAddButton = !hideAddButton && entries.length > 0 && !isAdding;

  if (slashStack) {
    return (
      <div
        className={
          "doc-vault-block doc-vault-block--password doc-vault-block--slash-stack doc-vault-block--slash-row"
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

        <div className="doc-vault-block__slash-card">
          {visibleEntries.length > 0 ? (
            <ul className="doc-vault-block__row-list">
              {visibleEntries.map((entry) => {
                const isRevealed = revealedEntryIds.has(entry.id);
                return (
                  <li key={entry.id} className="doc-vault-block__row-entry">
                    <span className="doc-vault-block__row-description">
                      {entry.description}
                    </span>
                    <div className="doc-vault-block__row-password-wrap">
                      <span
                        className={
                          "doc-vault-block__row-password-value "
                          + (isRevealed
                            ? "doc-vault-block__password-plain"
                            : "doc-vault-block__masked")
                        }
                      >
                        {isRevealed ? entry.password : "••••••••"}
                      </span>
                      <button
                        type="button"
                        className="doc-vault-block__eye doc-vault-block__row-eye"
                        onClick={() => toggleRevealEntry(entry.id)}
                        aria-label={isRevealed ? "Ocultar contraseña" : "Mostrar contraseña"}
                        title={isRevealed ? "Ocultar" : "Mostrar"}
                      >
                        <VaultEyeIcon off={isRevealed} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="doc-vault-block__stack-remove"
                      onClick={() => handleRemoveEntry(entry.id)}
                      aria-label={`Eliminar ${entry.description}`}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showAddForm ? (
            <div className="doc-vault-block__row-form">
              <input
                ref={descriptionRef}
                className="doc-vault-block__stack-field doc-vault-block__row-field--description"
                type="text"
                value={draft.description}
                placeholder={L.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="doc-vault-block__row-password-wrap">
                <input
                  className="doc-vault-block__stack-field doc-vault-block__row-field--password"
                  type={showPassword ? "text" : "password"}
                  value={draft.password}
                  placeholder={L.password}
                  autoComplete="off"
                  onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="doc-vault-block__eye doc-vault-block__row-eye"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <VaultEyeIcon off={showPassword} />
                </button>
              </div>
              <button
                type="button"
                className="doc-vault-block__stack-save doc-vault-block__row-save"
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
                setShowPassword(false);
                window.requestAnimationFrame(() => descriptionRef.current?.focus());
              }}
              aria-label="Añadir contraseña"
            >
              + password
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "doc-vault-block doc-vault-block--password"
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
            aria-label="Eliminar bloque de contraseñas"
            title="Eliminar"
          >
            ×
          </button>
        </div>
      ) : null}

      {visibleEntries.length > 0 ? (
        <div className="doc-vault-block__table-wrap">
          <table className="doc-vault-block__table">
            <thead>
              <tr>
                <th>{L.description}</th>
                <th>{L.password}</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry) => {
                const isRevealed = revealedEntryIds.has(entry.id);
                return (
                  <tr key={entry.id} className="doc-vault-block__row">
                    <td>{entry.description}</td>
                    <td>
                      <div className="doc-vault-block__password-wrap doc-vault-block__password-wrap--saved">
                        <span
                          className={
                            "doc-vault-block__password-saved-value "
                            + (isRevealed
                              ? "doc-vault-block__password-plain"
                              : "doc-vault-block__masked")
                          }
                        >
                          {isRevealed ? entry.password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          className="doc-vault-block__eye"
                          onClick={() => toggleRevealEntry(entry.id)}
                          aria-label={isRevealed ? "Ocultar contraseña" : "Mostrar contraseña"}
                          title={isRevealed ? "Ocultar" : "Mostrar"}
                        >
                          <VaultEyeIcon off={isRevealed} />
                        </button>
                      </div>
                    </td>
                    <td className="doc-vault-block__row-actions">
                      <div className="doc-vault-block__hover-actions">
                        <button
                          type="button"
                          className="doc-vault-block__action doc-vault-block__action--close"
                          onClick={() => handleRemoveEntry(entry.id)}
                          aria-label={`Eliminar ${entry.description}`}
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {showAddForm ? (
        <div className="doc-vault-block__form doc-vault-block__form--password">
          <input
            ref={descriptionRef}
            className="doc-vault-block__input"
            type="text"
            value={draft.description}
            placeholder={L.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="doc-vault-block__password-wrap">
            <input
              className="doc-vault-block__input doc-vault-block__input--password"
              type={showPassword ? "text" : "password"}
              value={draft.password}
              placeholder={L.password}
              autoComplete="off"
              onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="doc-vault-block__eye"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              <VaultEyeIcon off={showPassword} />
            </button>
          </div>
          <button
            type="button"
            className="doc-vault-block__save"
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
          className="doc-vault-block__add"
          onClick={() => {
            setIsAdding(true);
            setDraft(EMPTY_DRAFT);
            setShowPassword(false);
            window.requestAnimationFrame(() => descriptionRef.current?.focus());
          }}
          aria-label="Añadir contraseña"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
