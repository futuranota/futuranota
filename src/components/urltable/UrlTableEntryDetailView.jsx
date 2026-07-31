import { useEffect, useMemo, useState } from "react";
import {
  AFFILIATE_CATEGORY,
  AFFILIATE_STATUSES,
  applyAffiliateStatusChange,
  computeAffiliateEarnings,
  computeAffiliatePerSale,
  createAffiliateFields,
  formatAffiliateMoney,
  resolveAffiliateLifecycle,
} from "../../lib/urlTableAffiliate.js";
import { createLinkEntry, normalizeUrlInput } from "../../lib/vaultBlocks.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Per-row affiliate / stats page inside the URL table overlay.
 *
 * @param {Object} props
 * @param {import("../../lib/vaultBlocks.js").LinkEntry} props.entry
 * @param {(next: import("../../lib/vaultBlocks.js").LinkEntry) => void | Promise<void>} props.onSave
 * @param {() => void} props.onBack
 */
export function UrlTableEntryDetailView({ entry, onSave, onBack }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => seedDraft(entry));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setDraft(seedDraft(entry));
    setSaveError("");
  }, [entry?.id]);

  const lifecycle = useMemo(
    () => resolveAffiliateLifecycle(draft),
    [draft.affiliateStatus, draft.activatedAt, draft.cookieDays],
  );

  const perSale = computeAffiliatePerSale(draft);
  const earnings = computeAffiliateEarnings(draft);

  const patchNumber = (field, raw) => {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) {
      setDraft((prev) => ({
        ...prev,
        [field]: field === "clientsWon" ? 0 : null,
      }));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return;
    setDraft((prev) => ({
      ...prev,
      [field]: field === "clientsWon" || field === "cookieDays" ? Math.floor(n) : n,
    }));
  };

  const handleStatusChange = (nextStatus) => {
    const applied = applyAffiliateStatusChange(draft, nextStatus);
    setDraft((prev) => {
      const category = String(prev.category ?? "").trim() || AFFILIATE_CATEGORY;
      return {
        ...prev,
        ...applied,
        category,
      };
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const affiliate = createAffiliateFields(draft);
      const status = affiliate.affiliateStatus || "pending";
      const withStatus = applyAffiliateStatusChange(
        { ...draft, ...affiliate, affiliateStatus: status },
        status,
      );
      const resolved = resolveAffiliateLifecycle({
        ...draft,
        ...affiliate,
        ...withStatus,
      });
      const next = createLinkEntry({
        ...draft,
        ...affiliate,
        ...withStatus,
        affiliateStatus: resolved.affiliateStatus || status,
        activatedAt: resolved.activatedAt,
        url: normalizeUrlInput(draft.url),
        category: String(draft.category ?? "").trim() || AFFILIATE_CATEGORY,
      });
      await Promise.resolve(onSave?.(next));
    } catch (err) {
      console.warn("[url-table] affiliate detail save failed", err);
      setSaveError(t("urlTableAffiliate.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="url-table-entry-detail">
      <div className="url-table-entry-detail__toolbar">
        <button
          type="button"
          className="url-table-entry-detail__back"
          onClick={onBack}
          disabled={saving}
        >
          ← {t("urlTableAffiliate.back")}
        </button>
        <h2 className="url-table-entry-detail__title">
          {draft.name.trim() || t("urlTableAffiliate.untitled")}
        </h2>
      </div>

      <div className="url-table-entry-detail__stats">
        <div className="url-table-entry-detail__stat">
          <span className="url-table-entry-detail__stat-label">
            {t("urlTableAffiliate.perSale")}
          </span>
          <strong className="url-table-entry-detail__stat-value">
            {formatAffiliateMoney(perSale)}
          </strong>
        </div>
        <div className="url-table-entry-detail__stat">
          <span className="url-table-entry-detail__stat-label">
            {t("urlTableAffiliate.earnings")}
          </span>
          <strong className="url-table-entry-detail__stat-value">
            {formatAffiliateMoney(earnings)}
          </strong>
        </div>
        <div className="url-table-entry-detail__stat">
          <span className="url-table-entry-detail__stat-label">
            {t("urlTableAffiliate.cookieLeft")}
          </span>
          <strong className="url-table-entry-detail__stat-value">
            {lifecycle.affiliateStatus === "pending"
              ? (draft.cookieDays != null
                ? t("urlTableAffiliate.cookiePending", { days: draft.cookieDays })
                : "—")
              : lifecycle.daysRemaining != null
                ? t("urlTableAffiliate.daysLeft", { days: lifecycle.daysRemaining })
                : "—"}
          </strong>
        </div>
      </div>

      <div className="url-table-entry-detail__grid">
        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.businessName")}</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.tag")}</span>
          <input
            type="text"
            value={draft.tag ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, tag: e.target.value }))}
          />
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.category")}</span>
          <input
            type="text"
            value={draft.category || AFFILIATE_CATEGORY}
            onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
          />
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.commissionRate")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.commissionRate ?? ""}
            placeholder="10"
            onChange={(e) => patchNumber("commissionRate", e.target.value)}
          />
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.productPrice")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.productPrice ?? ""}
            placeholder="99"
            onChange={(e) => patchNumber("productPrice", e.target.value)}
          />
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.cookieDays")}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.cookieDays ?? ""}
            placeholder="30"
            onChange={(e) => patchNumber("cookieDays", e.target.value)}
          />
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.statusLabel")}</span>
          <select
            value={lifecycle.affiliateStatus || "pending"}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {AFFILIATE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`urlTableAffiliate.status.${status}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="url-table-entry-detail__field">
          <span>{t("urlTableAffiliate.clientsWon")}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.clientsWon ?? 0}
            onChange={(e) => patchNumber("clientsWon", e.target.value)}
          />
        </label>
      </div>

      {draft.url ? (
        <a
          className="url-table-entry-detail__url"
          href={normalizeUrlInput(draft.url) || draft.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {draft.url}
        </a>
      ) : null}

      {draft.description ? (
        <p className="url-table-entry-detail__description">{draft.description}</p>
      ) : null}

      {saveError ? (
        <p className="url-table-entry-detail__error">{saveError}</p>
      ) : null}

      <div className="url-table-entry-detail__actions">
        <button
          type="button"
          className="doc-new-action doc-new-action--save"
          onClick={handleSave}
          disabled={saving || !draft.name.trim() || !draft.url.trim()}
        >
          {saving ? t("urlTableAffiliate.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

/** @param {import("../../lib/vaultBlocks.js").LinkEntry} entry */
function seedDraft(entry) {
  const base = createLinkEntry(entry);
  if (!base.affiliateStatus) {
    return { ...base, affiliateStatus: "pending" };
  }
  return base;
}
