import { useNavigate } from "react-router-dom";
import { Modal } from "../shared/Modal.jsx";
import { PRICING_PLANS_DEFAULT, planBullets } from "../../marketing/lib/pricingDefaults.js";
import { useI18n } from "../../i18n/useI18n.js";

const REASON_MESSAGE_KEYS = {
  object_limit: "upgrade.reasonObjectLimit",
  guest_limit: "upgrade.reasonGuestLimit",
  guest_doc_limit: "upgrade.reasonGuestDocLimit",
  import_size: "upgrade.reasonImportSize",
  calendar: "upgrade.reasonCalendar",
  weather: "upgrade.reasonWeather",
  search: "upgrade.reasonSearch",
  tokens: "upgrade.reasonTokens",
  campaign_frozen: "upgrade.reasonCampaignFrozen",
  export: "upgrade.reasonExport",
  steps_library: "upgrade.reasonStepsLibrary",
  url_table_affiliate: "upgrade.reasonUrlTableAffiliate",
  generic: "upgrade.reasonGeneric",
};

export function UpgradeModal({ open, reason = "generic", onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!open) return null;

  const proPlan = PRICING_PLANS_DEFAULT.find((p) => p.id === "pro");
  const messageKey = REASON_MESSAGE_KEYS[reason] || REASON_MESSAGE_KEYS.generic;

  return (
    <Modal title={t("upgrade.title")} onClose={onClose}>
      <p className="upgrade-reason">{t(messageKey)}</p>
      <ul className="upgrade-bullets">
        {planBullets(proPlan).map((b) => <li key={b}>{b}</li>)}
      </ul>
      <div className="upgrade-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => { onClose(); navigate("/app/plans"); }}
        >
          {t("upgrade.cta")}
        </button>
      </div>
    </Modal>
  );
}
