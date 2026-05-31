# Futura Nota — Intel Calendar + Forecast (backup de sesión)

Documentación para re-aplicar el trabajo hecho en el panel Intel (tabs **Calendar** y **Forecast**), incluyendo `CalendarEventCanvas`, búsqueda de eventos, pill de fecha, e inserción de nodos.

---

## 1. Arquitectura general

```
IntelFoldersSection (panels.jsx)
├── Tab "calendar"
│   └── CalendarPanel
│       ├── IntelFolderAccordion (grid calendario, colapsado por defecto)
│       └── CalendarEventCanvas (visible solo si acordeón cerrado)
│           ├── empty → UI Figma + pill búsqueda
│           ├── loading → spinner
│           ├── result → CalendarEventResultBox + Insert node
│           └── noEvent/error → mensaje
│
└── Tab "forecast"
    ├── ForecastPanel (Daily Forecast, 1er día abierto)
    └── ForecastSearchFooter (solo en forecast, NO en calendar)
        └── busca clima del nodo activo → Insert node
```

**Nodo activo compartido** (Calendar y Forecast):

- `resolveActiveForecastNode()` en `src/lib/forecastSearch.js`
- Prioridad: nodo expandido → selección canvas → doc/nota

**Fecha del nodo**:

- `resolveForecastTargetDate()` → `anchorAt` (schedule) o `createdAt`
- UI: `formatForecastUiDate()` → `mm/dd`

---

## 2. Archivos nuevos (crear desde cero)

| Archivo | Rol |
|---|---|
| `src/components/intel/CalendarEventCanvas.jsx` | Canvas 200px, estados empty/loading/result |
| `src/components/intel/CalendarEventResultBox.jsx` | Caja resultado + botón Insert |
| `src/lib/eventCalendarSearch.js` | Fetch mock eventos + payload nodo |
| `src/data/eventCalendarMock.js` | Mock eventos por offset desde `today` |

---

## 3. Código — archivos nuevos

### `src/data/eventCalendarMock.js`

```javascript
/**
 * Mock calendar events keyed by schedule date.
 * Replace getEventsForDate with GET /api/events?date=YYYY-MM-DD when backend exists.
 */
import { daysBetween } from "../data.jsx";
import { startOfCalendarDay } from "../temporal.js";

/** @typedef {{ id: string, title: string, summary: string, date: string, dateEnd?: string|null, source: string, type: string }} CalendarEvent */

/** @type {{ dayOffset: number, dayEndOffset?: number, event: Omit<CalendarEvent, "date"|"dateEnd"> }[]} */
const EVENT_TEMPLATES = [
  {
    dayOffset: 0,
    event: {
      id: "evt-launch-brief",
      title: "Product launch briefing",
      summary: "Internal sync on launch timeline, messaging, and press embargo.",
      source: "Campaign calendar",
      type: "internal",
    },
  },
  {
    dayOffset: 3,
    event: {
      id: "evt-media-window",
      title: "Media preview window",
      summary: "Invited outlets receive embargoed assets and talking points.",
      source: "PR schedule",
      type: "media",
    },
  },
  {
    dayOffset: 7,
    dayEndOffset: 9,
    event: {
      id: "evt-industry-summit",
      title: "Industry summit",
      summary: "Keynote slot and partner meetings across a three-day window.",
      source: "Events DB",
      type: "conference",
    },
  },
];

function toIsoDate(date) {
  const day = startOfCalendarDay(date);
  if (!day) return "";
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * @param {Date|null|undefined} targetDate
 * @param {Date} [baseToday]
 * @returns {CalendarEvent[]}
 */
export function getEventsForDate(targetDate, baseToday = new Date()) {
  const target = startOfCalendarDay(targetDate);
  const base = startOfCalendarDay(baseToday);
  if (!target || !base) return [];

  const diff = daysBetween(base, target);
  const results = [];

  EVENT_TEMPLATES.forEach((template) => {
    const startDiff = template.dayOffset;
    const endDiff = template.dayEndOffset ?? template.dayOffset;
    if (diff < startDiff || diff > endDiff) return;

    const eventDate = new Date(base);
    eventDate.setDate(eventDate.getDate() + startDiff);

    let eventDateEnd = null;
    if (template.dayEndOffset != null && template.dayEndOffset !== template.dayOffset) {
      eventDateEnd = new Date(base);
      eventDateEnd.setDate(eventDateEnd.getDate() + template.dayEndOffset);
    }

    results.push({
      ...template.event,
      date: toIsoDate(eventDate),
      dateEnd: eventDateEnd ? toIsoDate(eventDateEnd) : null,
    });
  });

  return results;
}
```

