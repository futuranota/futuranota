import { useCallback, useEffect, useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../../lib/docImageStorage.js";
import { copyToClipboard } from "../../../lib/copyToClipboard.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { MarkdownPreview } from "./MarkdownPreview.jsx";

const ICON_CLOSE = "/uploads/closed-tab.svg";

function RecipeIco({ src, className = "" }) {
  return <img className={`doc-step-recipe__ico ${className}`.trim()} src={src} alt="" aria-hidden draggable={false} />;
}

function RecipeImageSlot({
  image,
  caption,
  onCaptionChange,
  readOnly = false,
  uploading = false,
  onPick,
  onClear,
  inputRef,
  onFiles,
  fill = false,
}) {
  const { t } = useI18n();
  const src = image?.src;
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={`doc-step-recipe__slot${fill ? " doc-step-recipe__slot--fill" : ""}`}>
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
            alt={caption || image.alt || image.name || t("doc.stepRecipe.upload")}
            width={image.width || undefined}
            height={image.height || undefined}
            draggable={false}
          />
          {readOnly ? (
            caption ? (
              <div className="doc-step-recipe__film">
                <span className="doc-step-recipe__caption-read">{caption}</span>
              </div>
            ) : null
          ) : (
            <>
              <button
                type="button"
                className="doc-step-recipe__close"
                onClick={onClear}
                disabled={uploading}
                title={t("doc.imageBlock.remove")}
                aria-label={t("doc.imageBlock.remove")}
              >
                <RecipeIco src={ICON_CLOSE} />
              </button>
              <div className="doc-step-recipe__film">
                <input
                  type="text"
                  className="doc-step-recipe__caption"
                  value={caption}
                  placeholder={t("doc.stepRecipe.captionPlaceholder")}
                  onChange={(event) => onCaptionChange?.(event.target.value)}
                />
              </div>
            </>
          )}
        </div>
      ) : readOnly ? null : (
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
          <span className="doc-step-recipe__plus" aria-hidden>+</span>
          <span className="doc-step-recipe__drop-label">
            {uploading ? t("doc.imageBlock.uploading") : t("doc.stepRecipe.upload")}
          </span>
        </button>
      )}
    </div>
  );
}

