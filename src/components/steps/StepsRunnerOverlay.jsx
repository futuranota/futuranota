import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * @param {Object} props
 * @param {import("../../lib/stepsLibrary.js").StepPlaybookRef} props.playbook
 * @param {() => void} props.onClose
 * @param {() => void} [props.onComplete]
 */
export function StepsRunnerOverlay({ playbook, onClose, onComplete }) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const steps = useMemo(
    () => (playbook?.steps ?? []).map((step) => ({ ...step })),
    [playbook],
  );

  const total = steps.length;
  const stepNumber = Math.min(activeIndex, Math.max(total - 1, 0)) + 1;
  const activeStep = steps[Math.min(activeIndex, total - 1)] ?? steps[0];
  const isLastStep = total > 0 && activeIndex >= total - 1;

  useEffect(() => {
    setActiveIndex(0);
    setFinished(false);
  }, [playbook?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const goBack = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => Math.min(total - 1, prev + 1));
  }, [total]);

  const handleComplete = useCallback(() => {
    setFinished(true);
    onComplete?.();
  }, [onComplete]);

  const handlePrimaryAction = useCallback(() => {
    if (isLastStep) {
      handleComplete();
      return;
    }
    goNext();
  }, [goNext, handleComplete, isLastStep]);

  if (!playbook || !total) return null;

  return createPortal(
    <div className="steps-runner-overlay" role="dialog" aria-modal="true" aria-label={playbook.title}>
      <button
        type="button"
        className="steps-runner-overlay__backdrop"
        aria-label={t("common.back")}
        onClick={onClose}
      />
      <div className="steps-runner-overlay__card">
        <header className="steps-runner-overlay__header">
          <div className="steps-runner-overlay__heading">
            <span className="steps-runner-overlay__label">{t("stepsRunner.modeLabel")}</span>
            <h2 className="steps-runner-overlay__title">{playbook.title}</h2>
          </div>
          <button
            type="button"
            className="steps-runner-overlay__close"
            onClick={onClose}
            aria-label={t("common.back")}
          >
            ×
          </button>
        </header>

        {finished ? (
          <div className="steps-runner-overlay__done">
            <p className="steps-runner-overlay__done-title">{t("stepsRunner.done")}</p>
            <button type="button" className="btn steps-runner-overlay__done-btn" onClick={onClose}>
              {t("common.back")}
            </button>
          </div>
        ) : (
          <>
            <div className="steps-runner-overlay__progress" aria-hidden>
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={[
                    "steps-runner-overlay__progress-dot",
                    index === activeIndex ? "steps-runner-overlay__progress-dot--active" : "",
                    index < activeIndex ? "steps-runner-overlay__progress-dot--done" : "",
                  ].filter(Boolean).join(" ")}
                />
              ))}
            </div>

            <article className="steps-runner-overlay__panel">
              <span className="steps-runner-overlay__step-badge">
                {t("stepsRunner.stepOf", { n: stepNumber, m: total })}
              </span>
              <div className="steps-runner-overlay__text">
                {(activeStep?.text || "").trim() || "—"}
              </div>
            </article>

            <footer className="steps-runner-overlay__nav">
              <button
                type="button"
                className="btn steps-runner-overlay__nav-btn steps-runner-overlay__nav-btn--back"
                onClick={goBack}
                disabled={activeIndex <= 0}
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                className="btn steps-runner-overlay__nav-btn steps-runner-overlay__nav-btn--primary"
                onClick={handlePrimaryAction}
              >
                {isLastStep ? t("stepsRunner.complete") : t("stepsRunner.next")}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
