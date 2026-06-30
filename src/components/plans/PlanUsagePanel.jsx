import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanStore } from "../../stores/planStore.js";
import { useReferralModalStore } from "../../stores/referralModalStore.js";
import { getCreditsDisplay, getPlanFeatureRows } from "../../lib/planConfig.js";
import { useI18n } from "../../i18n/useI18n.js";
import { ReferralBanner } from "./ReferralBanner.jsx";
import { isReferralBannerDismissed, dismissReferralBanner } from "../../lib/referralBannerStorage.js";

/**
 * Sidebar / plans token usage panel.
 * @param {{ compact?: boolean }} props
 */
export function PlanUsagePanel({ compact = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const showReferralModal = useReferralModalStore((s) => s.show);
  const [bannerHidden, setBannerHidden] = useState(isReferralBannerDismissed);
  const profile = usePlanStore((s) => s.profile);
  const searchCount = usePlanStore((s) => s.profile.searchCount);
  const tokensBalance = usePlanStore((s) => s.profile.tokensBalance);
  const { cap, counter, remaining } = getCreditsDisplay({ ...profile, searchCount, tokensBalance });
  const creditsExpired = cap > 0 && remaining <= 0;
  const rows = getPlanFeatureRows(profile.plan);
  const pct = cap > 0 ? Math.max(0, Math.min(100, (remaining / cap) * 100)) : 0;

  return (
    <div className={"plan-usage" + (compact ? " plan-usage--compact" : "") + (creditsExpired ? " plan-usage--expired" : "")}>
      <div className="plan-usage__head">
        <span className="plan-usage__label">{profile.plan === "pro" ? "Pro" : "Starter"}</span>
        <span className="plan-usage__tokens" aria-label={t("plans.creditsCounter", { count: counter, cap })}>
          {counter}
          <span className="plan-usage__cap">/{cap}</span>
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
      {!bannerHidden ? (
        <ReferralBanner
          onOpen={showReferralModal}
          onDismiss={() => {
            dismissReferralBanner();
            setBannerHidden(true);
          }}
        />
      ) : null}
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
