import { useNavigate } from "react-router-dom";
import { usePlanStore } from "../stores/planStore.js";
import { PRICING_PLANS_DEFAULT, planBullets } from "../marketing/lib/pricingDefaults.js";
import { PlanUsagePanel } from "../components/plans/PlanUsagePanel.jsx";
import { useI18n } from "../i18n/useI18n.js";

export function PlansPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const profile = usePlanStore((s) => s.profile);
  const setPlan = usePlanStore((s) => s.setPlan);

  return (
    <div className="plans-page" style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px" }}>
      <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
        {t("common.back")}
      </button>
      <h1>{t("plans.title")}</h1>
      <p>
        {t("plans.currentLabel")}: <strong>{profile.plan === "pro" ? t("plans.pro") : t("plans.free")}</strong>
      </p>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <PlanUsagePanel />
      </div>

      <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 16 }}>
        {PRICING_PLANS_DEFAULT.map((plan) => (
          <div
            key={plan.id}
            className={"plan-card glass" + (profile.plan === plan.id ? " plan-card--active" : "")}
            style={{ padding: 20, borderRadius: 12 }}
          >
            <h2>{plan.name}</h2>
            <p>{plan.desc}</p>
            <ul>
              {planBullets(plan).map((b) => <li key={b}>{b}</li>)}
            </ul>
            <button
              type="button"
              className="btn primary"
              disabled={profile.plan === plan.id}
              onClick={() => setPlan(plan.id)}
            >
              {profile.plan === plan.id ? t("plans.current") : t("plans.switchTo", { plan: plan.name })}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
