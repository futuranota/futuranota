import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CODE_BLOCK_LANGUAGES,
  codeLanguageLabel,
  normalizeCodeLanguage,
} from "../../../lib/codeBlockLanguages.js";
import { highlightCodeSnippet } from "../../../lib/highlightCodeSnippet.js";

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

function syncCodeTextareaHeight(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 96)}px`;
}

export function CodeBlockView({
  language = "javascript",
  code = "",
  codeSaved = false,
  onLanguageChange,
  onCodeChange,
  onSave,
  onEdit,
  onDelete,
  deleteLabel = "Eliminar",
  autoFocus = false,
  compact = false,
}) {
  const textareaRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const normalizedLanguage = normalizeCodeLanguage(language);
  const isSavedView = Boolean(codeSaved && code.trim());

  useEffect(() => {
    if (!autoFocus || isSavedView) return;
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoFocus, isSavedView]);

  useEffect(() => {
    if (isSavedView) return;
    syncCodeTextareaHeight(textareaRef.current);
  }, [code, isSavedView]);

  const highlightedHtml = useMemo(
    () => (isSavedView ? highlightCodeSnippet(code, normalizedLanguage) : ""),
    [code, isSavedView, normalizedLanguage],
  );

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [code]);

  const handleSave = useCallback(() => {
    if (!code.trim()) return;
    onSave?.();
  }, [code, onSave]);

  if (isSavedView) {
    return (
      <div
        className={
          "doc-code-block doc-code-block--saved"
          + (compact ? " doc-code-block--compact" : "")
        }
      >
        <div className="doc-code-block__header">
          <span className="doc-code-block__lang-badge">
            {codeLanguageLabel(normalizedLanguage)}
          </span>
          <div className="doc-code-block__hover-actions" aria-hidden={false}>
            <button
              type="button"
              className="doc-code-block__action doc-code-block__action--copy"
              onClick={() => { void handleCopy(); }}
              aria-label={`Copiar código ${codeLanguageLabel(normalizedLanguage)}`}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
            {onDelete ? (
              <button
                type="button"
                className="doc-code-block__action doc-code-block__action--delete"
                onClick={onDelete}
              >
                {deleteLabel}
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="doc-code-block__snippet"
          onClick={() => onEdit?.()}
          aria-label="Editar snippet de código"
        >
          <pre className="doc-code-block__pre">
            <code
              className="doc-code-block__highlight hljs"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>
        </button>
      </div>
    );
  }

  return (
    <div className={"doc-code-block" + (compact ? " doc-code-block--compact" : "")}>
      <div className="doc-code-block__toolbar">
        <label className="doc-code-block__lang-label">
          <span className="doc-code-block__lang-caption">Lenguaje</span>
          <select
            className="doc-code-block__lang-select"
            value={normalizedLanguage}
            onChange={(e) => onLanguageChange?.(normalizeCodeLanguage(e.target.value))}
            aria-label="Lenguaje de programación"
          >
            {CODE_BLOCK_LANGUAGES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <div className="doc-code-block__actions">
          <button
            type="button"
            className="doc-code-block__save"
            onClick={handleSave}
            disabled={!code.trim()}
          >
            Guardar
          </button>
          {onDelete ? (
            <button
              type="button"
              className="doc-code-block__delete"
              onClick={onDelete}
            >
              {deleteLabel}
            </button>
          ) : null}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="doc-code-block__editor"
        value={code}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        placeholder="// Escribe o pega tu código aquí"
        onChange={(e) => {
          onCodeChange?.(e.target.value);
          syncCodeTextareaHeight(e.target);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
