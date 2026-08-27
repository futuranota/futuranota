import { useEffect, useMemo, useState } from "react";
import {
  AFFILIATE_CATEGORY,
  AFFILIATE_CURRENCY_PRESETS,
  applyAffiliateStatusChange,
  computeAffiliateEarnings,
  computeAffiliatePerSale,
  createAffiliateFields,
  formatAffiliateCookieExpiresLabel,
  formatAffiliateMoney,
  fromAffiliateDateInputValue,
  normalizeAffiliateCurrency,
  resolveAffiliateLifecycle,
  toAffiliateDateInputValue,
} from "../../lib/urlTableAffiliate.js";
import { createLinkEntry, normalizeUrlInput } from "../../lib/vaultBlocks.js";
import { useI18n } from "../../i18n/useI18n.js";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";
import { AffiliateInfoHover } from "./AffiliateInfoHover.jsx";

const CURRENCY_CUSTOM = "custom";

function openDatePicker(e) {
  e.stopPropagation();
  const input = e.currentTarget;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      /* ignore */
    }
  }
}

function hasCookieWindowData(draft) {
  return draft?.cookieDays != null || Boolean(draft?.activatedAt);
}

function todayDateInputValue() {
  return toAffiliateDateInputValue(new Date().toISOString());
}

/**
 * Per-row affiliate / stats page inside the URL table overlay.
 */
