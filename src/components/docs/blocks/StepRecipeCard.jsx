import { useCallback, useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";
import { useI18n } from "../../../i18n/useI18n.js";

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

function RecipeImageSlot({
  label,
  image,
  optional = false,
  readOnly = false,
  uploading = false,
  onPick,
  onClear,
  inputRef,
  onFiles,
}) {
  const { t } = useI18n();
  const src = image?.src;
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="doc-step-recipe__slot">
      <span className="doc-step-recipe__slot-label">{label}</span>
      <input
        ref={inputRef}
        type="file"
        className="doc-step-recipe__file"
        accept="image/*"
        disabled={readOnly}
        onChange={(event) => {
          onFiles?.(event.target.files);
          event.target.value = "";
        }}
      />
      {src ? (
        <div className="doc-step-recipe__preview">
          <img
            className="doc-step-recipe__img"
            src={src}
            alt={image.alt || image.name || label}
            width={image.width || undefined}
            height={image.height || undefined}
            draggable={false}
          />
          {!readOnly ? (
            <div className="doc-step-recipe__preview-actions">
              <button type="button" className="doc-step-recipe__mini" onClick={onPick} disabled={uploading}>
                {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.replace")}
              </button>
              <button type="button" className="doc-step-recipe__mini" onClick={onClear} disabled={uploading}>
                {t("doc.imageBlock.remove")}
              </button>
            </div>
          ) : null}
        </div>
      ) : readOnly ? (
        <div className={`doc-step-recipe__empty${optional ? " doc-step-recipe__empty--optional" : ""}`}>
          {optional ? "—" : label}
        </div>
      ) : (
        <button
          type="button"
          className={
            "doc-step-recipe__drop"
            + (dragOver ? " doc-step-recipe__drop--active" : "")
            + (uploading ? " doc-step-recipe__drop--busy" : "")
          }
          disabled={uploading}
          onClick={onPick}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            onFiles?.(event.dataTransfer?.files);
          }}
        >
          {uploading ? t("doc.imageBlock.uploading") : (optional ? `${label} (optional)` : label)}
        </button>
      )}
    </div>
  );
}

/**
 * Visual recipe card for one step: ref + up to 2 variants + meta + prompt.
 */
export function StepRecipeCard({
  step,
  onChange,
  readOnly = false,
  compact = false,
}) {
  const { t } = useI18n();
  const refInputRef = useRef(null);
  const variant0Ref = useRef(null);
  const variant1Ref = useRef(null);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const interactive = Boolean(onChange) && !readOnly;
  const prompt = step?.prompt || "";
  const meta = step?.meta || "";
  const promptSaved = Boolean(step?.promptSaved && prompt.trim());
  const variants = Array.isArray(step?.variantImages) ? step.variantImages : [];

  const patchStep = useCallback((patch) => {
    onChange?.({
      ...step,
      ...patch,
    });
  }, [onChange, step]);

  const uploadTo = useCallback(async (files, apply) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }
    setError(null);
    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "STEPRECIPE",
        scopeId: step?.id,
      });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }
      apply({
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
      });
    } catch (err) {
      setError(err?.message || t("doc.imageBlock.convertFailed"));
    }
  }, [step?.id, t]);

  const handleRefFiles = async (files) => {
    setBusyKey("ref");
    try {
      await uploadTo(files, (image) => patchStep({ refImage: image }));
    } finally {
      setBusyKey(null);
    }
  };

  const handleVariantFiles = async (index, files) => {
    setBusyKey(`v${index}`);
    try {
      await uploadTo(files, (image) => {
        const next = [...variants];
        next[index] = image;
        patchStep({ variantImages: next.filter(Boolean).slice(0, 2) });
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(prompt.trim());
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const showCopy = readOnly || promptSaved;
  const showPromptSave = interactive && prompt.trim() && !promptSaved;

  return (
    <div className={`doc-step-recipe${compact ? " doc-step-recipe--compact" : ""}${readOnly ? " doc-step-recipe--saved" : ""}`}>
      <div className="doc-step-recipe__images">
        <RecipeImageSlot
          label="Original"
          image={step?.refImage}
          readOnly={!interactive}
          uploading={busyKey === "ref"}
          inputRef={refInputRef}
          onPick={() => refInputRef.current?.click()}
          onClear={() => patchStep({ refImage: null })}
          onFiles={handleRefFiles}
        />
        <div className="doc-step-recipe__variants">
          <RecipeImageSlot
            label="Variation 1"
            image={variants[0] || null}
            readOnly={!interactive}
            uploading={busyKey === "v0"}
            inputRef={variant0Ref}
            onPick={() => variant0Ref.current?.click()}
            onClear={() => patchStep({ variantImages: variants.slice(1) })}
            onFiles={(files) => handleVariantFiles(0, files)}
          />
          <RecipeImageSlot
            label="Variation 2"
            image={variants[1] || null}
            optional
            readOnly={!interactive}
            uploading={busyKey === "v1"}
            inputRef={variant1Ref}
            onPick={() => variant1Ref.current?.click()}
            onClear={() => patchStep({ variantImages: variants.slice(0, 1) })}
            onFiles={(files) => handleVariantFiles(1, files)}
          />
        </div>
      </div>

      <label className="doc-step-recipe__field">
        <span className="doc-step-recipe__field-label">Meta</span>
        {interactive ? (
          <textarea
            className="doc-step-recipe__textarea doc-step-recipe__textarea--meta"
            value={meta}
            rows={2}
            placeholder="Short explanation of this step"
            spellCheck
            onChange={(event) => patchStep({ meta: event.target.value })}
          />
        ) : (
          <p className="doc-step-recipe__meta-text">{meta.trim() || "—"}</p>
        )}
      </label>

      <div className="doc-step-recipe__field">
        <div className="doc-step-recipe__prompt-head">
          <span className="doc-step-recipe__field-label">Prompt</span>
          {showCopy && prompt.trim() ? (
            <button type="button" className="doc-step-recipe__copy" onClick={() => { void handleCopy(); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
          {showPromptSave ? (
            <button
              type="button"
              className="doc-step-recipe__copy"
              onClick={() => patchStep({ promptSaved: true })}
            >
              Save prompt
            </button>
          ) : null}
          {interactive && promptSaved ? (
            <button
              type="button"
              className="doc-step-recipe__copy"
              onClick={() => patchStep({ promptSaved: false })}
            >
              Edit prompt
            </button>
          ) : null}
        </div>
        {interactive && !promptSaved ? (
          <textarea
            className="doc-step-recipe__textarea doc-step-recipe__textarea--prompt"
            value={prompt}
            rows={5}
            placeholder="Paste the prompt to copy later"
            spellCheck
            onChange={(event) => patchStep({ prompt: event.target.value, promptSaved: false })}
          />
        ) : (
          <pre className="doc-step-recipe__prompt-text">{prompt.trim() || "—"}</pre>
        )}
      </div>
      {error ? <p className="doc-step-recipe__error" role="alert">{error}</p> : null}
    </div>
  );
}
