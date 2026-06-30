import { useI18n } from "../../i18n/useI18n.js";

function GiftIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 17v-5M10 12H4.5A1.5 1.5 0 0 1 3 10.5v-2A1.5 1.5 0 0 1 4.5 7H10M10 12h5.5A1.5 1.5 0 0 0 17 10.5v-2A1.5 1.5 0 0 0 15.5 7H10M10 7V4.8M7.2 4.8h5.6M8.2 4.8A1.8 1.8 0 0 1 10 3a1.8 1.8 0 0 1 1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @param {{ onOpen: () => void, onDismiss: () => void }} props
 */
export function ReferralBanner({ onOpen, onDismiss }) {
  const { t } = useI18n();
  return (
    <div className="referral-banner" role="status">
      <button type="button" className="referral-banner__main" onClick={onOpen}>
        <span className="referral-banner__icon">
          <GiftIcon />
        </span>
        <span className="referral-banner__text">{t("referral.bannerTitle")}</span>
      </button>
      <button
        type="button"
        className="referral-banner__dismiss"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        aria-label={t("referral.dismiss")}
      >
        ×
      </button>
    </div>
  );
}
