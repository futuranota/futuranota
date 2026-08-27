import { useEffect, useMemo, useState } from "react";
import {
  AFFILIATE_CATEGORY,
  applyAffiliateStatusChange,
  computeAffiliateEarnings,
  computeAffiliatePerSale,
  createAffiliateFields,
  formatAffiliateMoney,
  resolveAffiliateLifecycle,
} from "../../lib/urlTableAffiliate.js";
import { createLinkEntry, normalizeUrlInput } from "../../lib/vaultBlocks.js";
import { useI18n } from "../../i18n/useI18n.js";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";

/**
 * Per-row affiliate / stats page inside the URL table overlay.
 *
 * @param {Object} props
 * @param {import("../../lib/vaultBlocks.js").LinkEntry} props.entry
 * @param {'stats'|'calculator'} [props.mode]
 * @param {(next: import("../../lib/vaultBlocks.js").LinkEntry) => void | Promise<void>} props.onSave
 * @param {() => void} props.onBack
 * @param {(() => void)|null} [props.onClose]
 * @param {boolean} [props.immersive]
 * @param {React.MutableRefObject<(() => import("../../lib/vaultBlocks.js").LinkEntry|null)|null>} [props.entrySnapshotRef]
 */
export function UrlTableEntryDetailView({
  entry,
  mode = "calculator",
  onSave,
  onBack,
  onClose = null,
  immersive = false,
  entrySnapshotRef = null,
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => seedDraft(entry));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const isStatsOnly = mode === "stats";

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
  const cookieNumeral = lifecycle.affiliateStatus === "pending"
    ? (draft.cookieDays ?? null)
    : lifecycle.daysRemaining;

  const buildPersistedEntry = () => {
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
    return createLinkEntry({
      ...draft,
      ...affiliate,
      ...withStatus,
      affiliateStatus: resolved.affiliateStatus || status,
      activatedAt: resolved.activatedAt,
      url: normalizeUrlInput(draft.url),
      category: String(draft.category ?? "").trim() || AFFILIATE_CATEGORY,
    });
  };

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

  const handleSave = async () => {
    if (saving || isStatsOnly) return;
    setSaving(true);
    setSaveError("");
    try {
      const next = buildPersistedEntry();
      await Promise.resolve(onSave?.(next));
    } catch (err) {
      console.warn("[url-table] affiliate detail save failed", err);
      setSaveError(t("urlTableAffiliate.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!entrySnapshotRef) return undefined;
    entrySnapshotRef.current = () => buildPersistedEntry();
    return () => {
      entrySnapshotRef.current = null;
    };
  });

  return (
    <div
      className={
        "url-table-entry-detail"
        + (isStatsOnly ? " url-table-entry-detail--stats" : "")
        + (immersive ? " url-table-entry-detail--immersive" : "")
      }
    >
      <div className="url-table-entry-detail__toolbar">
        <button
          type="button"
          className="url-table-entry-detail__back"
          onClick={onBack}
          disabled={saving}
          aria-label={t("urlTableAffiliate.back")}
          title={t("urlTableAffiliate.back")}
        >
          <span className="url-table-entry-detail__back-icon" aria-hidden />
        </button>
        {onClose ? (
          <button
            type="button"
            className="url-table-entry-detail__close"
            onClick={onClose}
            disabled={saving}
            aria-label={t("urlTableLibrary.closeTab")}
            title={t("urlTableLibrary.closeTab")}
          >
            ×
          </button>
        ) : null}
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
          <div className="url-table-entry-detail__stat-cookie">
            <strong className="url-table-entry-detail__stat-value">
              {cookieNumeral != null ? cookieNumeral : "—"}
            </strong>
            {lifecycle.affiliateStatus === "active" && cookieNumeral != null ? (
              <span className="url-table-entry-detail__stat-unit">
                {t("urlTableAffiliate.daysLeftUnit")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {isStatsOnly ? null : (
        <>
          <div className="url-table-entry-detail__grid">
            <label className="url-table-entry-detail__field">
              <span>{t("urlTableAffiliate.commissionRate")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.commissionRate ?? ""}
                placeholder=""
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
                placeholder=""
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
                placeholder=""
                onChange={(e) => patchNumber("cookieDays", e.target.value)}
              />
            </label>

            <label className="url-table-entry-detail__field">
              <span>{t("urlTableAffiliate.clientsWon")}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.clientsWon ?? 0}
                placeholder=""
                onChange={(e) => patchNumber("clientsWon", e.target.value)}
              />
            </label>
          </div>

          {saveError ? (
            <p className="url-table-entry-detail__error">{saveError}</p>
          ) : null}

          <div className="url-table-entry-detail__actions">
            <button
              type="button"
              className={
                "doc-new-action doc-new-action--save url-table-dashboard__save"
                + (saving ? " doc-new-action--save-loading" : "")
              }
              onClick={() => void handleSave()}
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? <SearchSpinner size={14} /> : null}
              {saving ? t("urlTableAffiliate.saving") : t("common.save")}
            </button>
          </div>
        </>
      )}
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
