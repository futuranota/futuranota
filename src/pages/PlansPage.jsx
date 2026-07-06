import { useEffect, useMemo, useState } from "react";
import { buildReferralShareMessage } from "../lib/referralShareMessage.js";
import { useNavigate } from "react-router-dom";
import { usePlanStore } from "../stores/planStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { isAdminSessionEmail } from "../lib/adminPlanCredits.js";
import { getHome } from "../marketing/lib/content.js";
import { PRICING_PLANS_DEFAULT, planBullets } from "../marketing/lib/pricingDefaults.js";
import { PlanUsagePanel } from "../components/plans/PlanUsagePanel.jsx";
import { useI18n } from "../i18n/useI18n.js";
import {
  cancelProSubscription,
  fetchAffiliateLink,
  fetchVerifyCheckoutAvailable,
  startProCheckout,
  startProVerifyCheckout,
} from "../lib/billingApi.js";
import { useStripeCheckoutReturn } from "../lib/useStripeCheckoutReturn.js";
import { CancelPlanModal } from "../components/plans/CancelPlanModal.jsx";

function formatPlanPrice(price) {
  const raw = String(price ?? "").trim();
  if (!raw) return "0";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function CheckIcon() {
  return (
    <svg className="plans-pricing-card__check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6.5 10.2 8.8 12.5 13.5 7.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlansPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const profile = usePlanStore((s) => s.profile);
  const fetchProfile = usePlanStore((s) => s.fetchProfile);
  const refillCreditsToFull = usePlanStore((s) => s.refillCreditsToFull);
  const refillFreeStarter = usePlanStore((s) => s.refillFreeStarter);
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminSessionEmail(user?.email);
  const [busy, setBusy] = useState(false);
  const [refillBusy, setRefillBusy] = useState(false);
  const [error, setError] = useState(null);
  const [billing, setBilling] = useState("monthly");
  const [affiliate, setAffiliate] = useState(null);
  const [copied, setCopied] = useState(false);

  const shareMessage = useMemo(
    () => buildReferralShareMessage(affiliate?.url || "", t),
    [affiliate?.url, t],
  );
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [verifyCheckoutAvailable, setVerifyCheckoutAvailable] = useState(false);

  const isPro = profile.plan === "pro";
  const showVerifyCheckout = !isPro && verifyCheckoutAvailable;

  const proPlan = useMemo(() => {
    const { pricing } = getHome();
    const rawPlans = pricing?.plans?.length ? pricing.plans : PRICING_PLANS_DEFAULT;
    return rawPlans.find((p) => p.id === "pro") ?? PRICING_PLANS_DEFAULT[1];
  }, []);

  const bullets = planBullets(proPlan);
  const hasStripeSubscription = Boolean(profile.stripeSubscriptionId);
  const canCancelViaStripe = isPro && hasStripeSubscription;
  const isAnnual = billing === "annual";
  const showUpgradeCta = !isPro;
  const showCancelCta = canCancelViaStripe && !isAnnual;
  const showSwitchAnnualCta = canCancelViaStripe && isAnnual;
  const priceValue = formatPlanPrice(isAnnual ? proPlan.annualPrice : proPlan.price);
  const priceSuffix = isAnnual ? proPlan.annualPriceSuffix : proPlan.priceSuffix;
  const billingNote = isAnnual ? proPlan.annualBillingNote : proPlan.billingNote;

  useStripeCheckoutReturn();

  useEffect(() => {
    let cancelled = false;
    void fetchAffiliateLink()
      .then((data) => {
        if (!cancelled) setAffiliate(data);
      })
      .catch(() => {
        if (!cancelled) setAffiliate(null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isPro) {
      setVerifyCheckoutAvailable(false);
      return;
    }
    let cancelled = false;
    void fetchVerifyCheckoutAvailable()
      .then(({ available }) => {
        if (!cancelled) setVerifyCheckoutAvailable(available);
      })
      .catch(() => {
        if (!cancelled) setVerifyCheckoutAvailable(false);
      });
    return () => { cancelled = true; };
  }, [isPro]);

  const handlePrimaryAction = async () => {
    if (busy) return;
    if (isPro) {
      if (showSwitchAnnualCta) {
        setBusy(true);
        setError(null);
        try {
          const { url } = await startProCheckout("annual");
          if (url) {
            window.location.href = url;
            return;
          }
          throw new Error("Stripe checkout URL missing");
        } catch (err) {
          setError(err instanceof Error ? err.message : t("plans.billingError"));
        } finally {
          setBusy(false);
        }
        return;
      }
      if (!hasStripeSubscription) return;
      setCancelModalOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await startProCheckout(billing);
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Stripe checkout URL missing");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plans.billingError"));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCheckout = async () => {
    if (busy || isPro) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await startProVerifyCheckout();
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Stripe checkout URL missing");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plans.billingError"));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await cancelProSubscription();
      await fetchProfile();
      setCancelModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plans.billingError"));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleRestoreCredits = async (mode = "pro") => {
    if (refillBusy) return;
    setRefillBusy(true);
    setError(null);
    try {
      const ok = mode === "free"
        ? await refillFreeStarter()
        : await refillCreditsToFull();
      if (!ok) throw new Error(t("plans.adminRestoreFailed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plans.adminRestoreFailed"));
    } finally {
      setRefillBusy(false);
    }
  };

  return (
    <div className="plans-page">
      <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
        {t("common.back")}
      </button>

      <div className="plans-page__head">
        <h1 className="plans-page__title">{t("plans.title")}</h1>
        <p className="plans-page__current">
          {t("plans.currentLabel")}:{" "}
          <strong>{isPro ? t("plans.pro") : t("plans.free")}</strong>
        </p>
      </div>

      <div className="plans-page__usage">
        <PlanUsagePanel />
      </div>

      {isAdmin ? (
        <div className="plans-admin-tools glass">
          <p className="plans-admin-tools__label">{t("plans.adminToolsTitle")}</p>
          <p className="plans-admin-tools__hint">{t("plans.adminToolsHint")}</p>
          <div className="plans-admin-tools__actions">
            <button
              type="button"
              className="btn sm ghost"
              disabled={refillBusy}
              onClick={() => handleRestoreCredits("pro")}
            >
              {refillBusy ? t("plans.processing") : t("plans.adminRestore200")}
            </button>
            <button
              type="button"
              className="btn sm ghost"
              disabled={refillBusy}
              onClick={() => handleRestoreCredits("free")}
            >
              {refillBusy ? t("plans.processing") : t("plans.adminRestore10")}
            </button>
          </div>
        </div>
      ) : null}

      {affiliate?.url ? (
        <div className="plans-referral glass">
          <p className="plans-referral__label">{t("plans.referralTitle")}</p>
          <p className="plans-referral__hint">{t("plans.referralHint")}</p>
          <label className="plans-referral__share-label" htmlFor="plans-referral-share">
            {t("referral.shareLabel")}
          </label>
          <textarea
            id="plans-referral-share"
            className="plans-referral__share"
            rows={7}
            readOnly
            value={shareMessage}
            placeholder={t("referral.sharePlaceholder")}
          />
          <div className="plans-referral__row">
            <button type="button" className="btn xs primary" onClick={handleCopyReferral}>
              {copied ? t("plans.referralCopied") : t("referral.copyMessage")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="plans-pricing-card glass">
        <div className="plans-pricing-card__grid">
          <div className="plans-pricing-card__pricing">
            <h2 className="plans-pricing-card__plan-name">{proPlan.name}</h2>
            <p className="plans-pricing-card__desc">{proPlan.desc}</p>

            <div className="plans-billing-toggle" role="tablist" aria-label={t("plans.billingToggle")}>
              <button
                type="button"
                role="tab"
                aria-selected={!isAnnual}
                className={"plans-billing-toggle__btn" + (!isAnnual ? " is-active" : "")}
                onClick={() => setBilling("monthly")}
              >
                {t("plans.billingMonthly")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isAnnual}
                className={"plans-billing-toggle__btn" + (isAnnual ? " is-active" : "")}
                onClick={() => setBilling("annual")}
              >
                {t("plans.billingAnnual")}
              </button>
            </div>

            <div className="plans-pricing-card__price" aria-label={`$${priceValue}${priceSuffix || ""}`}>
              <span className="plans-pricing-card__currency">$</span>
              <span className="plans-pricing-card__amount">{priceValue}</span>
              {priceSuffix ? (
                <span className="plans-pricing-card__suffix">{priceSuffix}</span>
              ) : null}
            </div>

            <div className="plans-pricing-card__cta-wrap">
              {showUpgradeCta || showCancelCta || showSwitchAnnualCta ? (
                <button
                  type="button"
                  className={"btn plans-pricing-card__cta" + (showCancelCta ? " plans-pricing-card__cta--cancel" : " primary")}
                  disabled={busy}
                  onClick={handlePrimaryAction}
                >
                  {busy && !cancelModalOpen
                    ? t("plans.processing")
                    : showCancelCta
                      ? t("plans.cancelPlan")
                      : showSwitchAnnualCta
                        ? t("plans.switchToAnnual")
                        : t("plans.upgradeToPro")}
                </button>
              ) : null}
              {showVerifyCheckout ? (
                <button
                  type="button"
                  className="btn ghost plans-pricing-card__cta plans-pricing-card__cta--verify"
                  disabled={busy}
                  onClick={handleVerifyCheckout}
                >
                  {busy ? t("plans.processing") : t("plans.proVerifyCheckout")}
                </button>
              ) : null}
            </div>

            {showVerifyCheckout ? (
              <p className="plans-pricing-card__note plans-pricing-card__note--muted">
                {t("plans.proVerifyCheckoutHint")}
              </p>
            ) : null}

            {isPro && canCancelViaStripe && !isAnnual ? (
              <p className="plans-pricing-card__note plans-pricing-card__note--muted">
                {t("plans.proOnMonthlyNote")}
              </p>
            ) : null}

            {isPro && !hasStripeSubscription ? (
              <p className="plans-pricing-card__note plans-pricing-card__note--muted">
                {t("plans.proManagedNote")}
              </p>
            ) : null}

            {error ? (
              <p className="plans-pricing-card__error" role="alert">{error}</p>
            ) : null}

            {billingNote ? (
              <p className="plans-pricing-card__note">{billingNote}</p>
            ) : null}

            {isAnnual ? (
              <p className="plans-pricing-card__note plans-pricing-card__note--muted">
                {t("plans.annualReferralNote")}
              </p>
            ) : null}
          </div>

          <div className="plans-pricing-card__features">
            <p className="plans-pricing-card__features-label">{t("plans.everythingInStarterPlus")}</p>
            <ul className="plans-pricing-card__list" role="list">
              {bullets.map((item) => (
                <li key={item} className="plans-pricing-card__list-item">
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <CancelPlanModal
        open={cancelModalOpen}
        busy={busy}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
