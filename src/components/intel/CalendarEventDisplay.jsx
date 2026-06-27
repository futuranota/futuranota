/**
 * Structured, typographic calendar brief — intro + season sections + event rows.
 */
export function CalendarEventDisplay({ model, className = "" }) {
  if (!model) return null;

  const hasIntro = Boolean(model.intro?.trim());
  const sections = Array.isArray(model.sections) ? model.sections : [];
  if (!hasIntro && !sections.length) return null;

  return (
    <article className={`cal-event-display${className ? ` ${className}` : ""}`}>
      {hasIntro ? (
        <p className="cal-event-display__intro">{model.intro}</p>
      ) : null}

      {sections.map((section) => (
        <section
          key={section.season || section.events[0]?.name}
          className="cal-event-display__season-block"
        >
          {section.season ? (
            <h3 className="cal-event-display__season">{section.season}</h3>
          ) : null}
          <ul className="cal-event-display__list">
            {section.events.map((event) => (
              <li
                key={`${event.name}-${event.date}`}
                className="cal-event-display__item"
              >
                <span className="cal-event-display__name">{event.name}</span>
                {event.date ? (
                  <time className="cal-event-display__date tnum" dateTime="">
                    {event.date}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
