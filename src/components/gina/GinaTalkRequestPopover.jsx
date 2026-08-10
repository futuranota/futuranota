import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { buildTalkRequestPopoverCopy } from "../../lib/gina/ginaTalkRequest.js";
import { playGinaVoipCallSound } from "../../lib/ginaVoipCallSound.js";

const GINA_AVATAR_SRC = "/uploads/Assistance-visuals/Gina-Assistance.png";

/**
 * Overlay: Gina is requesting to talk — Accept / Decline.
 * @param {{
 *   open: boolean,
 *   locale?: string,
 *   onAccept: () => void,
 *   onDecline: () => void,
 * }} props
 */
export function GinaTalkRequestPopover({
  open,
  locale = "es",
  onAccept,
  onDecline,
}) {
  const playedForOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      playedForOpenRef.current = false;
      return undefined;
    }
    const tryPlay = () => {
      // Browsers often block audio while the tab is hidden — retry on visible.
      if (typeof document !== "undefined" && document.hidden) return;
      if (playedForOpenRef.current) return;
      playedForOpenRef.current = true;
      void playGinaVoipCallSound();
    };
    tryPlay();
    const onVis = () => {
      if (!document.hidden) tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const copy = buildTalkRequestPopoverCopy(locale === "en" ? "en" : "es");

  return createPortal(
    <div
      className="gina-talk-request-popover"
      role="dialog"
      aria-label={copy.title}
    >
      <div className="gina-talk-request-popover__row">
        <img
          className="gina-talk-request-popover__avatar"
          src={GINA_AVATAR_SRC}
          alt=""
          width={56}
          height={56}
        />
        <p className="gina-talk-request-popover__title">
          <span className="gina-talk-request-popover__emph">{copy.titleEmph}</span>
          {" "}
          <span className="gina-talk-request-popover__muted">{copy.titleMuted}</span>
        </p>
      </div>
      <div className="gina-talk-request-popover__actions">
        <button
          type="button"
          className="gina-talk-request-popover__btn is-accept"
          onClick={onAccept}
        >
          {copy.accept}
        </button>
        <button
          type="button"
          className="gina-talk-request-popover__btn is-decline"
          onClick={onDecline}
        >
          {copy.decline}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default GinaTalkRequestPopover;