### `src/lib/eventCalendarSearch.js`

```javascript
/**
 * Resolve schedule date from node and fetch calendar events for that day/range.
 * Replace fetchEventsForNode mock body with GET /api/events?date=YYYY-MM-DD.
 */
import { getEventsForDate } from "../data/eventCalendarMock.js";
import {
  formatForecastUiDate,
  resolveForecastTargetDate,
} from "./forecastSearch.js";
import { formatScheduleLabelFromIso } from "./nodeAnchor.js";

export const EVENT_MESSAGES = {
  noNode: "Select a node to search events",
  noDate: "No schedule date on selected node",
  empty: "No events for this date",
};

/**
 * @param {object|null} node
 */
export function resolveScheduleDate(node) {
  return resolveForecastTargetDate(node);
}

/**
 * @param {object|null} node
 * @param {Date} [baseToday]
 */
export async function fetchEventsForNode(node, baseToday = new Date()) {
  if (!node) {
    return {
      status: "noNode",
      message: EVENT_MESSAGES.noNode,
    };
  }

  const { date, resolvedFrom, scheduleIso } = resolveScheduleDate(node);
  if (!date) {
    return {
      status: "noDate",
      message: EVENT_MESSAGES.noDate,
      node,
    };
  }

  await new Promise((r) => setTimeout(r, 400));

  const events = getEventsForDate(date, baseToday);
  const uiDate = formatForecastUiDate(date);
  const sourceLabel = resolvedFrom === "schedule"
    ? (formatScheduleLabelFromIso(scheduleIso) || `schedule: ${uiDate}`)
    : `created: ${uiDate}`;

  if (!events.length) {
    return {
      status: "empty",
      message: EVENT_MESSAGES.empty,
      uiDate,
      sourceLabel,
      targetDate: date,
      scheduleIso,
      resolvedFrom,
      node,
    };
  }

  return {
    status: "success",
    uiDate,
    sourceLabel,
    targetDate: date,
    scheduleIso,
    resolvedFrom,
    node,
    event: events[0],
    events,
  };
}

/**
 * @param {object} fetchResult
 */
export function buildEventNodePayload(fetchResult) {
  const event = fetchResult.event;
  return {
    kind: "calendar-event",
    scheduleLabel: fetchResult.sourceLabel,
    scheduleIso: fetchResult.scheduleIso || null,
    resolvedFrom: fetchResult.resolvedFrom,
    uiDate: fetchResult.uiDate,
    eventId: event?.id || null,
    title: event?.title || null,
    summary: event?.summary || null,
    date: event?.date || null,
    dateEnd: event?.dateEnd || null,
    source: event?.source || null,
    type: event?.type || null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} fetchResult
 */
export function buildEventNodeTitle(fetchResult) {
  const title = fetchResult.event?.title;
  return title ? `Event · ${title}` : `Event · ${fetchResult.uiDate || "—"}`;
}
```

### `src/components/intel/CalendarEventResultBox.jsx`

```jsx
export function CalendarEventResultBox({ result, onInsert }) {
  const event = result?.event;
  if (!event) return null;

  const rangeLabel = event.dateEnd && event.dateEnd !== event.date
    ? `${event.date} → ${event.dateEnd}`
    : event.date;

  return (
    <div className="cal-event-result" role="status">
      <div className="cal-event-result__meta">
        <span className="cal-event-result__date tnum">{result.uiDate}</span>
        <span className="cal-event-result__source">{result.sourceLabel}</span>
      </div>
      <div className="cal-event-result__body">
        <h4 className="cal-event-result__title">{event.title}</h4>
        <p className="cal-event-result__range tnum mono">{rangeLabel}</p>
        <p className="cal-event-result__summary">{event.summary}</p>
        {event.source ? (
          <p className="cal-event-result__source-name">{event.source}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="cal-event-result__insert btn xs"
        onClick={onInsert}
      >
        Insert node
      </button>
    </div>
  );
}
```

