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
 * @param {() => void | Promise<void>} [props.onShare]
 * @param {boolean} [props.shareBusy]
 */
export function StepPlaybookDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
  onShare,
  shareBusy = false,
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

  const canShare = Boolean(session.saved && session.docId && onShare);

  return createPortal(
    <div
      className="step-playbook-dashboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("pack.stepsLibraryTitle")}
    >
      <div className="step-playbook-dashboard-overlay__backdrop" aria-hidden />
      <div className="step-playbook-dashboard-overlay__card">
        <div className="step-playbook-dashboard-overlay__top-actions">
          {canShare ? (
            <button
              type="button"
              className="step-playbook-dashboard-overlay__share"
              onClick={() => { void onShare?.(); }}
              disabled={shareBusy}
              aria-label={t("stepsLibrary.share")}
              title={t("stepsLibrary.share")}
            >
              {shareBusy ? "…" : t("stepsLibrary.share")}
            </button>
          ) : null}
          <button
            type="button"
            className="step-playbook-dashboard-overlay__close"
            onClick={onCloseTab}
            aria-label={t("stepsLibrary.closeTab")}
            title={t("stepsLibrary.closeTab")}
          >
            ×
          </button>
        </div>
        <div className="step-playbook-dashboard-overlay__body scroll-match-bg">
          <StepSequenceBlockView
            key={`${session.docId || "new"}:${session.blockId}:${session.initialStepIndex ?? 0}`}
            blockId={session.blockId}
            title={session.title}
            steps={session.steps}
            saved={session.saved}
            initialActiveIndex={session.initialStepIndex ?? 0}
            autoFocus
            onTitleChange={(title) => onChange({ title })}
            onStepsChange={(steps) => onChange({ steps, saved: false })}
            onSavedChange={(finalizedSteps) => {
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
