import { useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { copyToClipboard } from "../../lib/copyToClipboard.js";
import { LibraryAssetPromptLabel } from "./LibraryAssetPromptGuide.jsx";

/**
 * Read-only asset field — name (reference) or prompt (copy inside panel).
 */
export function LibraryAssetReadonlyField({
  label,
  value = "",
  copyLabel,
  copyable = false,
  multiline = false,
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const text = String(value || "").trim();
  const canCopy = copyable && Boolean(text);

  const handleCopy = async () => {
    if (!canCopy) return;
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const copyAria = copied ? t("doc.library.copied") : (copyLabel || t("doc.library.copy"));
  const isPrompt = copyable && multiline;

  return (
    <div
      className={
        "library-asset-field-readonly folder-library-element-modal__field"
        + (isPrompt ? " library-asset-prompt-field" : "")
      }
    >
      {isPrompt ? (
        <LibraryAssetPromptLabel />
      ) : (
        <span className="folder-library-element-modal__label">{label}</span>
      )}
      <div
        className={
          "library-asset-panel-surface"
          + (isPrompt
            ? " library-asset-field-readonly__prompt"
            : " library-asset-field-readonly__name")
        }
      >
        {isPrompt ? (
          text ? (
            <p className="library-asset-field-readonly__prompt-text">{text}</p>
          ) : (
            <p className="library-asset-field-readonly__prompt-empty">
              {t("doc.library.assetDescriptionPlaceholder")}
            </p>
          )
        ) : (
          <span className="library-asset-field-readonly__name-text">
            {text || "—"}
          </span>
        )}
        {copyable ? (
          <button
            type="button"
            className="library-asset-field-readonly__copy"
            onClick={handleCopy}
            disabled={!canCopy}
            aria-label={copyAria}
            title={copyAria}
          >
            {copied ? "✓" : "⧉"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