### `src/components/intel/CalendarEventCanvas.jsx`

```jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildEventNodePayload,
  buildEventNodeTitle,
  fetchEventsForNode,
} from "../../lib/eventCalendarSearch.js";
import {
  formatForecastUiDate,
  resolveForecastTargetDate,
} from "../../lib/forecastSearch.js";
import { CalendarEventResultBox } from "./CalendarEventResultBox.jsx";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";

const CALENDAR_EVENT_ILLUSTRATION = "/uploads/botones/e-c.svg";

function SearchIcon({ className = "", size = 14 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden
    >
      <circle
        cx="4.25"
        cy="4.25"
        r="2.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M6.2 6.2L8.5 8.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Empty event-calendar canvas — visible while calendar accordion is collapsed. */
export function CalendarEventCanvas({
  activeNode,
  today = new Date(),
  onInsertEventNode,
}) {
  const [phase, setPhase] = useState("empty");
  const [result, setResult] = useState(null);

  const targetKey = useMemo(() => {
    if (!activeNode) return "";
    const { date, scheduleIso } = resolveForecastTargetDate(activeNode);
    return `${activeNode.id}:${scheduleIso || ""}:${date?.getTime() || ""}`;
  }, [activeNode]);

  useEffect(() => {
    setPhase("empty");
    setResult(null);
  }, [targetKey]);

  const targetDate = activeNode ? resolveForecastTargetDate(activeNode).date : null;
  const pillDate = targetDate ? formatForecastUiDate(targetDate) : "";
  const canSearch = Boolean(activeNode && targetDate);

  const handleSearch = useCallback(async () => {
    if (!canSearch || phase === "loading") return;

    setPhase("loading");
    const next = await fetchEventsForNode(activeNode, today);
    setResult(next);

    if (next.status === "success") {
      setPhase("result");
    } else if (next.status === "empty") {
      setPhase("noEvent");
    } else {
      setPhase("error");
    }
  }, [activeNode, canSearch, phase, today]);

  const handleInsert = () => {
    if (!result || result.status !== "success" || !onInsertEventNode) return;
    onInsertEventNode({
      title: buildEventNodeTitle(result),
      payload: buildEventNodePayload(result),
      sourceNode: result.node,
      anchorAt: result.scheduleIso || null,
    });
  };

  if (phase === "result" && result?.status === "success") {
    return (
      <div className="cal-event-canvas cal-event-canvas--result" aria-label="Event calendar result">
        <CalendarEventResultBox result={result} onInsert={handleInsert} />
      </div>
    );
  }

  if (phase === "noEvent" || phase === "error") {
    return (
      <div className="cal-event-canvas cal-event-canvas--result" aria-label="Event calendar">
        <div className="cal-event-result cal-event-result--message" role="status">
          <p className="cal-event-result__message">{result?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cal-event-canvas" aria-label="Event calendar">
      <img
        src={CALENDAR_EVENT_ILLUSTRATION}
        alt=""
        className="cal-event-canvas__illustration"
        aria-hidden
      />
      <p className="cal-event-canvas__title">Event calendar</p>
      <p className="cal-event-canvas__hint">
        <svg className="cal-event-canvas__info" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M6 5.1V8.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <circle cx="6" cy="3.4" r="0.65" fill="currentColor" />
        </svg>
        What&apos;s an event calendar
      </p>
      <p className="cal-event-canvas__tagline">
        Anticipate Every Opportunity: The Ultimate Calendar for Brands That Make a Difference
      </p>

      <button
        type="button"
        className={
          "cal-event-canvas__search-pill"
          + (phase === "loading" ? " is-loading" : "")
          + (pillDate ? " has-date" : "")
        }
        onClick={handleSearch}
        disabled={!canSearch || phase === "loading"}
        aria-busy={phase === "loading"}
        aria-label={
          phase === "loading"
            ? "Searching events"
            : "Search events for schedule date"
        }
      >
        {phase === "loading" ? (
          <SearchSpinner size={14} />
        ) : (
          <>
            <span
              className={
                "cal-event-canvas__date tnum"
                + (pillDate ? "" : " cal-event-canvas__date--placeholder")
              }
            >
              {pillDate || "month/day"}
            </span>
            {!pillDate ? (
              <SearchIcon className="cal-event-canvas__search-icon" size={14} />
            ) : null}
          </>
        )}
      </button>
    </div>
  );
}
```

