import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useLibraryItems, useLibrarySets } from "../../hooks/useLibraryItems.js";
import { copyToClipboard } from "../../lib/copyToClipboard.js";
import { createLibraryItem, normalizeLibraryOwnerKind } from "../../lib/folderLibrary.js";

/**
 * Name a captured `--prompt--` and save it as an image ficha
 * (loose, or assigned to an existing document asset).
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const promptText = String(prompt || "").trim();

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

  const handleCopy = async () => {
    if (!promptText) return;
    const ok = await copyToClipboard(promptText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
    if (destination === "asset" && !selectedAssetId) {
      setError(t("doc.library.capturePickAsset"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = createLibraryItem(kind, id, {
        tag: name,
        description: promptText,
        category: "image",
        mediaUrl: null,
        setId: destination === "asset" ? selectedAssetId : null,
      });
      if (!saved) {
        setError(t("doc.library.nameRequired"));
        return;
      }
      onSaved?.(saved);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const copyAria = copied ? t("doc.library.copied") : t("doc.library.copy");
  const saveDisabled = saving || (destination === "asset" && !selectedAssetId);

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
          <label className="folder-library-element-modal__field">
            <span className="folder-library-element-modal__label">{t("doc.library.nameLabel")}</span>
            <input
              className="folder-library-element-modal__input"
              type="text"
              value={tag}
              placeholder={t("doc.library.namePlaceholder")}
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
                setError("");
              }}
            >
              <img src="/uploads/assets.svg" alt="" aria-hidden draggable={false} />
              <span>{t("doc.library.captureDestAsset")}</span>
            </button>
          </div>

          {destination === "asset" ? (
            rankedAssets.length === 0 ? (
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
                        setError("");
                      }}
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
            )
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
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
            onClick={handleSave}
            disabled={saveDisabled}
          >
            {t("doc.library.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
