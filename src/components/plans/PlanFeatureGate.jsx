import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Overlay CTA for plan-gated features.
 * @param {{ title: string, body?: string, cta?: string, badge?: string, onUpgrade?: () => void }} props
 */
export function PlanFeatureGate({ title, body, cta, badge, onUpgrade }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    navigate("/app/plans");
  };

  return (
    <div className="plan-feature-gate" role="status">
      {badge ? <span className="plan-feature-gate__badge">{badge}</span> : null}
      <p className="plan-feature-gate__title">{title}</p>
      {body ? <p className="plan-feature-gate__body">{body}</p> : null}
      <button type="button" className="btn sm primary plan-feature-gate__cta" onClick={handleUpgrade}>
        {cta || t("plans.upgradeToPro")}
      </button>
    </div>
  );
}
