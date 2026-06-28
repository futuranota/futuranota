import { useNavigate } from "react-router-dom";
import { usePlanStore } from "../../stores/planStore.js";
import { getCreditsDisplay, getPlanFeatureRows } from "../../lib/planConfig.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Sidebar / plans token usage panel.
 * @param {{ compact?: boolean }} props
 */
export function PlanUsagePanel({ compact = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const profile = usePlanStore((s) => s.profile);
  const searchCount = usePlanStore((s) => s.profile.searchCount);
  const tokensBalance = usePlanStore((s) => s.profile.tokensBalance);
  const { cap, counter } = getCreditsDisplay({ ...profile, searchCount, tokensBalance });
  const creditsExpired = cap > 0 && counter === 0;
  const rows = getPlanFeatureRows(profile.plan);
  const pct = cap > 0 ? Math.max(0, Math.min(100, (counter / cap) * 100)) : 0;

  return (
    <div className={"plan-usage" + (compact ? " plan-usage--compact" : "") + (creditsExpired ? " plan-usage--expired" : "")}>
      <div className="plan-usage__head">
        <span className="plan-usage__label">{profile.plan === "pro" ? "Pro" : "Starter"}</span>
        <span className="plan-usage__tokens" aria-label={t("plans.creditsCounter", { count: counter })}>
          {counter}
        </span>
      </div>
      <div className="plan-usage__bar">
        <div className="plan-usage__fill" style={{ width: `${pct}%` }} />
      </div>
      {creditsExpired ? (
        <div className="plan-usage__expired" role="status">
          <p className="plan-usage__expired-title">{t("plans.creditsExpired")}</p>
          <p className="plan-usage__expired-body">{t("plans.creditsExpiredHint")}</p>
        </div>
      ) : null}
      <button
        type="button"
        className="btn xs ghost plan-usage__cta"
        onClick={() => navigate("/app/plans")}
      >
        {t("sidebar.upgrade")}
      </button>
      {!compact ? (
        <table className="plan-usage__table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {!compact && profile.plan === "free" && profile.campaignLiveUsed ? (
        <p className="plan-usage__hint">Campaign study frozen — upgrade to refresh live.</p>
      ) : null}
    </div>
  );
}
