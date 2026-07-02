import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../shared/Modal.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchAffiliateLink, fetchReferralHistory } from "../../lib/billingApi.js";
import { REFERRAL_REWARD_CREDITS } from "../../lib/referralConstants.js";
import { buildReferralShareMessage } from "../../lib/referralShareMessage.js";

function GiftIcon({ size = 16 }) {
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
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function ReferralModal({ open, onClose }) {
  const { t } = useI18n();
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(/** @type {{ items: { id: string, reward_credits: number, created_at: string }[] }} | null */ (null));

  const shareMessage = useMemo(
    () => buildReferralShareMessage(affiliateUrl, t),
    [affiliateUrl, t],
  );

  useEffect(() => {
    if (!open) return;
    setShowHistory(false);
    setCopied(false);
    void fetchAffiliateLink()
      .then((data) => setAffiliateUrl(data.url || ""))
      .catch(() => setAffiliateUrl(""));
  }, [open]);

  useEffect(() => {
    if (!open || !showHistory) return;
    void fetchReferralHistory()
      .then(setHistory)
      .catch(() => setHistory({ total: 0, items: [] }));
  }, [open, showHistory]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const content = (
    <Modal title={t("referral.modalTitle")} onClose={onClose}>
      <div className="referral-modal">
        <div className="referral-modal__callout">
          <GiftIcon />
          <p>{t("referral.modalHint", { credits: REFERRAL_REWARD_CREDITS })}</p>
        </div>

        <button
          type="button"
          className="referral-modal__history-toggle"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? t("referral.hideHistory") : t("referral.viewHistory")}
        </button>

        {showHistory ? (
          <div className="referral-modal__history">
            {!history ? (
              <p className="referral-modal__muted">{t("common.loading")}</p>
            ) : history.items.length === 0 ? (
              <p className="referral-modal__muted">{t("referral.historyEmpty")}</p>
            ) : (
              <ul className="referral-modal__history-list">
                {history.items.map((item) => (
                  <li key={item.id}>
                    <span>+{item.reward_credits} {t("referral.creditsLabel")}</span>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <label className="referral-modal__label" htmlFor="referral-share-message">
          {t("referral.shareLabel")}
        </label>
        <textarea
          id="referral-share-message"
          className="referral-modal__input referral-modal__input--readonly"
          rows={7}
          readOnly
          value={shareMessage}
          placeholder={t("referral.sharePlaceholder")}
        />

        <div className="referral-modal__footer">
          <button type="button" className="btn sm primary" disabled={!shareMessage} onClick={handleCopy}>
            {copied ? t("plans.referralCopied") : t("referral.copyMessage")}
          </button>
        </div>
      </div>
    </Modal>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
