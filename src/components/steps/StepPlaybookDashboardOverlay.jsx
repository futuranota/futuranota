import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StepSequenceBlockView } from "../docs/blocks/StepSequenceBlockView.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import { useAuthStore } from "../../stores/authStore.js";
import { isAdminSessionEmail } from "../../lib/adminPlanCredits.js";
import { fetchOwnStepPlaybookShare } from "../../lib/stepPlaybookShare.js";

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
 * Share UI is admin-beta only (VITE_ADMIN_EMAIL). Steps library stays public.
 *
 * @param {Object} props
 * @param {import("../../lib/stepPlaybookSession.js").StepPlaybookSession | null} props.session
 * @param {(patch: Partial<import("../../lib/stepPlaybookSession.js").StepPlaybookSession>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {(finalizedSteps: import("../../lib/docBlocks.js").StepEntry[]) => void} props.onSaved
 * @param {() => void | Promise<object | false | null>} [props.onRequestShare]
 * @param {() => void | Promise<boolean | void>} [props.onCopyShare]
 * @param {boolean} [props.shareBusy]
 */
export function StepPlaybookDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
  onRequestShare,
  onCopyShare,
  shareBusy = false,
}) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const shareBeta = isAdminSessionEmail(user?.email);
  const [shareRecord, setShareRecord] = useState(null);
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!shareBeta || !session?.saved || !session?.docId || !session?.blockId || !user?.id) {
        setShareRecord(null);
        return;
      }
      try {
        const row = await fetchOwnStepPlaybookShare({ session, user });
        if (!cancelled) setShareRecord(row);
      } catch (err) {
        console.warn("[share] load own failed", err);
        if (!cancelled) setShareRecord(null);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [shareBeta, session?.saved, session?.docId, session?.blockId, user?.id]);

  if (!session) return null;

  const canShareActions = Boolean(
    shareBeta
    && session.saved
    && session.docId
    && onRequestShare
    && onCopyShare,
  );
  const status = shareRecord?.status || null;

  const buttonMode = (() => {
    if (!canShareActions) return "hidden";
    if (status === "requested") return "requested";
    if (status === "published") return "copy";
    return "request";
  })();

  const handleShareClick = async () => {
    if (shareBusy || shareCopied || buttonMode === "requested" || buttonMode === "hidden") return;
    if (buttonMode === "request") {
      const row = await onRequestShare?.();
      if (row && typeof row === "object") setShareRecord(row);
      return;
    }
    if (buttonMode === "copy") {
      const ok = await onCopyShare?.();
      if (ok === false) return;
      setShareCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setShareCopied(false), 1600);
    }
  };

  const shareAria = shareCopied
    ? t("stepsLibrary.shareCopied")
    : buttonMode === "requested"
      ? t("stepsLibrary.shareRequestSentLabel")
      : t("stepsLibrary.share");

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
          {canShareActions ? (
            <button
              type="button"
              className={
                "step-playbook-dashboard-overlay__share"
                + (buttonMode === "requested" ? " step-playbook-dashboard-overlay__share--requested" : "")
                + (shareCopied ? " step-playbook-dashboard-overlay__share--copied" : "")
              }
              onClick={() => { void handleShareClick(); }}
              disabled={shareBusy || buttonMode === "requested"}
              aria-label={shareAria}
              title={shareAria}
            >
              {shareBusy ? (
                <span aria-hidden>…</span>
              ) : shareCopied ? (
                <span className="step-playbook-dashboard-overlay__share-check" aria-hidden>✓</span>
              ) : buttonMode === "requested" ? (
                <span className="step-playbook-dashboard-overlay__share-sent">
                  {t("stepsLibrary.shareRequestSentLabel")}
                </span>
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
