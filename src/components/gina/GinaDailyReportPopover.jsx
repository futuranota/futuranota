import { createPortal } from "react-dom";
import { buildDailyReportPopoverCopy } from "../../lib/gina/ginaDailyReport.js";
import { ShimmeringText } from "./ShimmeringText.jsx";

const GINA_AVATAR_SRC = "/uploads/Assistance-visuals/Gina-Assistance.png";

/**
 * Daily Report nudge — same card family as talk-request (avatar, shimmer, green/gray).
 * @param {{
 *   open: boolean,
 *   locale?: string,
 *   kind?: "conflict" | "celebrate",
 *   onOpenChat: () => void,
 *   onDefer: () => void,
 * }} props
 */
export function GinaDailyReportPopover({
  open,
  locale = "es",
  kind = "conflict",
  onOpenChat,
  onDefer,
}) {
  if (!open || typeof document === "undefined") return null;
  const copy = buildDailyReportPopoverCopy(locale === "en" ? "en" : "es", { kind });

  return createPortal(
    <div
      className={
        "gina-talk-request-popover"
        + (kind === "celebrate" ? " is-celebrate" : "")
      }
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
          <ShimmeringText
            text={copy.title}
            startOnView={false}
            color="#a1a0a0"
            shimmerColor="#ffffff"
            duration={2.2}
            spread={1.8}
            className="gina-talk-request-popover__shimmer"
          />
        </p>
      </div>
      <div className="gina-talk-request-popover__actions">
        <button
          type="button"
          className="gina-talk-request-popover__btn is-accept"
          onClick={onOpenChat}
        >
          {copy.accept}
        </button>
        <button
          type="button"
          className="gina-talk-request-popover__btn is-decline"
          onClick={onDefer}
        >
          {copy.decline}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default GinaDailyReportPopover;
