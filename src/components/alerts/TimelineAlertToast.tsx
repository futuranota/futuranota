import "../../styles/timeline-alert-tailwind.css";
import type { TimelineAlertData } from "../../types/timelineAlert";
import { MOCK_TIMELINE_ALERT } from "../../types/timelineAlert";

export type { TimelineAlertData } from "../../types/timelineAlert";
export { MOCK_TIMELINE_ALERT } from "../../types/timelineAlert";

type TimelineAlertToastProps = {
  alert?: TimelineAlertData;
  onDismiss?: () => void;
  className?: string;
};

export function TimelineAlertToast({
  alert = MOCK_TIMELINE_ALERT,
  onDismiss,
  className = "",
}: TimelineAlertToastProps) {
  if (!alert) return null;

  return (
    <aside
      className={
        "timeline-alert-enter pointer-events-auto absolute bottom-4 right-4 z-40 w-[min(100%,18.5rem)] "
        + "rounded-lg border border-white/10 bg-[#161616]/95 font-sans shadow-2xl backdrop-blur-md "
        + className
      }
      role="alertdialog"
      aria-labelledby="timeline-alert-title"
      aria-describedby="timeline-alert-message"
    >
      <div className="relative p-4">
        <header className="mb-3 flex items-start justify-between gap-3 pr-6">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
            Timeline Alert
          </span>
          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
            onClick={onDismiss}
            aria-label="Dismiss timeline alert"
          >
            ×
          </button>
        </header>

        <div className="space-y-2">
          <h2
            id="timeline-alert-title"
            className="text-sm font-semibold leading-snug text-white"
          >
            {alert.title}
          </h2>
          <p
            id="timeline-alert-message"
            className="text-xs leading-relaxed text-gray-400"
          >
            {alert.message}
          </p>
        </div>

        {alert.campaignRef ? (
          <footer className="mt-3 border-t border-white/5 pt-2">
            <p className="truncate text-[10px] font-normal tracking-wide text-gray-600">
              {alert.campaignRef}
            </p>
          </footer>
        ) : null}
      </div>
    </aside>
  );
}
