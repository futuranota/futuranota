import { useMemo } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { resolveTimelineAlertsList } from "../../lib/resolveTimelineAlert.js";
import { TimelineAlertToast } from "../alerts/TimelineAlertToast.tsx";

export function TimelineAlertsModal({
  open,
  onClose,
  docs = {},
  objects = {},
  objectTimelineTitles = {},
  selectedObjectId = null,
  canvasNodes = [],
  timelineDocQueue = [],
  timelineDocSnapshotsByDocId = {},
  timelineAgentSets = [],
}) {
  const { t } = useI18n();

  const alerts = useMemo(
    () => resolveTimelineAlertsList({
      docs,
      objects,
      objectTimelineTitles,
      selectedObjectId,
      canvasNodes,
      timelineDocQueue,
      timelineDocSnapshotsByDocId,
      timelineAgentSets,
    }),
    [
      docs,
      objects,
      objectTimelineTitles,
      selectedObjectId,
      canvasNodes,
      timelineDocQueue,
      timelineDocSnapshotsByDocId,
      timelineAgentSets,
    ],
  );

  if (!open) return null;

  const activeAlert = alerts.find((entry) => entry.alert) || null;

  return (
    <div
      className="tl-alerts-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="tl-alerts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-alerts-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tl-alerts-modal__head">
          <h2 id="tl-alerts-modal-title" className="tl-alerts-modal__title">
            {t("timeline.alertsModalTitle")}
          </h2>
          <button
            type="button"
            className="tl-alerts-modal__close"
            onClick={onClose}
            aria-label={t("common.cancel")}
          >
            ×
          </button>
        </header>

        {activeAlert ? (
          <div className="tl-alerts-modal__featured">
            <TimelineAlertToast
              alert={activeAlert.alert}
              className="tl-alerts-modal__toast !static !w-full !shadow-none"
            />
          </div>
        ) : null}

        <div className="tl-alerts-modal__body">
          {alerts.length === 0 ? (
            <p className="tl-alerts-modal__empty mute">{t("timeline.alertsModalEmpty")}</p>
          ) : (
            <ul className="tl-alerts-modal__list">
              {alerts.map((entry) => (
                <li
                  key={entry.key}
                  className={
                    "tl-alerts-modal__item"
                    + (entry.alert ? " is-active" : "")
                  }
                >
                  <span className="tl-alerts-modal__item-kind">{entry.kindLabel}</span>
                  <span className="tl-alerts-modal__item-label">{entry.label}</span>
                  <span className="tl-alerts-modal__item-days tnum">
                    {entry.daysRemaining >= 0
                      ? t("timeline.alertsDaysRemaining", { count: entry.daysRemaining })
                      : t("timeline.alertsPast")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="tl-alerts-modal__hint mute">{t("timeline.alertsModalHint")}</p>
      </div>
    </div>
  );
}
