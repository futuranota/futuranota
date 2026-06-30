import { Modal } from "../shared/Modal.jsx";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {{ open: boolean, busy?: boolean, onClose: () => void, onConfirm: () => void }} props
 */
export function CancelPlanModal({ open, busy = false, onClose, onConfirm }) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <Modal title={t("plans.cancelModalTitle")} onClose={busy ? () => {} : onClose}>
      <p className="plans-cancel-modal__body">{t("plans.cancelModalBody")}</p>
      <ul className="plans-cancel-modal__list">
        <li>{t("plans.cancelModalBulletImmediate")}</li>
        <li>{t("plans.cancelModalBulletCredits")}</li>
        <li>{t("plans.cancelModalBulletFeatures")}</li>
      </ul>
      <div className="plans-cancel-modal__actions">
        <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
          {t("plans.cancelModalKeep")}
        </button>
        <button
          type="button"
          className="btn plans-pricing-card__cta--cancel"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? t("plans.processing") : t("plans.cancelModalConfirm")}
        </button>
      </div>
    </Modal>
  );
}
