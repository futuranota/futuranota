import { useState } from "react";
import { Modal } from "../shared/Modal.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { listAdoptableDocs, resolveAdoptableDocLabel } from "../../lib/nodeParentAdoption.js";

/**
 * Pick a parent document for an orphan canvas node.
 */
export function AssignParentDocModal({
  docs,
  parentObjectId = null,
  orphanTitle,
  onConfirm,
  onClose,
}) {
  const { t } = useI18n();
  const docList = listAdoptableDocs(docs, { parentObjectId });
  const [selectedDocId, setSelectedDocId] = useState(docList[0]?.id || "");

  const handleConfirm = () => {
    if (!selectedDocId) return;
    onConfirm?.(selectedDocId);
  };

  return (
    <Modal
      title={t("canvas.assignParentTitle")}
      onClose={onClose}
    >
      <p className="adopt-node-modal__body">
        {t("canvas.assignParentBody", {
          orphan: orphanTitle || t("canvas.adoptNodeUntitled"),
        })}
      </p>
      <label className="adopt-node-modal__field">
        <span className="label">{t("canvas.assignParentLabel")}</span>
        <select
          className="adopt-node-modal__select"
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
        >
          {docList.length === 0 ? (
            <option value="">{t("canvas.assignParentEmpty")}</option>
          ) : (
            docList.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {resolveAdoptableDocLabel(doc)}
              </option>
            ))
          )}
        </select>
      </label>
      <div className="adopt-node-modal__actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={handleConfirm}
          disabled={!selectedDocId}
        >
          {t("canvas.assignParentConfirm")}
        </button>
      </div>
    </Modal>
  );
}