#### Comportamiento del pill (versión final)

| Estado | Texto | Icono lupa |
|---|---|---|
| Sin nodo | `month/day` (placeholder tenue) | Sí, derecha, 14px, padding-right 5px |
| Nodo seleccionado | `mm/dd` centrado | No (desaparece) |
| Loading | Spinner | — |

---

## 4. Archivos modificados

### `src/components/intel/CalendarPanel.jsx`

Cambios clave:

- Importa `CalendarEventCanvas`, `resolveActiveForecastNode`
- Props nuevas: `nodeEntities`, `docsById`, `expandedNodeId`, `selection`, `canvasNodes`, `onInsertEventNode`
- Acordeón **cerrado por defecto** (`defaultOpen={false}`)
- Muestra `CalendarEventCanvas` solo cuando `!accordionOpen`
- Resuelve `activeNode` con `resolveActiveForecastNode(...)`

```jsx
const activeNode = resolveActiveForecastNode(
  nodeEntities,
  { expandedNodeId, selection, canvasNodes },
  docsById,
);

{!accordionOpen ? (
  <CalendarEventCanvas
    activeNode={activeNode}
    today={today}
    onInsertEventNode={onInsertEventNode}
  />
) : null}
```

### `src/panels.jsx` — `IntelFoldersSection`

**Imports añadir:**

```javascript
import { ForecastSearchFooter } from './components/intel/ForecastSearchFooter.jsx';
```

**Props nuevas:**

```javascript
onInsertForecastNode,
onInsertEventNode,
nodeEntities = {},
docsById = {},
expandedNodeId = null,
selection = [],
canvasNodes = [],
```

**Panel calendar + forecast search:**

```jsx
const showForecastSearch = folder === "forecast";

<div
  className={
    "intel-folder-panel"
    + (folder === "calendar" ? " intel-folder-panel--calendar" : "")
    + (folder === "forecast" ? " intel-folder-panel--forecast" : "")
    + (showForecastSearch ? " intel-folder-panel--with-search" : "")
  }
>
  {folder === "calendar" && (
    <CalendarPanel
      today={today}
      launchDate={launchDate}
      onSelectDate={onSelectDate}
      scheduleHint={scheduleHint}
      nodeEntities={nodeEntities}
      docsById={docsById}
      expandedNodeId={expandedNodeId}
      selection={selection}
      canvasNodes={canvasNodes}
      onInsertEventNode={onInsertEventNode}
    />
  )}
  {folder === "forecast" && <ForecastPanel today={today} />}
  {showForecastSearch ? (
    <ForecastSearchFooter
      nodeEntities={nodeEntities}
      docsById={docsById}
      expandedNodeId={expandedNodeId}
      selection={selection}
      canvasNodes={canvasNodes}
      onInsertForecastNode={onInsertForecastNode}
    />
  ) : null}
</div>
```

**Importante:** `ForecastSearchFooter` solo en tab forecast, **no** en calendar.

### `src/App.jsx`

```javascript
const handleInsertForecastNode = ({ title, payload, sourceNode, anchorAt }) => {
  const addNode = useNodesStore.getState().addNode;
  const nodeId = addNode(
    title,
    "text",
    JSON.stringify(payload),
    sourceNode?.parentDocId || null,
    {
      anchorAt: anchorAt || null,
      sourceQuery: title,
    },
  );
  const created = useNodesStore.getState().getNode(nodeId);
  if (created) insertNodeToCanvas(created, { center: true });
};

const handleInsertEventNode = ({ title, payload, sourceNode, anchorAt }) => {
  const addNode = useNodesStore.getState().addNode;
  const nodeId = addNode(
    title,
    "text",
    JSON.stringify(payload),
    sourceNode?.parentDocId || null,
    {
      anchorAt: anchorAt || null,
      sourceQuery: title,
    },
  );
  const created = useNodesStore.getState().getNode(nodeId);
  if (created) insertNodeToCanvas(created, { center: true });
};

// Pasar al panel intel:
onInsertForecastNode={handleInsertForecastNode}
onInsertEventNode={handleInsertEventNode}
```

