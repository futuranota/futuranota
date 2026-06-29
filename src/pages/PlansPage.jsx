import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanStore } from "../stores/planStore.js";
import { getHome } from "../marketing/lib/content.js";
import { PRICING_PLANS_DEFAULT, planBullets } from "../marketing/lib/pricingDefaults.js";
import { PlanUsagePanel } from "../components/plans/PlanUsagePanel.jsx";
import { useI18n } from "../i18n/useI18n.js";

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
  const setPlan = usePlanStore((s) => s.setPlan);
  const [busy, setBusy] = useState(false);

  const proPlan = useMemo(() => {
    const { pricing } = getHome();
    const rawPlans = pricing?.plans?.length ? pricing.plans : PRICING_PLANS_DEFAULT;
    return rawPlans.find((p) => p.id === "pro") ?? PRICING_PLANS_DEFAULT[1];
  }, []);

  const bullets = planBullets(proPlan);
  const isPro = profile.plan === "pro";
  const priceValue = formatPlanPrice(proPlan.price);

  const handlePrimaryAction = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setPlan(isPro ? "free" : "pro");
    } finally {
      setBusy(false);
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

      <div className="plans-pricing-card glass">
        <div className="plans-pricing-card__grid">
          <div className="plans-pricing-card__pricing">
            <h2 className="plans-pricing-card__plan-name">{proPlan.name}</h2>
            <p className="plans-pricing-card__desc">{proPlan.desc}</p>

            <div className="plans-pricing-card__price" aria-label={`$${priceValue}${proPlan.priceSuffix || ""}`}>
              <span className="plans-pricing-card__currency">$</span>
              <span className="plans-pricing-card__amount">{priceValue}</span>
              {proPlan.priceSuffix ? (
                <span className="plans-pricing-card__suffix">{proPlan.priceSuffix}</span>
              ) : null}
            </div>

            <div className="plans-pricing-card__cta-wrap">
              <button
                type="button"
                className={"btn plans-pricing-card__cta" + (isPro ? " plans-pricing-card__cta--cancel" : " primary")}
                disabled={busy}
                onClick={handlePrimaryAction}
              >
                {isPro ? t("plans.cancelPlan") : t("plans.upgradeToPro")}
              </button>
            </div>

            {proPlan.billingNote ? (
              <p className="plans-pricing-card__note">{proPlan.billingNote}</p>
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
    </div>
  );
}
