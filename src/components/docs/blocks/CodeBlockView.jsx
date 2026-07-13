import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CODE_BLOCK_LANGUAGES,
  codeLanguageLabel,
  normalizeCodeLanguage,
} from "../../../lib/codeBlockLanguages.js";
import { highlightCodeSnippet } from "../../../lib/highlightCodeSnippet.js";
import {
  buildCodePreviewSrcDoc,
  isCodePreviewable,
} from "../../../lib/codeBlockPreview.js";
import { MarkdownPreview } from "./MarkdownPreview.jsx";

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
  deleteLabel = "delete",
  editLabel = "edit",
  autoFocus = false,
  compact = false,
}) {
  const textareaRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [savedTab, setSavedTab] = useState("preview"); // preview | code
  const normalizedLanguage = normalizeCodeLanguage(language);
  const isMarkdownPreview = normalizedLanguage === "markdown";
  const canLivePreview = isCodePreviewable(normalizedLanguage);
  const isSavedView = Boolean(codeSaved && code.trim());

  useEffect(() => {
    if (!isSavedView || !canLivePreview) return;
    setSavedTab("preview");
  }, [isSavedView, canLivePreview, code, normalizedLanguage]);

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

  const showCodePane = !canLivePreview || savedTab === "code";
  const showPreviewPane = canLivePreview && savedTab === "preview";

  const highlightedHtml = useMemo(
    () => (
      isSavedView && !isMarkdownPreview && showCodePane
        ? highlightCodeSnippet(code, normalizedLanguage)
        : ""
    ),
    [code, isMarkdownPreview, isSavedView, normalizedLanguage, showCodePane],
  );

  const previewSrcDoc = useMemo(
    () => (
      isSavedView && canLivePreview
        ? buildCodePreviewSrcDoc(normalizedLanguage, code)
        : ""
    ),
    [canLivePreview, code, isSavedView, normalizedLanguage],
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

  const wrapClass = [
    "doc-code-block-wrap",
    compact ? "doc-code-block-wrap--compact" : "",
  ].filter(Boolean).join(" ");

  if (isSavedView) {
    return (
      <div className={wrapClass}>
        <div className="doc-code-block__slash-header">
          <div className="doc-code-block__slash-hover-actions">
            <button
              type="button"
              className="doc-code-block__slash-action"
              onClick={() => { void handleCopy(); }}
              aria-label={`Copy ${codeLanguageLabel(normalizedLanguage)} code`}
            >
              {copied ? "copied" : "copy"}
            </button>
            {onEdit ? (
              <button
                type="button"
                className="doc-code-block__slash-action"
                onClick={onEdit}
                aria-label={`Edit ${codeLanguageLabel(normalizedLanguage)}`}
              >
                {editLabel}
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="doc-code-block__slash-action doc-code-block__slash-action--delete"
                onClick={onDelete}
              >
                {deleteLabel}
              </button>
            ) : null}
          </div>
        </div>
        <div
          className={
            "doc-code-block doc-code-block--saved"
            + (compact ? " doc-code-block--compact" : "")
            + (isMarkdownPreview ? " doc-code-block--markdown-preview" : "")
            + (showPreviewPane ? " doc-code-block--live-preview" : "")
          }
        >
          <div className="doc-code-block__header">
            <span className="doc-code-block__lang-badge">
              {codeLanguageLabel(normalizedLanguage)}
            </span>
            {canLivePreview ? (
              <div className="doc-code-block__view-tabs" role="tablist" aria-label="Code view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={savedTab === "preview"}
                  className={
                    "doc-code-block__view-tab"
                    + (savedTab === "preview" ? " is-active" : "")
                  }
                  onClick={() => setSavedTab("preview")}
                >
                  Preview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={savedTab === "code"}
                  className={
                    "doc-code-block__view-tab"
                    + (savedTab === "code" ? " is-active" : "")
                  }
                  onClick={() => setSavedTab("code")}
                >
                  Code
                </button>
              </div>
            ) : null}
          </div>
          {isMarkdownPreview ? (
            <button
              type="button"
              className="doc-code-block__markdown-preview"
              onClick={() => onEdit?.()}
              aria-label="Edit markdown"
            >
              <MarkdownPreview source={code} />
            </button>
          ) : showPreviewPane ? (
            <div className="doc-code-block__live-preview">
              <iframe
                className="doc-code-block__iframe"
                title={`${codeLanguageLabel(normalizedLanguage)} preview`}
                sandbox="allow-scripts"
                srcDoc={previewSrcDoc}
                loading="lazy"
              />
            </div>
          ) : (
            <button
              type="button"
              className="doc-code-block__snippet"
              onClick={() => onEdit?.()}
              aria-label="Edit code snippet"
            >
              <pre className="doc-code-block__pre">
                <code
                  className="doc-code-block__highlight hljs"
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </pre>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <div className="doc-code-block__slash-header">
        <div className="doc-code-block__slash-hover-actions">
          <button
            type="button"
            className="doc-code-block__slash-action doc-code-block__slash-action--save"
            onClick={handleSave}
            disabled={!code.trim()}
          >
            save
          </button>
          {onDelete ? (
            <button
              type="button"
              className="doc-code-block__slash-action doc-code-block__slash-action--delete"
              onClick={onDelete}
            >
              {deleteLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className={"doc-code-block" + (compact ? " doc-code-block--compact" : "")}>
        <div className="doc-code-block__toolbar">
          <label className="doc-code-block__lang-label">
            <span className="doc-code-block__lang-caption">Language</span>
            <select
              className="doc-code-block__lang-select"
              value={normalizedLanguage}
              onChange={(e) => onLanguageChange?.(normalizeCodeLanguage(e.target.value))}
              aria-label="Programming language"
            >
              {CODE_BLOCK_LANGUAGES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          {canLivePreview ? (
            <span className="doc-code-block__preview-hint">Preview after save</span>
          ) : null}
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
          placeholder={
            isMarkdownPreview
              ? "# Write or paste markdown here"
              : canLivePreview
                ? normalizedLanguage === "css"
                  ? "/* CSS — preview shows sample content after save */"
                  : normalizedLanguage === "html"
                    ? "<!-- HTML — live preview after save -->"
                    : "// JavaScript — live preview after save"
                : "// Write or paste your code here"
          }
          onChange={(e) => {
            onCodeChange?.(e.target.value);
            syncCodeTextareaHeight(e.target);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
