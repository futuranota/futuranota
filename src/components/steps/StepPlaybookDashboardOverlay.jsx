import { useEffect } from "react";
import { createPortal } from "react-dom";
import { StepSequenceBlockView } from "../docs/blocks/StepSequenceBlockView.jsx";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {Object} props
 * @param {import("../../lib/stepPlaybookSession.js").StepPlaybookSession | null} props.session
 * @param {(patch: Partial<import("../../lib/stepPlaybookSession.js").StepPlaybookSession>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {(finalizedSteps: import("../../lib/docBlocks.js").StepEntry[]) => void} props.onSaved
 */
export function StepPlaybookDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab]);

  if (!session) return null;

  return createPortal(
    <div
      className="step-playbook-dashboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("pack.stepsLibraryTitle")}
    >
      <div className="step-playbook-dashboard-overlay__backdrop" aria-hidden />
      <div className="step-playbook-dashboard-overlay__card">
        <button
          type="button"
          className="step-playbook-dashboard-overlay__close"
          onClick={onCloseTab}
          aria-label={t("stepsLibrary.closeTab")}
          title={t("stepsLibrary.closeTab")}
        >
          ×
        </button>
        <div className="step-playbook-dashboard-overlay__body scroll-match-bg">
          <StepSequenceBlockView
            blockId={session.blockId}
            title={session.title}
            steps={session.steps}
            saved={session.saved}
            autoFocus
            onTitleChange={(title) => onChange({ title })}
            onStepsChange={(steps) => onChange({ steps, saved: false })}
            onSavedChange={(finalizedSteps) => {
              onChange({ steps: finalizedSteps, saved: true });
              onSaved?.(finalizedSteps);
            }}
            onEditRequest={() => onChange({ saved: false })}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
