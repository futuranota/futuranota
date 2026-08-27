import { useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../lib/docImageStorage.js";
import {
  LINK_DESCRIPTION_MAX_LENGTH,
  LINK_REQUIREMENTS_MAX_LENGTH,
} from "../../lib/vaultBlocks.js";
import {
  AFFILIATE_STATUSES,
  applyAffiliateStatusChange,
  formatAffiliateRowMeta,
} from "../../lib/urlTableAffiliate.js";
import { useI18n } from "../../i18n/useI18n.js";

const EMPTY_DRAFT = {
  name: "",
  tag: "",
  category: "",
  description: "",
  url: "",
  imageUrl: "",
  requirements: "",
  affiliateStatus: "pending",
};

/**
 * [+ new] tile — same footprint as queue cards.
 */
export function AffiliateNewTile({ onClick, label }) {
  return (
    <button
      type="button"
      className="affiliate-new-tile"
      onClick={onClick}
      aria-label={label}
    >
      <span className="affiliate-new-tile__plus" aria-hidden>+</span>
      <span className="affiliate-new-tile__label">{label}</span>
    </button>
  );
}

/**
 * Queue card — photo arriba, info abajo (112px, mismo ancho que + new).
 */
export function AffiliateQueueCard({
  entry,
  onViewStats,
  onStartEdit,
  onDelete,
  labels = {},
}) {
  const { t } = useI18n();
  const meta = formatAffiliateRowMeta(entry);
  const status = meta.affiliateStatus || "pending";
  const statusLabel = labels[`status${status[0]?.toUpperCase()}${status.slice(1)}`]
    || t(`urlTableAffiliate.status.${status}`);
  const imageSrc = String(entry?.imageUrl ?? "").trim();
  const name = String(entry?.name ?? "").trim() || t("urlTableAffiliate.untitled");

  return (
    <div className="affiliate-queue-card">
      <div className="affiliate-queue-card__media">
        {imageSrc ? (
          <img src={imageSrc} alt="" draggable={false} />
        ) : (
          <span className="affiliate-queue-card__placeholder" aria-hidden />
        )}
        <div className="affiliate-queue-card__actions">
          <button
            type="button"
            className="affiliate-queue-card__stats"
            onClick={() => onViewStats?.(entry)}
            aria-label={labels.stats || t("urlTableAffiliate.stats")}
            title={labels.stats || t("urlTableAffiliate.stats")}
          >
            <img
              className="affiliate-queue-card__stats-icon"
              src="/uploads/ChartPieSlice.svg"
              alt=""
              draggable={false}
            />
          </button>
          <button
            type="button"
            className="affiliate-queue-card__edit"
            onClick={() => onStartEdit?.(entry)}
            title={labels.edit || t("urlTableAffiliate.edit")}
          >
            {labels.edit || t("urlTableAffiliate.edit")}
          </button>
        </div>
      </div>
      <div className="affiliate-queue-card__info">
        <span className="affiliate-queue-card__name">{name}</span>
        <span className={`affiliate-queue-card__badge affiliate-queue-card__badge--${status}`}>
          {statusLabel}
        </span>
      </div>
      {onDelete ? (
        <button
          type="button"
          className="affiliate-queue-card__delete"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(entry.id);
          }}
          aria-label={labels.delete || t("urlTableAffiliate.deleteRow")}
          title={labels.delete || t("urlTableAffiliate.deleteRow")}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

/**
 * Page-1 editor (create / edit). Next always enabled.
 */
export function AffiliateEntryCard({
  draft,
  onDraftChange,
  onNext = null,
  onClose = null,
  immersive = false,
  objectId = null,
  tableId = null,
  labels = {},
}) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const imageSrc = String(draft.imageUrl ?? "").trim();
  const statusValue = String(draft.affiliateStatus || "pending");

  const patch = (field, value) => {
    onDraftChange?.((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatusChange = (nextStatus) => {
    const applied = applyAffiliateStatusChange(draft, nextStatus);
    onDraftChange?.((prev) => ({ ...prev, ...applied }));
  };

  const handleFiles = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const uploaded = await convertAndUploadDocImage(file, {
        scopeId: tableId || objectId || "affiliates",
        idPrefix: "aff",
      });
      if (!uploaded?.src) throw new Error("empty url");
      patch("imageUrl", uploaded.src);
    } catch (err) {
      console.warn("[affiliates] image upload failed", err);
      setUploadError(t("urlTableLibrary.imageUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <article className={"affiliate-entry-card" + (immersive ? " affiliate-entry-card--immersive" : "")}>
      {onClose ? (
        <button
          type="button"
          className="affiliate-entry-card__close"
          onClick={onClose}
          aria-label={labels.close || t("urlTableLibrary.closeTab")}
          title={labels.close || t("urlTableLibrary.closeTab")}
        >
          ×
        </button>
      ) : null}
      <input
        className="affiliate-entry-card__name"
        type="text"
        value={draft.name}
        placeholder={labels.namePlaceholder || labels.name || t("urlTableAffiliate.businessNamePlaceholder")}
        onChange={(e) => patch("name", e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />

      <div className="affiliate-entry-card__hero">
        <div className="affiliate-entry-card__media">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="affiliate-entry-card__file"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {imageSrc ? (
            <div className="affiliate-entry-card__preview">
              <img
                className="affiliate-entry-card__img"
                src={imageSrc}
                alt=""
                draggable={false}
              />
              <button
                type="button"
                className="affiliate-entry-card__image-clear"
                onClick={() => patch("imageUrl", "")}
                aria-label={t("urlTableLibrary.removeImage")}
                title={t("urlTableLibrary.removeImage")}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="affiliate-entry-card__drop"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <span className="affiliate-entry-card__plus" aria-hidden>+</span>
              <span>
                {uploading
                  ? t("urlTableLibrary.uploadingImage")
                  : t("urlTableLibrary.addImage")}
              </span>
            </button>
          )}
          {uploadError ? (
            <p className="affiliate-entry-card__upload-error">{uploadError}</p>
          ) : null}
        </div>

        <textarea
          className="affiliate-entry-card__description"
          rows={8}
          value={draft.description}
          placeholder={labels.description || t("urlTableAffiliate.description")}
          maxLength={LINK_DESCRIPTION_MAX_LENGTH}
          onChange={(e) => patch("description", e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      <div className="affiliate-entry-card__fields">
        <label>
          <span>{labels.tag || t("urlTableAffiliate.tag")}</span>
          <input
            type="text"
            value={draft.tag}
            placeholder={labels.tag || t("urlTableAffiliate.tag")}
            onChange={(e) => patch("tag", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
        <label>
          <span>{labels.category || t("urlTableAffiliate.category")}</span>
          <input
            type="text"
            value={draft.category}
            placeholder={labels.category || t("urlTableAffiliate.category")}
            onChange={(e) => patch("category", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
        <label className="affiliate-entry-card__url-field">
          <span>{labels.url || t("urlTableAffiliate.url")}</span>
          <input
            type="url"
            value={draft.url}
            placeholder={labels.urlOptional || t("urlTableAffiliate.urlOptional")}
            onChange={(e) => patch("url", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
        <label className="affiliate-entry-card__requirements-field">
          <span>{labels.requirements || t("urlTableAffiliate.requirements")}</span>
          <textarea
            rows={3}
            value={draft.requirements}
            placeholder={labels.requirementsPlaceholder || t("urlTableAffiliate.requirementsPlaceholder")}
            maxLength={LINK_REQUIREMENTS_MAX_LENGTH}
            onChange={(e) => patch("requirements", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
        <label>
          <span>{labels.status || t("urlTableAffiliate.statusLabel")}</span>
          <select
            value={statusValue}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {AFFILIATE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`urlTableAffiliate.status.${status}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="affiliate-entry-card__footer">
        <div className="affiliate-entry-card__actions">
          <button
            type="button"
            className="affiliate-entry-card__next"
            onClick={() => onNext?.()}
            title={labels.next || t("urlTableAffiliate.next")}
          >
            {labels.next || t("urlTableAffiliate.next")}
          </button>
        </div>
      </div>
    </article>
  );
}

export { EMPTY_DRAFT as AFFILIATE_EMPTY_DRAFT };
