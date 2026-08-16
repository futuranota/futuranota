import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { StudioWorkspace } from "./StudioWorkspace.jsx";

export function StudioPanel({ onClose }) {
  const { t } = useI18n();

  return createPortal(
    <div
      className="lp-overlay lp-overlay--solid lp-overlay--center studio-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("studio.title")}
    >
      <button
        type="button"
        className="studio-overlay__backdrop"
        aria-label={t("studio.close")}
        onClick={onClose}
      />
      <div
        className="studio-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <StudioWorkspace onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
