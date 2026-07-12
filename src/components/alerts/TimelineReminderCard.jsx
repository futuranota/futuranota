import {
  Card,
  CardContent,
  CardFooter,
} from "../ui/card.jsx";
import { useI18n } from "../../i18n/useI18n.js";
import "../../styles/timeline-alert-tailwind.css";

const CONTENT_WRITER_ICON = "/uploads/content-writer.svg";

/**
 * Floating timeline reminder — testimonial Card shell.
 * @param {object} props
 * @param {import("../../types/timelineAlert").TimelineReminderData} props.reminder
 * @param {() => void} [props.onGotIt]
 * @param {() => void} [props.onSkip]
 */
export function TimelineReminderCard({ reminder, onGotIt, onSkip }) {
  const { t } = useI18n();
  if (!reminder) return null;

  const greeting = t("timeline.reminder.greeting", {
    workspace: reminder.workspaceLabel,
  });

  const bodyKey = reminder.minutesRemaining === 1
    ? "timeline.reminder.bodyOne"
    : "timeline.reminder.bodyMany";

  const body = t(bodyKey, {
    name: reminder.contentLabel,
    count: reminder.minutesRemaining,
  });

  return (
    <aside
      className="tl-reminder-card-wrap timeline-alert-enter"
      role="alertdialog"
      aria-labelledby="tl-reminder-title"
      aria-describedby="tl-reminder-body"
    >
      <Card className="tl-reminder-card">
        <CardContent className="tl-reminder-card__content">
          <p className="tl-reminder-card__field-label">
            {t("timeline.reminder.sectionLabel")}
          </p>
          <p id="tl-reminder-title" className="tl-reminder-card__greeting">
            {greeting}
          </p>
          <p id="tl-reminder-body" className="tl-reminder-card__headline">
            {body}
          </p>
        </CardContent>

        <CardFooter className="tl-reminder-card__footer">
          <div className="tl-reminder-card__identity">
            <img
              src={CONTENT_WRITER_ICON}
              alt=""
              className="tl-reminder-card__icon"
              width={40}
              height={40}
              aria-hidden
              draggable={false}
            />
            <div className="tl-reminder-card__identity-text">
              <span className="tl-reminder-card__name">
                {reminder.contentLabel}
              </span>
              <span className="tl-reminder-card__handle">
                {t("timeline.reminder.counter", {
                  count: reminder.minutesRemaining,
                  time: reminder.startTimeLabel,
                })}
              </span>
            </div>
          </div>

          <div className="tl-reminder-card__actions">
            <button
              type="button"
              className="tl-reminder-card__skip"
              onClick={onSkip}
            >
              {t("timeline.reminder.skip")}
            </button>
            <button
              type="button"
              className="btn tl-reminder-card__okay"
              onClick={onGotIt}
            >
              {t("timeline.reminder.okay")}
            </button>
          </div>
        </CardFooter>
      </Card>
    </aside>
  );
}