export function StepRecipeCard({
  step,
  onChange,
  readOnly = false,
  compact = false,
  allowSecondImage = false,
}) {
  const { t } = useI18n();
  const firstInputRef = useRef(null);
  const secondInputRef = useRef(null);
  const metaRef = useRef(null);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [addingSecond, setAddingSecond] = useState(false);

  const interactive = Boolean(onChange) && !readOnly;
  const prompt = step?.prompt || "";
  const meta = step?.meta || "";
  const promptMd = Boolean(step?.promptMd);
  const promptSaved = Boolean(step?.promptSaved && prompt.trim());
  const images = Array.isArray(step?.images) ? step.images : [];
  const showPlus = interactive && allowSecondImage && images.length === 1 && !addingSecond;

  useEffect(() => {
    const el = metaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
  }, [meta, interactive]);

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
        caption: "",
      });
    } catch (err) {
      setError(err?.message || t("doc.imageBlock.convertFailed"));
    }
  }, [step?.id, t]);

  const handleImageFiles = async (index, files) => {
    setBusyKey(String(index));
    try {
      await uploadTo(files, (image) => {
        const next = [...images];
        const prevCaption = next[index]?.caption || "";
        next[index] = { ...image, caption: prevCaption };
        patchStep({ images: next.filter((item) => item?.src).slice(0, 2) });
        setAddingSecond(false);
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(prompt.trim());
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const showCopy = Boolean(prompt.trim());
  const renderMarkdown = promptMd && (readOnly || promptSaved) && prompt.trim();

  return (
    <div className={`doc-step-recipe${compact ? " doc-step-recipe--compact" : ""}${readOnly ? " doc-step-recipe--saved" : ""}`}>
      <div className="doc-step-recipe__col doc-step-recipe__col--media">
        {(images[0] || interactive) ? (
          <RecipeImageSlot
            image={images[0] || null}
            caption={images[0]?.caption || ""}
            onCaptionChange={(caption) => {
              if (!images[0]) return;
              const next = [...images];
              next[0] = { ...next[0], caption };
              patchStep({ images: next });
            }}
            readOnly={!interactive}
            uploading={busyKey === "0"}
            inputRef={firstInputRef}
            onPick={() => firstInputRef.current?.click()}
            onClear={() => {
              setAddingSecond(false);
              patchStep({ images: images.slice(1) });
            }}
            onFiles={(files) => handleImageFiles(0, files)}
            fill={!images[1] && !addingSecond}
          />
        ) : null}
        {images[1] || (interactive && addingSecond) ? (
          <RecipeImageSlot
            image={images[1] || null}
            caption={images[1]?.caption || ""}
            onCaptionChange={(caption) => {
              if (!images[1]) return;
              const next = [...images];
              next[1] = { ...next[1], caption };
              patchStep({ images: next });
            }}
            readOnly={!interactive}
            uploading={busyKey === "1"}
            inputRef={secondInputRef}
            onPick={() => secondInputRef.current?.click()}
            onClear={() => {
              setAddingSecond(false);
              patchStep({ images: images.slice(0, 1) });
            }}
            onFiles={(files) => handleImageFiles(1, files)}
          />
        ) : null}
        {showPlus ? (
          <button
            type="button"
            className="doc-step-recipe__add"
            aria-label={t("doc.stepRecipe.addImage")}
            onClick={() => setAddingSecond(true)}
          >
            {t("doc.stepRecipe.addImage")}
          </button>
        ) : null}
      </div>

      <div className="doc-step-recipe__col doc-step-recipe__col--copy">
        <label className="doc-step-recipe__field doc-step-recipe__field--meta">
          <span className="doc-step-recipe__field-label">{t("doc.stepRecipe.metaLabel")}</span>
          {interactive ? (
            <textarea
              ref={metaRef}
              className="doc-step-recipe__textarea doc-step-recipe__textarea--meta"
              value={meta}
              rows={2}
              placeholder={t("doc.stepRecipe.metaPlaceholder")}
              spellCheck
              onChange={(event) => patchStep({ meta: event.target.value })}
            />
          ) : (
            <div className="doc-step-recipe__meta-box">
              <p className="doc-step-recipe__meta-text">{meta.trim() || "—"}</p>
            </div>
          )}
        </label>

        <div className="doc-step-recipe__field doc-step-recipe__field--prompt">
          <span className="doc-step-recipe__field-label">{t("doc.stepRecipe.promptLabel")}</span>
          <div className="doc-step-recipe__prompt-box">
            {interactive ? (
              <textarea
                className="doc-step-recipe__textarea doc-step-recipe__textarea--prompt"
                value={prompt}
                rows={6}
                placeholder={t("doc.stepRecipe.promptPlaceholder")}
                spellCheck
                onChange={(event) => patchStep({ prompt: event.target.value, promptSaved: false })}
              />
            ) : renderMarkdown ? (
              <div className="doc-step-recipe__md">
                <MarkdownPreview source={prompt} />
              </div>
            ) : (
              <pre className="doc-step-recipe__prompt-text">{prompt.trim() || "—"}</pre>
            )}
            {showCopy ? (
              <button
                type="button"
                className="library-asset-field-readonly__copy"
                onClick={() => { void handleCopy(); }}
                title={copied ? t("doc.stepRecipe.copied") : t("doc.stepRecipe.copy")}
                aria-label={copied ? t("doc.stepRecipe.copied") : t("doc.stepRecipe.copy")}
              >
                {copied ? "✓" : "⧉"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {error ? <p className="doc-step-recipe__error" role="alert">{error}</p> : null}
    </div>
  );
}
