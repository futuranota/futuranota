import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../shared/Modal.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import {
  fetchAffiliateLink,
  fetchReferralHistory,
  sendReferralInvites,
} from "../../lib/billingApi.js";
import { REFERRAL_REWARD_CREDITS } from "../../lib/referralConstants.js";

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
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(/** @type {{ items: { id: string, reward_credits: number, created_at: string }[] }} | null */ (null));

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    setShowHistory(false);
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
    if (!affiliateUrl) return;
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendReferralInvites(emails);
      setSuccess(t("referral.inviteSent", { count: result.sent }));
      setEmails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("referral.inviteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <Modal title={t("referral.modalTitle")} onClose={busy ? () => {} : onClose}>
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

        <label className="referral-modal__label" htmlFor="referral-emails">
          {t("referral.emailLabel")}
        </label>
        <textarea
          id="referral-emails"
          className="referral-modal__input"
          rows={3}
          placeholder={t("referral.emailPlaceholder")}
          value={emails}
          disabled={busy}
          onChange={(e) => setEmails(e.target.value)}
        />

        {error ? <p className="referral-modal__error" role="alert">{error}</p> : null}
        {success ? <p className="referral-modal__success" role="status">{success}</p> : null}

        <div className="referral-modal__footer">
          <button type="button" className="btn sm ghost" disabled={busy || !affiliateUrl} onClick={handleCopy}>
            {copied ? t("plans.referralCopied") : t("referral.copyLink")}
          </button>
          <button type="button" className="btn sm primary" disabled={busy || !emails.trim()} onClick={handleSend}>
            {busy ? t("plans.processing") : t("referral.sendInvite")}
          </button>
        </div>
      </div>
    </Modal>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
