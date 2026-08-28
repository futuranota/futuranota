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
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";
import { useI18n } from "../../../i18n/useI18n.js";
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

function readClipboardImageFile(event) {
  const items = event.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  const files = event.clipboardData?.files;
  if (files?.length) {
    for (let i = 0; i < files.length; i += 1) {
      if (files[i].type.startsWith("image/")) return files[i];
    }
  }
  return null;
}

export function CodeBlockView({
  language = "javascript",
  code = "",
  codeSaved = false,
  referenceImage = null,
  uploadScopeId = null,
  onLanguageChange,
  onCodeChange,
  onReferenceImageChange,
  onSave,
  onEdit,
  onDelete,
  deleteLabel = "delete",
  editLabel = "edit",
  autoFocus = false,
  compact = false,
}) {
  const { t } = useI18n();
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [savedTab, setSavedTab] = useState("code");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [awaitingPaste, setAwaitingPaste] = useState(false);
  const normalizedLanguage = normalizeCodeLanguage(language);
  const isMarkdownPreview = normalizedLanguage === "markdown";
  const canLivePreview = isCodePreviewable(normalizedLanguage);
  const isSavedView = Boolean(codeSaved && code.trim());
  const referenceSrc = String(referenceImage?.src ?? "").trim();
  const hasReferenceImage = Boolean(referenceSrc);

  useEffect(() => {
    if (!isSavedView) return;
    if (hasReferenceImage) {
      setSavedTab("ui");
    } else if (canLivePreview) {
      setSavedTab("preview");
    } else {
      setSavedTab("code");
    }
  }, [isSavedView, hasReferenceImage, canLivePreview, code, normalizedLanguage]);

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

  useEffect(() => {
    if (!awaitingPaste) return;
    const timer = window.setTimeout(() => setAwaitingPaste(false), 12000);
    return () => window.clearTimeout(timer);
  }, [awaitingPaste]);

  const highlightedHtml = useMemo(
    () => (
      isSavedView && !isMarkdownPreview && savedTab === "code"
        ? highlightCodeSnippet(code, normalizedLanguage)
        : ""
    ),
    [code, isMarkdownPreview, isSavedView, normalizedLanguage, savedTab],
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

  const uploadReferenceFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setUploadError(t("doc.codeBlock.referenceInvalidType"));
      return;
    }
    setUploading(true);
    setUploadError("");
    setAwaitingPaste(false);
    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "CODEREF",
        scopeId: uploadScopeId || "code-block",
      });
      if (!converted?.src) throw new Error("empty url");
      onReferenceImageChange?.({
        src: converted.src,
        name: converted.name,
        width: converted.width,
        height: converted.height,
        alt: "",
        caption: "",
      });
    } catch (err) {
      console.warn("[code-block] reference image upload failed", err);
      setUploadError(t("doc.codeBlock.referenceUploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [onReferenceImageChange, t, uploadScopeId]);

  const handlePaste = useCallback((event) => {
    const file = readClipboardImageFile(event);
    if (!file) return;
    event.preventDefault();
    void uploadReferenceFile(file);
  }, [uploadReferenceFile]);

  const handleAddReferenceClick = useCallback(() => {
    setUploadError("");
    setAwaitingPaste(true);
    fileRef.current?.click();
  }, []);

  const wrapClass = [
    "doc-code-block-wrap",
    compact ? "doc-code-block-wrap--compact" : "",
  ].filter(Boolean).join(" ");

  const showSavedTabs = hasReferenceImage || canLivePreview || isMarkdownPreview;

  const renderSavedHeaderTabs = () => {
    if (!showSavedTabs) return null;
    return (
      <div className="doc-code-block__view-tabs" role="tablist" aria-label="Code view">
        {hasReferenceImage ? (
          <button
            type="button"
            role="tab"
            aria-selected={savedTab === "ui"}
            className={
              "doc-code-block__view-tab"
              + (savedTab === "ui" ? " is-active" : "")
            }
            onClick={() => setSavedTab("ui")}
          >
            {t("doc.codeBlock.uiTab")}
          </button>
        ) : null}
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
        {canLivePreview ? (
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
        ) : null}
      </div>
    );
  };

  const renderSavedBody = () => {
    if (savedTab === "ui" && hasReferenceImage) {
      return (
        <div className="doc-code-block__ui-tab">
          <img
            src={referenceSrc}
            alt={referenceImage?.alt || t("doc.codeBlock.referenceAlt")}
            draggable={false}
          />
        </div>
      );
    }
    if (isMarkdownPreview && savedTab === "code") {
      return (
        <button
          type="button"
          className="doc-code-block__markdown-preview"
          onClick={() => onEdit?.()}
          aria-label="Edit markdown"
        >
          <MarkdownPreview source={code} />
        </button>
      );
    }
    if (savedTab === "preview" && canLivePreview) {
      return (
        <div className="doc-code-block__live-preview">
          <iframe
            className="doc-code-block__iframe"
            title={`${codeLanguageLabel(normalizedLanguage)} preview`}
            sandbox="allow-scripts"
            srcDoc={previewSrcDoc}
            loading="lazy"
          />
        </div>
      );
    }
    return (
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
    );
  };

  const renderEditReferenceControls = () => (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="doc-code-block__ref-file"
        onChange={(event) => {
          void uploadReferenceFile(event.target.files?.[0]);
        }}
      />
      {hasReferenceImage ? (
        <div className="doc-code-block__ref-chip">
          <img
            src={referenceSrc}
            alt=""
            draggable={false}
          />
          <button
            type="button"
            className="doc-code-block__ref-chip-clear"
            onClick={() => onReferenceImageChange?.(null)}
            aria-label={t("doc.codeBlock.removeReference")}
            title={t("doc.codeBlock.removeReference")}
          >
            ×
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="doc-code-block__slash-action doc-code-block__slash-action--ref"
        onClick={handleAddReferenceClick}
        disabled={uploading}
        title={t("doc.codeBlock.referencePasteHint")}
      >
        {uploading ? t("doc.codeBlock.referenceUploading") : t("doc.codeBlock.addReference")}
      </button>
    </>
  );

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
            + (savedTab === "preview" ? " doc-code-block--live-preview" : "")
            + (hasReferenceImage ? " doc-code-block--has-ref" : "")
          }
        >
          <div className="doc-code-block__header">
            <span className="doc-code-block__lang-badge">
              {codeLanguageLabel(normalizedLanguage)}
            </span>
            {renderSavedHeaderTabs()}
          </div>
          {renderSavedBody()}
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
          {renderEditReferenceControls()}
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
        className={"doc-code-block" + (compact ? " doc-code-block--compact" : "")}
        onPaste={handlePaste}
      >
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
            <span className="doc-code-block__preview-tag">
              {t("doc.codeBlock.previewAvailable")}
            </span>
          ) : null}
        </div>
        {awaitingPaste && !hasReferenceImage ? (
          <p className="doc-code-block__ref-await">{t("doc.codeBlock.referencePasteNow")}</p>
        ) : null}
        {uploadError ? (
          <p className="doc-code-block__ref-error doc-code-block__ref-error--edit">{uploadError}</p>
        ) : null}
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
