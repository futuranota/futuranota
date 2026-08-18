import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems, useLibrarySets } from "../../hooks/useLibraryItems.js";
import { copyToClipboard } from "../../lib/copyToClipboard.js";
import {
  createLibraryItem,
  createLibrarySet,
  normalizeLibraryOwnerKind,
} from "../../lib/folderLibrary.js";

/**
 * Name a captured `--prompt--` and save as a loose image ficha,
 * into an existing asset (double-click), or as a new asset (Insert new).
 */
export function LibraryPromptCaptureModal({
  prompt,
  ownerKind = "document",
  ownerId,
  onClose,
  onSaved,
}) {
  const { t } = useI18n();
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const id = String(ownerId || "").trim();
  const assets = useLibrarySets(kind, id);
  const items = useLibraryItems(kind, id);
  const [tag, setTag] = useState("");
  const [destination, setDestination] = useState("image");
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [insertingNew, setInsertingNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const promptText = String(prompt || "").trim();
  const showName = destination === "image" || insertingNew;
  const showSave = destination === "image" || insertingNew;

  const rankedAssets = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => {
      if (!item.setId) return;
      counts.set(item.setId, (counts.get(item.setId) || 0) + 1);
    });
    return [...assets]
      .map((asset) => ({ ...asset, count: counts.get(asset.id) || 0 }))
      .sort((a, b) => a.count - b.count || String(a.tag).localeCompare(String(b.tag)));
  }, [assets, items]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const finish = (saved) => {
    if (!saved) {
      setError(t("doc.library.nameRequired"));
      return;
    }
    onSaved?.(saved);
    onClose?.();
  };

  const handleCopy = async () => {
    if (!promptText) return;
    const ok = await copyToClipboard(promptText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const insertIntoAsset = (asset) => {
    if (!asset?.id) return;
    if (!id) {
      setError(t("doc.library.captureNoOwner"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = createLibraryItem(kind, id, {
        tag: asset.tag,
        description: promptText,
        category: "image",
        mediaUrl: null,
        setId: asset.id,
      });
      finish(saved);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const name = tag.trim();
    if (!name) {
      setError(t("doc.library.nameRequired"));
      return;
    }
    if (!id) {
      setError(t("doc.library.captureNoOwner"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (insertingNew && destination === "asset") {
        const created = createLibrarySet(kind, id, {
          tag: name,
          description: promptText,
        });
        finish(created ? { id: created.id, setId: created.id } : null);
        return;
      }
      const saved = createLibraryItem(kind, id, {
        tag: name,
        description: promptText,
        category: "image",
        mediaUrl: null,
        setId: null,
      });
      finish(saved);
    } finally {
      setSaving(false);
    }
  };

  const copyAria = copied ? t("doc.library.copied") : t("doc.library.copy");
  const saveDisabled = saving || (showSave && !tag.trim());

  return createPortal(
    <div
      className="folder-library-element-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("doc.library.captureTitle")}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.cancel")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal folder-library-element-modal--capture">
        <header className="folder-library-element-modal__head">
          <h2 className="folder-library-element-modal__title">
            {t("doc.library.captureTitle")}
          </h2>
          <button
            type="button"
            className="folder-library-element-modal__close"
            onClick={onClose}
            aria-label={t("doc.library.close")}
          >
            ×
          </button>
        </header>

        <div className="folder-library-element-modal__body folder-library-element-modal__body--capture">
          {showName ? (
            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">{t("doc.library.nameLabel")}</span>
              <input
                className="folder-library-element-modal__input"
                type="text"
                value={tag}
                placeholder={
                  insertingNew
                    ? t("doc.library.assetNamePlaceholder")
                    : t("doc.library.namePlaceholder")
                }
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                autoFocus
              />
            </label>
          ) : null}

          <div className="folder-library-element-modal__field">
            <span className="folder-library-element-modal__label">{t("doc.library.promptLabel")}</span>
            <div className="library-capture-prompt">
              <p className="folder-library-element-modal__prompt-preview">
                {promptText || t("doc.library.noReference")}
              </p>
              <button
                type="button"
                className="library-capture-prompt__copy"
                onClick={handleCopy}
                disabled={!promptText}
                aria-label={copyAria}
                title={copyAria}
              >
                {copied ? "✓" : "⧉"}
              </button>
            </div>
          </div>

          <div
            className="library-capture-dest"
            role="tablist"
            aria-label={t("doc.library.captureDestAria")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={destination === "image"}
              className={
                "library-capture-dest__btn"
                + (destination === "image" ? " is-active" : "")
              }
              onClick={() => {
                setDestination("image");
                setInsertingNew(false);
                setSelectedAssetId(null);
                setError("");
              }}
            >
              <img src="/uploads/img.svg" alt="" aria-hidden draggable={false} />
              <span>{t("doc.library.captureDestImage")}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={destination === "asset"}
              className={
                "library-capture-dest__btn"
                + (destination === "asset" ? " is-active" : "")
              }
              onClick={() => {
                setDestination("asset");
                setInsertingNew(false);
                setError("");
              }}
            >
              <img src="/uploads/assets.svg" alt="" aria-hidden draggable={false} />
              <span>{t("doc.library.captureDestAsset")}</span>
            </button>
          </div>

          {destination === "asset" ? (
            <>
              {rankedAssets.length === 0 ? (
                <p className="library-capture-assets__empty">
                  {t("doc.library.captureNoAssets")}
                </p>
              ) : (
                <ul className="library-capture-assets">
                  {rankedAssets.map((asset) => (
                    <li key={asset.id}>
                      <button
                        type="button"
                        className={
                          "library-capture-assets__row"
                          + (selectedAssetId === asset.id ? " is-selected" : "")
                          + (asset.count === 0 ? " is-empty" : "")
                        }
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          setInsertingNew(false);
                          setError("");
                        }}
                        onDoubleClick={() => insertIntoAsset(asset)}
                      >
                        <img
                          className="library-capture-assets__icon"
                          src="/uploads/Folders.svg"
                          alt=""
                          aria-hidden
                          draggable={false}
                        />
                        <span className="library-capture-assets__meta">
                          <span className="library-capture-assets__name">{asset.tag}</span>
                          <span className="library-capture-assets__count">
                            {asset.count === 0
                              ? t("doc.library.captureAssetEmpty")
                              : t("doc.library.assetCount").replace("{count}", String(asset.count))}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className={
                  "library-capture-insert"
                  + (insertingNew ? " is-active" : "")
                }
                onClick={() => {
                  setInsertingNew((open) => !open);
                  setSelectedAssetId(null);
                  setError("");
                }}
              >
                {t("doc.library.captureInsertNew")}
              </button>
            </>
          ) : null}
        </div>

        {error ? (
          <p className="folder-library-element-modal__error" role="alert">{error}</p>
        ) : null}

        <footer className="folder-library-element-modal__footer">
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--cancel"
            onClick={onClose}
            disabled={saving}
          >
            {t("doc.library.cancel")}
          </button>
          {showSave ? (
            <button
              type="button"
              className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
              onClick={handleSave}
              disabled={saveDisabled}
            >
              {t("doc.library.save")}
            </button>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