### `src/components/intel/ForecastPanel.jsx`

Primer día del acordeón abierto por defecto:

```jsx
{forecast.days.map((day, i) => (
  <ForecastDayAccordion key={day.id} day={day} defaultOpen={i === 0} />
))}
```

### `src/components/intel/ForecastSearchFooter.jsx`

Busca clima del nodo activo:

- `fetchForecastForNode(node)` → mock 400ms
- Resultado success → meta + icono + temps + Insert node
- Payload: `kind: "weather-forecast"` via `buildForecastNodePayload`
- Botón: imagen `/uploads/botones/search-active.svg`

Archivo completo en: `src/components/intel/ForecastSearchFooter.jsx`

---

## 5. CSS — pegar en `src/styles.css`

### Panel intel

```css
.intel-folder-panel {
  min-height: 200px;
}
.intel-folder-panel--calendar {
  min-height: 200px;
}
.intel-folder-panel--forecast {
  max-height: min(320px, 42vh);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #2b323d #0b0e12;
}
.intel-folder-panel--forecast::-webkit-scrollbar {
  width: 5px;
}
.intel-folder-panel--forecast::-webkit-scrollbar-track {
  background: #0b0e12;
  border-radius: 5px;
}
.intel-folder-panel--forecast::-webkit-scrollbar-thumb {
  background: #2b323d;
  border-radius: 5px;
}
.intel-folder-panel--with-search {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.intel-folder-panel--with-search.intel-folder-panel--forecast {
  max-height: min(420px, 52vh);
}
```

### Forecast search footer

```css
.forecast-search-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--hairline);
}
.forecast-search-footer__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
  opacity: 0.92;
  transition: opacity 120ms ease, transform 120ms ease;
}
.forecast-search-footer__btn:hover {
  opacity: 1;
}
.forecast-search-footer__btn.is-loading {
  width: 57px;
  height: 21px;
  cursor: wait;
}
.forecast-search-footer__icon {
  display: block;
  width: 57px;
  height: 21px;
}
.forecast-search-result {
  margin-top: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
}
.forecast-search-result__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 8px;
  font-size: 10px;
  color: var(--text-2);
}
.forecast-search-result__date {
  font-weight: 700;
  color: var(--warm);
}
.forecast-search-result__source {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.forecast-search-result__body {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.forecast-search-result__copy {
  flex: 1;
  min-width: 0;
}
.forecast-search-result__headline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}
.forecast-search-result__temps {
  white-space: nowrap;
}
.forecast-search-result__summary {
  margin: 0 0 6px;
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-2);
}
.forecast-search-result__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 9px;
  color: var(--text-2);
  margin-bottom: 6px;
}
.forecast-search-result__stats span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.forecast-search-result__disclaimer {
  margin: 0;
  font-size: 8.5px;
  color: var(--mute);
  font-style: italic;
}
.forecast-search-result__insert {
  margin-top: 10px;
}
.forecast-search-result__message {
  margin: 0;
  font-size: 11px;
  color: var(--text-2);
}
```

### Calendar event canvas

