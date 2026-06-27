import { Modal } from "../shared/Modal.jsx";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Wire-connect confirmation: adopt orphan node into parent document or keep wire-only.
 */
export function AdoptNodeConfirmModal({
  docTitle,
  orphanTitle,
  onAdopt,
  onWireOnly,
}) {
  const { t } = useI18n();

  return (
    <Modal
      title={t("canvas.adoptNodeTitle")}
      onClose={onWireOnly}
    >
      <p className="adopt-node-modal__body">
        {t("canvas.adoptNodeBody", {
          orphan: orphanTitle || t("canvas.adoptNodeUntitled"),
          doc: docTitle || t("canvas.adoptNodeUntitled"),
        })}
      </p>
      <div className="adopt-node-modal__actions">
        <button type="button" className="btn ghost" onClick={onWireOnly}>
          {t("canvas.adoptNo")}
        </button>
        <button type="button" className="btn primary" onClick={onAdopt}>
          {t("canvas.adoptYes")}
        </button>
      </div>
    </Modal>
  );
}
