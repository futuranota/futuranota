import { useI18n } from "../../i18n/useI18n.js";

/**
 * Meet Gina card in Assistance section — opens dashboard chat (not canvas insert).
 * @param {{ onTalk: () => void }} props
 */
export function AssistanceListCard({ onTalk }) {
  const { t } = useI18n();

  return (
    <div className="lp-agent-card fn-card lp-assistance-card">
      <div className="lp-agent-card__icon lp-assistance-card__icon" aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 10.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5M13 10.5c.5-1 1.5-1.5 2.5-1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M9 14.5c1 .8 2 .8 3 0s2-.8 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="lp-agent-card__body">
        <p className="lp-agent-card__title">{t("gina.meetTitle")}</p>
        <p className="lp-agent-card__desc dim">{t("gina.meetDescription")}</p>
      </div>
      <button
        type="button"
        className="btn sm primary lp-agent-card__insert"
        onClick={() => onTalk?.()}
      >
        {t("gina.talkToAssistance")}
      </button>
    </div>
  );
}

export default AssistanceListCard;
