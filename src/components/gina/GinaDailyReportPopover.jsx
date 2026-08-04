import { createPortal } from "react-dom";
import { buildDailyReportPopoverCopy } from "../../lib/gina/ginaDailyReport.js";

/**
 * Static nudge popover for pending Daily Report (conflict or celebrate).
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
  const en = locale === "en";
  const copy = buildDailyReportPopoverCopy(en ? "en" : "es", { kind });

  return createPortal(
    <div
      className={`gina-daily-report-popover${kind === "celebrate" ? " is-celebrate" : ""}`}
      role="dialog"
      aria-label="Gina daily report"
    >
      <p className="gina-daily-report-popover__text">{copy}</p>
      <div className="gina-daily-report-popover__actions">
        <button
          type="button"
          className="gina-daily-report-popover__btn is-primary"
          onClick={onOpenChat}
        >
          {en ? "Open chat" : "Abrir chat"}
        </button>
        <button
          type="button"
          className="gina-daily-report-popover__btn"
          onClick={onDefer}
        >
          {en ? "Check later" : "Verificar de luego"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default GinaDailyReportPopover;
