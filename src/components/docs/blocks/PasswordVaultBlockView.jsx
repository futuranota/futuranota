import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "../../../lib/copyToClipboard.js";
import { createPasswordEntry } from "../../../lib/vaultBlocks.js";
import { VaultEyeIcon } from "./VaultEyeIcon.jsx";

const EMPTY_DRAFT = { description: "", password: "" };

export function PasswordVaultBlockView({
  entries = [],
  onEntriesChange,
  onDeleteVault,
  autoFocus = false,
  compact = false,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [copiedId, setCopiedId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAdding, setIsAdding] = useState(entries.length === 0);
  const descriptionRef = useRef(null);

  useEffect(() => {
    if (entries.length === 0) {
      setIsAdding(true);
    }
  }, [entries.length]);

  useEffect(() => {
    if (!autoFocus || !isAdding) return;
    const timer = window.setTimeout(() => descriptionRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [autoFocus, isAdding]);

  const canSave = Boolean(draft.description.trim() && draft.password.trim());

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onEntriesChange?.([
      ...entries,
      createPasswordEntry(draft),
    ]);
    setDraft(EMPTY_DRAFT);
    setShowPassword(false);
    setIsAdding(false);
  }, [canSave, draft, entries, onEntriesChange]);

  const handleRemoveEntry = useCallback((entryId) => {
    onEntriesChange?.(entries.filter((entry) => entry.id !== entryId));
  }, [entries, onEntriesChange]);

  const handleCopyPassword = useCallback(async (entry) => {
    const ok = await copyToClipboard(entry.password);
    if (!ok) return;
    setCopiedId(entry.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }, []);

  const showAddForm = isAdding;
  const showAddButton = entries.length > 0 && !isAdding;

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

      {entries.length > 0 ? (
        <div className="doc-vault-block__table-wrap">
          <table className="doc-vault-block__table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Contraseña</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="doc-vault-block__row">
                  <td>{entry.description}</td>
                  <td>
                    <span className="doc-vault-block__masked">••••••••</span>
                  </td>
                  <td className="doc-vault-block__row-actions">
                    <div className="doc-vault-block__hover-actions">
                      <button
                        type="button"
                        className="doc-vault-block__action doc-vault-block__action--copy"
                        onClick={() => { void handleCopyPassword(entry); }}
                        aria-label={`Copiar contraseña de ${entry.description}`}
                      >
                        {copiedId === entry.id ? "Copiado" : "Copiar"}
                      </button>
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
              ))}
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
            placeholder="Descripción"
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="doc-vault-block__password-wrap">
            <input
              className="doc-vault-block__input doc-vault-block__input--password"
              type={showPassword ? "text" : "password"}
              value={draft.password}
              placeholder="Contraseña"
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