export function UrlTableEntryDetailView({
  entry,
  mode = "calculator",
  onSave,
  onPersist = null,
  onBack,
  onClose = null,
  immersive = false,
  entrySnapshotRef = null,
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => seedDraft(entry));
  const [saving, setSaving] = useState(false);
  const [cookieSaving, setCookieSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [cookieCommitted, setCookieCommitted] = useState(
    () => seedDraft(entry).cookieDays != null,
  );
  const isStatsOnly = mode === "stats";

  useEffect(() => {
    const next = seedDraft(entry);
    setDraft(next);
    setSaveError("");
    setCookieCommitted(next.cookieDays != null);
  }, [entry?.id]);

  const lifecycle = useMemo(
    () => resolveAffiliateLifecycle(draft),
    [draft.affiliateStatus, draft.activatedAt, draft.cookieDays],
  );

  const rawCurrency = String(draft.currency ?? "").trim().toUpperCase();
  const isPresetCurrency = AFFILIATE_CURRENCY_PRESETS.includes(rawCurrency);
  const currencySelectValue = !rawCurrency || isPresetCurrency
    ? (rawCurrency || "USD")
    : CURRENCY_CUSTOM;
  const displayCurrency = rawCurrency || "USD";
  const moneyOpts = { currency: displayCurrency };
  const perSale = computeAffiliatePerSale(draft);
  const earnings = computeAffiliateEarnings(draft);
  const cookieNumeral = lifecycle.affiliateStatus === "pending"
    ? (draft.cookieDays ?? null)
    : lifecycle.daysRemaining;
  const todayInput = todayDateInputValue();
  const cookieStartDate = toAffiliateDateInputValue(draft.activatedAt) || todayInput;
  const showCookieInfo = hasCookieWindowData(draft);
  const statusKey = lifecycle.affiliateStatus || draft.affiliateStatus || "pending";
  const imageSrc = String(draft.imageUrl ?? "").trim();
  const descriptionText = String(draft.description ?? "").trim();
  const requirementsText = String(draft.requirements ?? "").trim();
  const tagText = String(draft.tag ?? "").trim();
  const categoryText = String(draft.category ?? "").trim();
  const urlText = String(draft.url ?? "").trim();
  const expiresLabel = formatAffiliateCookieExpiresLabel(
    draft.activatedAt || fromAffiliateDateInputValue(todayInput),
    draft.cookieDays,
  );

  const ensureTodayActivatedAt = (prev) => {
    if (prev.activatedAt && toAffiliateDateInputValue(prev.activatedAt) === todayInput) {
      return prev.activatedAt;
    }
    return fromAffiliateDateInputValue(todayInput);
  };

  const buildPersistedEntry = () => {
    const activatedAt = draft.cookieDays != null || draft.activatedAt
      ? (draft.activatedAt && toAffiliateDateInputValue(draft.activatedAt) === todayInput
        ? draft.activatedAt
        : fromAffiliateDateInputValue(todayInput))
      : (draft.activatedAt || null);
    const affiliate = createAffiliateFields({ ...draft, activatedAt });
    const status = affiliate.affiliateStatus || "pending";
    const withStatus = applyAffiliateStatusChange(
      { ...draft, ...affiliate, affiliateStatus: status, activatedAt },
      status,
    );
    const resolved = resolveAffiliateLifecycle({
      ...draft,
      ...affiliate,
      ...withStatus,
      activatedAt: activatedAt || withStatus.activatedAt,
    });
    return createLinkEntry({
      ...draft,
      ...affiliate,
      ...withStatus,
      affiliateStatus: resolved.affiliateStatus || status,
      activatedAt: activatedAt || withStatus.activatedAt || resolved.activatedAt,
      currency: displayCurrency,
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
    setDraft((prev) => {
      const next = {
        ...prev,
        [field]: field === "clientsWon" || field === "cookieDays" ? Math.floor(n) : n,
      };
      if (field === "cookieDays") {
        next.activatedAt = ensureTodayActivatedAt(prev);
      }
      return next;
    });
  };

  const handleCurrencySelect = (raw) => {
    if (raw === CURRENCY_CUSTOM) {
      setDraft((prev) => {
        const current = String(prev.currency ?? "").trim().toUpperCase();
        if (AFFILIATE_CURRENCY_PRESETS.includes(current)) {
          return { ...prev, currency: "" };
        }
        return prev;
      });
      return;
    }
    setDraft((prev) => ({ ...prev, currency: raw }));
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

  const handleCookieCardSave = async () => {
    if (cookieSaving || saving || isStatsOnly) return;
    if (draft.cookieDays == null) return;
    setCookieSaving(true);
    setSaveError("");
    try {
      const activatedAt = ensureTodayActivatedAt(draft);
      const withCookie = { ...draft, activatedAt, cookieDays: draft.cookieDays };
      const affiliate = createAffiliateFields(withCookie);
      const status = affiliate.affiliateStatus || "pending";
      const withStatus = applyAffiliateStatusChange(
        { ...withCookie, ...affiliate, affiliateStatus: status, activatedAt },
        status,
      );
      const next = createLinkEntry({
        ...withCookie,
        ...affiliate,
        ...withStatus,
        activatedAt,
        cookieDays: draft.cookieDays,
        currency: displayCurrency,
        url: normalizeUrlInput(draft.url),
        category: String(draft.category ?? "").trim() || AFFILIATE_CATEGORY,
      });
      if (onPersist) {
        await Promise.resolve(onPersist(next));
      } else {
        await Promise.resolve(onSave?.(next));
      }
      setDraft(seedDraft(next));
      setCookieCommitted(true);
    } catch (err) {
      console.warn("[url-table] cookie card save failed", err);
      setSaveError(t("urlTableAffiliate.saveFailed"));
    } finally {
      setCookieSaving(false);
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
          disabled={saving || cookieSaving}
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
            disabled={saving || cookieSaving}
            aria-label={t("urlTableLibrary.closeTab")}
            title={t("urlTableLibrary.closeTab")}
          >
            ×
          </button>
        ) : null}
      </div>

      {isStatsOnly ? (
        <>
          <div className="url-table-entry-detail__hero">
            <div className="url-table-entry-detail__hero-media">
              {imageSrc ? (
                <img src={imageSrc} alt="" draggable={false} />
              ) : (
                <span className="url-table-entry-detail__hero-placeholder" aria-hidden />
              )}
            </div>
            <div className="url-table-entry-detail__hero-description">
              {descriptionText || "—"}
            </div>
          </div>
          {requirementsText ? (
            <div className="url-table-entry-detail__requirements">
              <span className="url-table-entry-detail__requirements-label">
                {t("urlTableAffiliate.requirements")}
              </span>
              <p className="url-table-entry-detail__requirements-body">{requirementsText}</p>
            </div>
          ) : null}
          <div className="url-table-entry-detail__stats-meta">
            <span
              className={`url-table-entry-detail__status-badge url-table-entry-detail__status-badge--${statusKey}`}
              title={t("urlTableAffiliate.statusLabel")}
            >
              {t(`urlTableAffiliate.status.${statusKey}`)}
            </span>
            {tagText ? (
              <span
                className="url-table-entry-detail__meta-chip url-table-entry-detail__meta-chip--tag"
                title={t("urlTableAffiliate.tag")}
              >
                <span className="url-table-entry-detail__meta-chip-at" aria-hidden>@</span>
                <span>{tagText}</span>
              </span>
            ) : null}
            {categoryText ? (
              <span
                className="url-table-entry-detail__meta-chip url-table-entry-detail__meta-chip--category"
                title={t("urlTableAffiliate.category")}
              >
                {categoryText}
              </span>
            ) : null}
          </div>
          {urlText ? (
            <a
              className="url-table-entry-detail__stats-url"
              href={urlText}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/uploads/url-table.svg" alt="" draggable={false} />
              <span>{urlText}</span>
            </a>
          ) : null}
        </>
      ) : null}

      <div className="url-table-entry-detail__stats">
        <div className="url-table-entry-detail__stat">
          <span className="url-table-entry-detail__stat-label">
            {t("urlTableAffiliate.perSale")}
          </span>
          <strong className="url-table-entry-detail__stat-value">
            {formatAffiliateMoney(perSale, moneyOpts)}
          </strong>
        </div>
        <div className="url-table-entry-detail__stat">
          <span className="url-table-entry-detail__stat-label">
            {t("urlTableAffiliate.earnings")}
          </span>
          <strong className="url-table-entry-detail__stat-value">
            {formatAffiliateMoney(earnings, moneyOpts)}
          </strong>
        </div>
        <div className="url-table-entry-detail__stat">
          <span className="url-table-entry-detail__stat-label url-table-entry-detail__stat-label--with-info">
            {t("urlTableAffiliate.cookieLeft")}
            {showCookieInfo ? (
              <AffiliateInfoHover
                label={t("urlTableAffiliate.cookieWindowInfoAria")}
                text={t("urlTableAffiliate.cookieWindowInfo")}
              />
            ) : null}
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

      {isStatsOnly ? (
        <div className="url-table-entry-detail__stats-inputs">
          <div className="url-table-entry-detail__stats-input">
            <span className="url-table-entry-detail__stats-input-label">
              {t("urlTableAffiliate.productPrice")}
            </span>
            <strong className="url-table-entry-detail__stats-input-value">
              {draft.productPrice != null
                ? formatAffiliateMoney(draft.productPrice, moneyOpts)
                : "—"}
            </strong>
          </div>
          <div className="url-table-entry-detail__stats-input">
            <span className="url-table-entry-detail__stats-input-label">
              {t("urlTableAffiliate.commission")}
            </span>
            <strong className="url-table-entry-detail__stats-input-value">
              {draft.commissionRate != null ? `${draft.commissionRate}%` : "—"}
            </strong>
          </div>
          <div className="url-table-entry-detail__stats-input">
            <span className="url-table-entry-detail__stats-input-label">
              {t("urlTableAffiliate.clientsWon")}
            </span>
            <strong className="url-table-entry-detail__stats-input-value">
              {draft.clientsWon ?? 0}
            </strong>
          </div>
        </div>
      ) : null}

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
              <span>{t("urlTableAffiliate.currency")}</span>
              <select
                value={currencySelectValue}
                onChange={(e) => handleCurrencySelect(e.target.value)}
              >
                {AFFILIATE_CURRENCY_PRESETS.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
                <option value={CURRENCY_CUSTOM}>{t("urlTableAffiliate.currencyCustom")}</option>
              </select>
              {currencySelectValue === CURRENCY_CUSTOM ? (
                <input
                  type="text"
                  value={rawCurrency}
                  placeholder={t("urlTableAffiliate.currencyCustomPlaceholder")}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    currency: e.target.value.toUpperCase(),
                  }))}
                />
              ) : null}
            </label>

            <div className="url-table-entry-detail__field url-table-entry-detail__cookie-block">
              <span className="url-table-entry-detail__label-row">
                {t("urlTableAffiliate.cookieDays")}
                {showCookieInfo ? (
                  <AffiliateInfoHover
                    label={t("urlTableAffiliate.cookieWindowInfoAria")}
                    text={t("urlTableAffiliate.cookieWindowInfo")}
                  />
                ) : null}
              </span>

              {cookieCommitted ? (
                <div className="url-table-entry-detail__cookie-summary">
                  <strong className="url-table-entry-detail__cookie-summary-days">
                    {t("urlTableAffiliate.cookieDaysSummary", {
                      days: draft.cookieDays ?? "—",
                    })}
                  </strong>
                  {expiresLabel ? (
                    <span className="url-table-entry-detail__cookie-summary-expires">
                      {t("urlTableAffiliate.cookieExpiresOn", { date: expiresLabel })}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="url-table-entry-detail__cookie-edit"
                    onClick={() => setCookieCommitted(false)}
                  >
                    {t("urlTableAffiliate.cookieCardEdit")}
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="date"
                    className="doc-new-date url-table-entry-detail__date"
                    value={cookieStartDate}
                    min={todayInput}
                    max={todayInput}
                    onChange={() => {
                      setDraft((prev) => ({
                        ...prev,
                        activatedAt: fromAffiliateDateInputValue(todayInput),
                      }));
                    }}
                    onClick={(e) => {
                      openDatePicker(e);
                      setDraft((prev) => ({
                        ...prev,
                        activatedAt: ensureTodayActivatedAt(prev),
                      }));
                    }}
                    onFocus={(e) => {
                      openDatePicker(e);
                      setDraft((prev) => ({
                        ...prev,
                        activatedAt: ensureTodayActivatedAt(prev),
                      }));
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="url-table-entry-detail__cookie-days"
                    value={draft.cookieDays ?? ""}
                    placeholder={t("urlTableAffiliate.cookieDaysDurationPlaceholder")}
                    onChange={(e) => patchNumber("cookieDays", e.target.value)}
                  />
                  <button
                    type="button"
                    className={
                      "doc-new-action doc-new-action--save url-table-entry-detail__cookie-save"
                      + (cookieSaving ? " doc-new-action--save-loading" : "")
                    }
                    onClick={() => void handleCookieCardSave()}
                    disabled={cookieSaving || draft.cookieDays == null}
                    aria-busy={cookieSaving}
                  >
                    {cookieSaving ? <SearchSpinner size={14} /> : null}
                    {cookieSaving ? t("urlTableAffiliate.saving") : t("common.save")}
                  </button>
                </>
              )}
            </div>

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
              disabled={saving || cookieSaving}
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
  return {
    ...base,
    affiliateStatus: base.affiliateStatus || "pending",
    currency: normalizeAffiliateCurrency(base.currency),
  };
}
