import { createPortal } from "react-dom";
import { buildTalkRequestPopoverCopy } from "../../lib/gina/ginaTalkRequest.js";

const GINA_AVATAR_SRC = "/uploads/g-assistente-responde.png";

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
        <p className="gina-talk-request-popover__title">{copy.title}</p>
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
