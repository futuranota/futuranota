import { useEffect, useRef, useState } from "react";
import { convertAndUploadDocImage } from "../../lib/docImageStorage.js";
import {
  createLinkEntry,
  LINK_DESCRIPTION_MAX_LENGTH,
  LINK_REQUIREMENTS_MAX_LENGTH,
  normalizeUrlInput,
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
 * @param {Partial<import("../../lib/vaultBlocks.js").LinkEntry>} entry
 */
function toDraft(entry) {
  return {
    name: entry?.name || "",
    tag: entry?.tag || "",
    category: entry?.category || "",
    description: entry?.description || "",
    url: entry?.url || "",
    imageUrl: entry?.imageUrl || "",
    requirements: entry?.requirements || "",
    affiliateStatus: entry?.affiliateStatus || "pending",
    activatedAt: entry?.activatedAt || null,
  };
}

/**
 * Compact queue thumb for a saved affiliate.
 */
export function AffiliateQueueThumb({
  entry,
  selected = false,
  onSelect,
  onView,
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
    <div
      className={
        "affiliate-queue-thumb"
        + (selected ? " is-selected" : "")
      }
    >
      <button
        type="button"
        className="affiliate-queue-thumb__main"
        onClick={() => onSelect?.(entry)}
        title={name}
      >
        <span className="affiliate-queue-thumb__media">
          {imageSrc ? (
            <img src={imageSrc} alt="" draggable={false} />
          ) : (
            <span className="affiliate-queue-thumb__placeholder" aria-hidden />
          )}
        </span>
        <span className="affiliate-queue-thumb__name">{name}</span>
        <span className={`affiliate-queue-thumb__badge affiliate-queue-thumb__badge--${status}`}>
          {statusLabel}
        </span>
      </button>
      {onView ? (
        <button
          type="button"
          className="affiliate-queue-thumb__view"
          onClick={(event) => {
            event.stopPropagation();
            onView(entry);
          }}
          title={labels.view || t("urlTableAffiliate.view")}
          aria-label={labels.view || t("urlTableAffiliate.view")}
        >
          <img
            src="/uploads/ChartPieSlice.svg"
            alt=""
            aria-hidden
            className="affiliate-entry-card__view-icon"
          />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Expanded affiliate editor card.
 */
export function AffiliateEntryCard({
  entry = null,
  isDraft = false,
  draft: controlledDraft = null,
  onDraftChange = null,
  onSave,
  onDelete = null,
  onView = null,
  objectId = null,
  tableId = null,
  labels = {},
}) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [localDraft, setLocalDraft] = useState(() => toDraft(entry));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const isControlled = isDraft && controlledDraft != null && typeof onDraftChange === "function";
  const draft = isControlled ? controlledDraft : localDraft;
  const setDraft = isControlled ? onDraftChange : setLocalDraft;

  useEffect(() => {
    if (isDraft || isControlled) return;
    setLocalDraft(toDraft(entry));
  }, [entry?.id, entry?.updatedAt, isDraft, isControlled]);

  const canSave = Boolean(String(draft.name ?? "").trim());
  const imageSrc = String(draft.imageUrl ?? "").trim();
  const statusValue = String(draft.affiliateStatus || "pending");

  const patch = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatusChange = (nextStatus) => {
    const applied = applyAffiliateStatusChange(draft, nextStatus);
    setDraft((prev) => ({
      ...prev,
      ...applied,
    }));
  };

  const handleSave = () => {
    if (!canSave || typeof onSave !== "function") return;
    const base = isDraft ? draft : { ...(entry || {}), ...draft };
    const withStatus = applyAffiliateStatusChange(
      { ...base, affiliateStatus: draft.affiliateStatus || "pending" },
      draft.affiliateStatus || "pending",
    );
    const rawUrl = String(draft.url ?? "").trim();
    const next = createLinkEntry({
      ...base,
      ...withStatus,
      id: isDraft ? undefined : entry?.id,
      url: rawUrl ? normalizeUrlInput(rawUrl) : "",
      imageUrl: String(draft.imageUrl ?? "").trim(),
      requirements: String(draft.requirements ?? "").trim(),
      affiliateStatus: withStatus.affiliateStatus || "pending",
    });
    const result = onSave?.(next);
    if (result === false || result === null) return;
    if (isDraft && isControlled) {
      onDraftChange?.(EMPTY_DRAFT);
    }
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
    <article className="affiliate-entry-card">
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
          rows={5}
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
        <span className="affiliate-entry-card__hint">
          {t("urlTableAffiliate.pendingSaveHint")}
        </span>
        <div className="affiliate-entry-card__actions">
          {!isDraft && onView && entry?.id ? (
            <button
              type="button"
              className="affiliate-entry-card__view"
              onClick={() => onView(entry)}
              title={labels.view || t("urlTableAffiliate.view")}
            >
              <img
                src="/uploads/ChartPieSlice.svg"
                alt=""
                aria-hidden
                className="affiliate-entry-card__view-icon"
              />
              <span>{labels.view || t("urlTableAffiliate.view")}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="doc-vault-block__save"
            disabled={!canSave}
            onClick={handleSave}
          >
            {labels.save || t("common.save")}
          </button>
          {!isDraft && onDelete && entry?.id ? (
            <button
              type="button"
              className="affiliate-entry-card__delete"
              onClick={() => onDelete(entry.id)}
              aria-label={labels.delete || t("urlTableAffiliate.deleteRow")}
              title={labels.delete || t("urlTableAffiliate.deleteRow")}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export { EMPTY_DRAFT as AFFILIATE_EMPTY_DRAFT };
