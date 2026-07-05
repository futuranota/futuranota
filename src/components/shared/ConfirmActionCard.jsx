import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useConfirmStore } from "../../stores/confirmStore.js";

export function ConfirmActionCard() {
  const payload = useConfirmStore((s) => s.payload);
  const answer = useConfirmStore((s) => s.answer);

  useEffect(() => {
    if (!payload) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        answer(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, payload]);

  if (!payload) return null;

  return createPortal(
    <div className="confirm-action-overlay" role="presentation">
      <button
        type="button"
        className="confirm-action-overlay__backdrop"
        aria-label={payload.cancelLabel}
        onClick={() => answer(false)}
      />
      <div
        className="confirm-action-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-message"
      >
        <h2 id="confirm-action-title" className="confirm-action-card__title">
          {payload.title}
        </h2>
        <p id="confirm-action-message" className="confirm-action-card__message">
          {payload.message}
        </p>
        <div className="confirm-action-card__actions">
          <button
            type="button"
            className="btn xs confirm-action-card__cancel"
            onClick={() => answer(false)}
          >
            {payload.cancelLabel}
          </button>
          <button
            type="button"
            className={[
              "btn xs confirm-action-card__confirm",
              payload.tone === "default"
                ? "confirm-action-card__confirm--default"
                : "confirm-action-card__confirm--danger",
            ].join(" ")}
            onClick={() => answer(true)}
          >
            {payload.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
