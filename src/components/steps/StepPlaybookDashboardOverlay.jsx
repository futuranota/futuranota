import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StepSequenceBlockView } from "../docs/blocks/StepSequenceBlockView.jsx";
import { useI18n } from "../../i18n/useI18n.js";

function ShareGlyph({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6.5 12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v5.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @param {Object} props
 * @param {import("../../lib/stepPlaybookSession.js").StepPlaybookSession | null} props.session
 * @param {(patch: Partial<import("../../lib/stepPlaybookSession.js").StepPlaybookSession>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {(finalizedSteps: import("../../lib/docBlocks.js").StepEntry[]) => void} props.onSaved
 * @param {() => void | Promise<boolean | void>} [props.onShare]
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
  const [shareCopied, setShareCopied] = useState(false);
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab]);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  if (!session) return null;

  const canShare = Boolean(session.saved && session.docId && onShare);

  const handleShareClick = async () => {
    if (shareBusy || shareCopied) return;
    const ok = await onShare?.();
    if (ok === false) return;
    setShareCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setShareCopied(false), 1600);
  };

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
              className={
                "step-playbook-dashboard-overlay__share"
                + (shareCopied ? " step-playbook-dashboard-overlay__share--copied" : "")
              }
              onClick={() => { void handleShareClick(); }}
              disabled={shareBusy}
              aria-label={shareCopied ? t("stepsLibrary.shareCopied") : t("stepsLibrary.share")}
              title={shareCopied ? t("stepsLibrary.shareCopied") : t("stepsLibrary.share")}
            >
              {shareBusy ? (
                <span aria-hidden>…</span>
              ) : shareCopied ? (
                <span className="step-playbook-dashboard-overlay__share-check" aria-hidden>✓</span>
              ) : (
                <ShareGlyph className="step-playbook-dashboard-overlay__share-icon" />
              )}
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