```css
.cal-event-canvas {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  min-height: 200px;
  height: 200px;
  padding: 10px 12px 12px;
  gap: 5px;
  text-align: center;
  overflow: hidden;
}
.cal-event-canvas__illustration {
  position: relative;
  z-index: 0;
  display: block;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  margin: 0 0 2px;
  object-fit: contain;
  pointer-events: none;
}
.cal-event-canvas--result {
  position: static;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  height: auto;
  min-height: 120px;
  overflow: visible;
}
.cal-event-canvas__search-pill {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  min-width: 108px;
  height: 28px;
  padding: 0 5px 0 16px;
  margin-top: 4px;
  border: none;
  border-radius: 3px;
  background: rgba(38, 70, 83, 0.6);
  cursor: pointer;
  line-height: 0;
  transition: opacity 120ms ease, transform 120ms ease;
}
.cal-event-canvas__search-pill.has-date {
  justify-content: center;
  padding: 0 16px;
}
.cal-event-canvas__search-pill.has-date .cal-event-canvas__date {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.cal-event-canvas__search-pill:hover:not(:disabled) {
  opacity: 1;
  transform: translateY(-1px);
}
.cal-event-canvas__search-pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.cal-event-canvas__search-pill.is-loading {
  cursor: wait;
}
.cal-event-canvas__date {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #e8eaef;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.cal-event-canvas__date--placeholder {
  font-weight: 500;
  color: rgba(232, 234, 239, 0.55);
}
.cal-event-canvas__search-icon {
  display: block;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: #ffffff;
}
.cal-event-canvas__title {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 20px;
  font-weight: 400;
  line-height: 1.15;
  color: #ffffff;
}
.cal-event-canvas__hint {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
  color: #9fa1a6;
}
.cal-event-canvas__tagline {
  position: relative;
  z-index: 1;
  margin: 0;
  max-width: 240px;
  font-size: 9px;
  font-weight: 400;
  line-height: 1.35;
  color: #9fa1a6;
}
.cal-event-canvas__info {
  flex-shrink: 0;
  color: #9fa1a6;
}
.cal-event-result {
  width: 100%;
  padding: 10px;
  text-align: left;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
}
.cal-event-result--message {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
}
.cal-event-result__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 8px;
  font-size: 10px;
  color: var(--text-2);
}
.cal-event-result__date {
  font-weight: 700;
  color: var(--warm);
}
.cal-event-result__source {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cal-event-result__body {
  min-width: 0;
}
.cal-event-result__title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.cal-event-result__range {
  margin: 0 0 6px;
  font-size: 9.5px;
  color: #299d90;
}
.cal-event-result__summary {
  margin: 0 0 6px;
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-2);
}
.cal-event-result__source-name {
  margin: 0;
  font-size: 9px;
  color: var(--mute);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cal-event-result__insert {
  margin-top: 10px;
}
.cal-event-result__message {
  margin: 0;
  font-size: 11px;
  color: var(--text-2);
  text-align: center;
}
```

---

## 6. Assets

| Ruta | Uso |
|---|---|
| `/uploads/botones/e-c.svg` | Ilustración canvas calendar (52×52) |
| `/uploads/botones/search-active.svg` | Botón búsqueda Forecast footer |
| `/uploads/botones/calendar-events.svg` | Probado antes; no usado en versión final |

---

## 7. Flujos de estado

### CalendarEventCanvas

```
targetKey cambia (nodo/selección)
  → phase = "empty", result = null

Click pill (canSearch)
  → loading → fetchEventsForNode
      success  → CalendarEventResultBox
      empty    → "No events for this date"
      error    → mensaje error
```

### ForecastSearchFooter

```
Click search icon
  → loading → fetchForecastForNode
      success  → resultado + Insert node (kind: weather-forecast)
      unavailable → mensaje (past/future/no data)
```

---

## 8. Tokens Figma (empty state)

| Elemento | Estilo |
|---|---|
| Título "Event calendar" | 20px, blanco, serif |
| Hint + ⓘ | 11px bold, `#9fa1a6` |
| Tagline | 9px, `#9fa1a6`, max 240px |
| Pill fondo | `rgba(38, 70, 83, 0.6)` |
| Canvas | 200×200px fijo |

---

## 9. Orden recomendado al re-aplicar tras revert

1. Crear `eventCalendarMock.js` + `eventCalendarSearch.js`
2. Crear `CalendarEventResultBox.jsx` + `CalendarEventCanvas.jsx`
3. Actualizar `CalendarPanel.jsx`
4. Actualizar `ForecastPanel.jsx` (`defaultOpen={i === 0}`)
5. Verificar `ForecastSearchFooter.jsx` existe
6. Cablear `panels.jsx` + `App.jsx`
7. Pegar CSS blocks
8. Confirmar asset `e-c.svg` en `public/uploads/botones/`
