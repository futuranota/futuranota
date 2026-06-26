import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { getPlanFeatureRows } from "../../lib/planConfig.js";

/**
 * Sidebar / plans token usage panel.
 * @param {{ compact?: boolean }} props
 */
export function PlanUsagePanel({ compact = false }) {
  const profile = usePlanStore((s) => s.profile);
  const cap = usePlanStore((s) => s.getCreditsCap());
  const used = usePlanStore((s) => s.getCreditsUsed());
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);
  const rows = getPlanFeatureRows(profile.plan);
  const pct = cap > 0 ? Math.max(0, Math.min(100, (used / cap) * 100)) : 0;

  return (
    <div className={"plan-usage" + (compact ? " plan-usage--compact" : "")}>
      <div className="plan-usage__head">
        <span className="plan-usage__label">{profile.plan === "pro" ? "Pro" : "Starter"}</span>
        <span className="plan-usage__tokens">
          {used}
          <span className="plan-usage__cap"> / {cap}</span>
        </span>
      </div>
      <div className="plan-usage__bar">
        <div className="plan-usage__fill" style={{ width: `${pct}%` }} />
      </div>
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
      {profile.plan === "free" && profile.campaignLiveUsed ? (
        <p className="plan-usage__hint">Campaign study frozen — upgrade to refresh live.</p>
      ) : null}
      {profile.plan === "free" ? (
        <button type="button" className="btn xs ghost plan-usage__cta" onClick={() => showUpgradeModal("tokens")}>
          Upgrade →
        </button>
      ) : null}
    </div>
  );
}
