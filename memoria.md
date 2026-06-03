# Futura Nota — Intel Calendar + Forecast + Launch radar (backup de sesión)

Documentación para re-aplicar el trabajo hecho en el panel Intel (tabs **Calendar**, **Forecast** y **Launch radar**), incluyendo `CalendarEventCanvas`, búsqueda de eventos, pill de fecha, inserción de nodos, y cadencia de lanzamientos por marca.

---

## 1. Arquitectura general


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
├── Tab "forecast"
│   ├── ForecastPanel (Daily Forecast, 1er día abierto)
│   └── ForecastSearchFooter (solo en forecast, NO en calendar)
│       └── busca clima del nodo activo → Insert node
│
└── Tab "launch-radar"
    └── LaunchPredictor (sin input del usuario)
        ├── lee marca: resolveCurrentCorpus() → brandName (campo brand o name del objeto corpus)
        ├── POST /api/analytics/brand-cadence → Groq o Gemini (JSON)
        ├── proyección: monthsRemaining = averageIntervalMonths − monthsSinceLast
        └── UI inglés: timeline Today ── X months left ── Est. launch + nota cadencia
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

---

## 10. Canvas + Timeline — Fases (visión producto)

> Documento de referencia para construir el timeline táctico sin ensuciar el canvas libre.
> Última actualización: sesión fases 0 / 1 / 2 + capa macro.

### 10.1 Principio rector

- **Canvas = libre** (Fase 0): conectar nodos para queries, search, relaciones doc↔doc. **No** implica añadir al timeline.
- **Timeline = minimalista**: solo entra lo que el usuario explícitamente selecciona / despliega por interacción.
- **Dos “carpetas” de comportamiento** (no tres modos de UI pesados):
  1. Canvas libre (default).
  2. Modo **“Inherit obj → obj”** (toggle): limita a dos familias de objeto, muestra nodo conector asimétrico, reglas cross-family.

### 10.2 Fase 0 — Canvas libre (estado actual + search)

| Qué | Detalle |
|-----|---------|
| Objetivo | Conectar todos los nodos; disparar queries/preguntas hacia search; relacionar documentos entre sí. |
| Timeline | **Sin relación**: conectar en canvas no añade nodos al timeline. |
| UI | Mantener canvas lo más minimalista posible. |

### 10.3 Fase 1 — Timeline intra-familia (misma familia / mismo objeto)

**Estructura por producto (familia):**

```
Producto N
  └── Docs de la misma familia se conectan entre sí (Type: Document)
  └── Hijos (bloques H1, text, date, etc.) pueden variar o conectarse “random” entre sí
```

**Ejemplo canvas actual:**

- `Product document` (Object Corpus 01) → conectado a:
  - `nuevo documento (h1)`
  - `otro documento (h1)`
  - `H1`

**Comportamiento timeline:**

| Interacción | Vista en timeline |
|-------------|-------------------|
| **1× click** en nodo doc (en cola/selección timeline) | Carril de **solo nodos Type: Document** de esa familia, ordenados en el **eje de tiempo** (pasado → presente → futuro). |
| **2× click** en doc | Drill-down: hijos del doc, p. ej. `[product] — [doc] — [launch date type]`, también ordenados por tiempo. |

**Reglas de tiempo:**

- El eje **siempre mide tiempo** (pasado | presente | futuro).
- Docs ordenados por fecha de ancla: **de mayor a menor** en el eje (ej. `doc 02 May 15` — `doc 01 May 20` si May 15 es más pasado que May 20 en la escala elegida; validar convención al implementar: izquierda = pasado, derecha = futuro).
- Click en un doc en timeline → segundo nivel muestra **sus nodos hijos** con el mismo criterio temporal.

**Capa MACRO (solo mismos tipos en el carril principal):**

```
[ Objeto 1 ] ───────────────────────────────────────► [ Objeto 2 ]
     │ (Tiene)                                              │ (Tiene)
     ▼                                                      ▼
[ Doc táctico O1 ] ═══ (link permitido mismo tipo) ═══► [ Doc táctico O2 ]
     │ (Abre hijos)                                        │ (Abre hijos)
     ▼                                                      ▼
 Hijos O1: H1, Date launch…                          Hijos O2: H1, Date slot vacío…
```

**Eje de tiempo (referencia visual):**

```
[EJE] ──► Pasado ──────────► Presente ──────────► Futuro (Launch)

CARRIL SUP (O1)   [latest news] — [campaign results] — [product update] — [launch date]
CARRIL INF (O2)              [product ideation doc] ——————————————— [empty date slot]
                                      │ cross-link vertical (herencia de timeframe)
                                      ▼
                            (slot vacío hereda tiempo del padre conectado)
```

### 10.4 Fase 2 — Cross-family (`Inherit obj → obj`)

**Regla clave (producto):** el **orden de creación** de objetos/docs **no define** el timeline. Puedes crear varias familias, meter docs en la cola en cualquier orden y guardar. Lo que importa es:

- **Set primario** = el eje de tiempo de referencia (familia cuyos docs ya están posicionados en el timeline).
- **Familia secundaria** = la que quieres **enganchar** al eje del primario mediante un wire doc↔doc cross-family.

La herencia de tiempo va **siempre primario → secundario**, no al revés ni por “quién se creó primero”.

**Resolución del primario en código (`timelinePrimary.js`):**

1. `primaryTimelineObjectId` explícito en store (elección del usuario).
2. Si no hay: `parentObjectId` del **primer doc en `timelineDocQueue`** (el set que ya estás construyendo en timeline).
3. Fallback: objeto con `role: corpus`.

**Activación:** toggle **“Inherit obj → obj”** en canvas (infografía/tooltip). Solo entonces:

- Se permiten **dos objetos distintos** en el mismo “modo”.
- **No** se muestran nodos de esquina a esquina de la otra familia en timeline (solo lo relevante al puente).
- Aparece **canvas node conector asimétrico** en el centro para unir **doc de familia A ↔ doc de familia B** (endpoint `---`).

**Timeline:**

- Objeto secundario en **layer debajo**, visualmente **cerca** del principal.
- **Un solo wire** por par doc↔doc cross-family (no dos wires duplicados al mismo doc).
- Al conectar doc padre (con date) ↔ doc hijo otra familia (date vacío): el vacío **hereda posición y tiempo en el timeline** del padre (segunda dimensión / carril inferior alineado).

```
[doc padre 1] — [date con dato]
       |
[doc padre 2] — [date empty]  → tras link, hereda timeframe del padre 1
```

### 10.5 Estado técnico actual (repo)

| Pieza | Estado |
|-------|--------|
| `panels.jsx` → `Timeline` | **`TacticalTimeline`** montado (multi-objeto, cola, click/doble-click) |
| `buildTimelineChains` (`timelineChains.js`) | Lógica de cadenas por objeto, `hasCrossObjectLink`, grid temporal — **no montada** en UI |
| `TimelineTrack` / chips en `panels.jsx` | Existe para blueprint tracks; patrón reutilizable |
| Canvas cola timeline | `timelineQueueMode`, selección en `App.jsx` + `canvas.jsx` |
| `resolveCanvasNodeObjectId` | `objectColors.js` — familia de objeto en nodos |
| Tag color por familia | Solo `.cnode-parent-tag` (no toda la tarjeta) |

### 10.6 Plan de implementación (orden recomendado)

#### Bloque A — Modelo de datos (sin UI pesada)

> **No es** el primer timeline visible de una familia (eso es Bloque B).  
> **No son** las dos “carpetas” de producto (canvas libre vs inherit) — esas son modos; A es la capa de código compartida.

**Mapa de archivos (Bloque A implementado / en curso):**

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/stores/timelineStore.js` | `primaryTimelineObjectId`, `inheritObjMode`, cola, foco |
| `src/types/timelineTactical.js` | JSDoc: `CanvasMode`, `TimelineFocus`, `ConnectionKind`, `ClassifiedConnection` |
| `src/lib/timelineGraph.js` | `classifyCanvasConnection`, `buildClassifiedConnections`, `crossFamilyDocPairKey`, dedup un wire cross-doc |
| `src/lib/timelinePrimary.js` | `resolvePrimaryTimelineObjectId`, primario vs secundario (sin orden de creación) |
| `src/lib/timelineAnchors.js` | Herencia **primario → secundario** en cross-family-doc |
| `src/lib/timelineChains.js` | `buildTimelineChains({ inheritObjMode })` consume anchors tácticos |
| `src/lib/objectColors.js` | `resolveCanvasNodeObjectId` (familia en nodo) |
| `src/lib/timelineSelection.js` | `resolveParentDocIdForCanvasNode` (doc padre de hijo) |
| `src/temporal.js` | `resolveNodeAnchorDate`, `buildWireAnchorMap` (base; sin reglas cross-family) |
| `src/hooks/useTacticalTimeline.js` | Selector: canvas + store → `{ chains, grid, classifiedConnections, mode }` (para Bloque B) |

**Flujo de datos:**

```
App / canvas.jsx  →  timelineStore (modo, foco, cola)
                 →  timelineGraph (clasificar wires)
                 →  timelineAnchors (fechas efectivas + inherit)
                 →  timelineChains (cadenas por objectId)
                 →  [Bloque B] TacticalTimeline en panels.jsx
```

**Estado Bloque A:** implementado (sin UI timeline — Bloque B pendiente).

**Piezas Bloque A:**

1. **`timelineViewState`** en `timelineStore.js`:
   - `getEffectiveCanvasMode()` → `'free' | 'queue' | 'inherit-obj'`
   - `timelineFocus`: `{ level: 'family' | 'doc' | 'children', objectId?, docId?, canvasNodeId? }`
   - `expandedDocIds`, `timelineDocQueue` (ya existía)
2. **`classifyCanvasConnection`** en `timelineGraph.js`
3. **`resolveTimelineAnchor`** + **`buildTacticalWireAnchorMap`** en `timelineAnchors.js`
4. **`inheritAnchorFromConnection`** — cross-family-doc + `inheritObjMode`; con `primaryTimelineObjectId` copia anchor **del primario al secundario** (si no hay primario explícito, fallback simétrico “quien tiene fecha gana”).

### 10.9 Primario vs secundario (no confundir con orden de creación)

| Concepto | Qué es | Qué NO es |
|----------|--------|-----------|
| Set primario | Familia cuyo timeline es el **eje** (docs ya en cola / posicionados) | El primer objeto creado en la app |
| Familia secundaria | Otra familia que conectas **al** eje del primario | Automáticamente “el segundo objeto” |
| Cola `timelineDocQueue` | Docs que tú añades en **cualquier orden** | Orden obligatorio de construcción |
| Color tag por familia | Índice visual en `.cnode-parent-tag` | No controla herencia temporal |

**Ejemplo:** Corpus 01 tiene docs en timeline. Creas Product Random (familia 2) después o antes — da igual. Activas inherit y conectas un doc de familia 2 a un doc de familia 1: el doc (y date vacío) de familia 2 se alinea al **tiempo del set primario**, no al orden en que creaste los objetos.

### 10.10 Multi-objeto, canvas ↔ timeline, mismos tipos, macronodos

**Varios objetos en timeline (sin inherit):** puedes tener N familias independientes, cada una con su fila/carril:

```
[obj 1 name] ─── [doc]
[obj 2 name] ─── [doc]
[obj 3 name] ─── [doc] ─── [doc]   ← doc→doc misma familia
```

El orden en que creaste obj 1/2/3 **no importa**. Cada uno es un **set de instrucciones** en el timeline.

**Elegir objeto del timeline → insertar en canvas:** al sacar un set al canvas deben **reaparecer los wires** que tenía ese subgraph (docs, hijos, doc→doc→date→metric). Canvas y timeline comparten el mismo grafo; el timeline solo **informa tiempo**.

**Función del timeline:** mostrar **cuándo** (fecha de creación del doc o **schedule** del macronodo / nodo date). No modifica el contenido de los documentos.

**Cadena intra-familia (canvas + tiempo):**

```
obj N:
  doc ─── doc ─── …
    │
    macronodos de ese doc (text, date, metric…) ordenados por schedule / anchor
```

Enlaces permitidos en la cadena temporal: **doc → doc → date → metric** (y hijos bajo el mismo doc).

**Regla mismo tipo (cross-family / inherit):** solo wires del **mismo dataType**:

| Permitido | No permitido (timeline inherit) |
|-----------|----------------------------------|
| doc ↔ doc | doc ↔ date |
| date ↔ date | date ↔ metric |

**Inherit obj 4 → obj 2 existente (ejemplo usuario):**

```
Timeline (obj 2 = padre del eje):

[obj 2 doc] ────────────────  ← carril / timeframe padre
      │
[obj 4 doc] ────────────────  ← inherit: misma posición temporal, contenido del doc intacto
```

- Conectas **doc obj4 ↔ doc obj2** (mismo tipo).
- Obj 4 **no cambia** sus documentos; solo **hereda el timeframe** (dónde cae en el eje) del punto al que conectaste (obj 2).
- Un solo wire por par doc↔doc cross-family.

**Código (Bloque A):**

- `resolveTimelineWireType`, `isAllowedCrossFamilyTimelineLink` → `timelineGraph.js`
- `cross-family-doc` | `cross-family-date` | `type-mismatch` en `classifyCanvasConnection`
- Herencia primario→secundario en `timelineAnchors.js` para doc y date cross-family

**Pendiente UI (Bloque B/D):**

- Filas multi-objeto en panel timeline.
- “Insertar set en canvas” con wires restaurados.
- Validación visual al conectar tipos distintos (rechazar doc→date cross-family).

**Estado Bloque B (en curso):** UI táctica en panel inferior — ver `TacticalTimeline.jsx`, `tacticalTimelineView.js`.

#### Bloque B — Fase 1 UI timeline

5. Componente **`TacticalTimeline`** (reemplazar placeholder en `panels.jsx`):
   - Eje pasado → futuro siempre visible.
   - Carril por `objectId` (o un carril si un solo objeto en foco).
   - Chips solo `dataType === 'document'` / `canvasKind === 'document'` en nivel 1.
6. **Click canvas (queue mode)** → añade doc a cola; **click chip timeline** → `focus.docId`, pintar hijos (text, date, launch) en sub-carril o fila indentada.
7. **Doble click chip doc** → drill-down H1 / bloques (`resolveHeadlineBlockIdForCanvasNode` en `timelineSelection.js`).
8. Ordenación: `sortByAnchorDate(asc)` — pasado izquierda, futuro derecha (documentar convención en UI).

#### Bloque C — Fase 0 explícito

9. Garantizar que en `mode === 'free'`, conexiones canvas **no** mutan timeline store (solo graph para search/intel).
10. Separar botón “Add to timeline” / queue del gesto de conectar.

#### Bloque D — Fase 2 `Inherit obj → obj`

11. Toggle en toolbar canvas + estado `inheritObjMode` en store.
12. Al activar: validar máx. 2 `objectId` en escena; ocultar en timeline nodos de familias no implicadas en el puente.
13. **`BridgeConnectorNode`** — tipo canvas `bridge` / `asymmetric`, posición central sugerida al crear primer link cross-family.
14. Regla **un wire** cross-doc: al crear segundo link mismo par, rechazar o fusionar.
15. Timeline: segundo carril (`layer: 'below'`), `linkedChainIds` de `buildTimelineChains` + conectores verticales SVG entre anchors heredados.
16. Herencia temporal: date vacío en carril inferior usa `wireAnchors.get(parentId)` del doc conectado upstream.

#### Bloque E — Pulido

17. Colores por familia en chips timeline (reusar `resolveParentTagFamilyStyle` / `resolveObjectStroke`).
18. Tests unitarios: ordenación fechas, herencia anchor, deduplicación cross-link.
19. Infografía toggle “Inherit obj → obj” (asset estático o tooltip rich).

### 10.7 Convenciones de nomenclatura

| Término | Significado |
|---------|-------------|
| Familia | `parentObjectId` en doc / `objectId` en nodo objeto |
| Doc táctico | Nodo canvas `canvasKind: document` (product/content, no knowledge corpus) |
| Hijo | Nodo text/date/checkbox con `parentDocId` vía entity |
| Wire | Conexión canvas `connections[]` |
| Herencia | Anchor temporal copiado cross-family (Fase 2) |

### 10.8 Fuera de alcance (por ahora)

- Timeline táctico FuturaTimelineCanvas (mock MACRO/DOC) — eliminado; no reutilizar.
- Añadir automáticamente todos los nodos conectados al timeline sin acción del usuario.
- Más de dos familias simultáneas en modo inherit (requiere desactivar toggle o reemplazar familia).

---

## 11. Launch radar — Cadencia de lanzamientos

Tab **Launch radar** en `IntelFoldersSection` (`panels.jsx`), entre Forecast y Market Hype. UI en **inglés**; card oscuro en `launch-predictor.css` (sin cambiar look al traducir).

### 11.1 Flujo

| Paso | Detalle |
|------|---------|
| Corpus | Objeto `role: corpus` (o corpus seleccionado). Marca = `brand` o `name`. |
| API | `POST /api/analytics/brand-cadence` body: `{ brandName, referenceMonthLabel }` |
| LLM | `server/llmJson.js` — Groq (`response_format: json_object`) o Gemini (`application/json`). Prompt en español en servidor; labels UI en inglés. |
| Sin API key | `mockCadenceForBrand()` determinista por hash del nombre (`source: "mock"`) |
| Matemática | `src/lib/launchCadenceMath.js` — `monthsBetween`, `computeLaunchCadenceProjection` |
| Vacío | Sin corpus/marca → empty state en inglés |

### 11.2 Archivos

| Archivo | Rol |
|---------|-----|
| `src/components/analytics/LaunchPredictor.jsx` | Componente Intel tab |
| `src/lib/currentCorpus.js` | `resolveCurrentCorpus` → `currentCorpus.brandName` |
| `src/lib/fetchBrandCadence.js` | Cliente `API_ROUTES.brandCadence` |
| `src/lib/launchCadenceMath.js` | Meses restantes + labels `en-US` |
| `src/styles/launch-predictor.css` | Card timeline (gradiente oscuro) |
| `server/brandCadenceHandler.js` | Middleware Vite |
| `server/llmJson.js` | `completeJson()` |
| `vite.config.js` | Plugin `brandCadenceApiPlugin` + `loadEnv` → `process.env` |
| `src/api/routes.js` | `brandCadence: "/api/analytics/brand-cadence"` |

### 11.3 Cableado `panels.jsx`

```jsx
import { LaunchPredictor } from './components/analytics/LaunchPredictor.jsx';

{folder === "launch-radar" && (
  <LaunchPredictor today={today} />
)}
```

### 11.4 `.env.local` (desarrollo)

**Sí, conviene integrarlo** si quieres inferencia real (no mock):

1. Copiar `.env.example` → `.env.local` en la raíz del repo.
2. Definir **una** clave: `GROQ_API_KEY` **o** `GEMINI_API_KEY` / `GOOGLE_API_KEY`.
3. Reiniciar `npm run dev` (Vite carga `.env.local` vía `loadEnv` y la inyecta al middleware).

Sin `.env.local` el módulo **sigue funcionando** con datos mock en dev.

**Producción:** el middleware solo existe en el dev server de Vite; despliegue estático (`vite build`) no expone `/api/analytics/brand-cadence` hasta montar el mismo handler en un backend.

### 11.5 Nota UI (inglés)

> This company typically launches products every **N** months. They will likely launch their next product within the next **X** month(s). Announcements usually begin about three months before.

Timeline: `[ Today: June 2026 ] ── X months left ── [ Est. launch: Month Year ]`

---

## 12. Product packs — import / export (`.zip`)

Intercambio de modelos (brand → products → content) sin backend. **Knowledge no va en el pack** (sigue en app con + new → Knowledge + archivo local).

### 12.1 Archivo ZIP

```
mi-marca.zip
├── README.txt
├── manifest.json   — nombre, brand, counts
├── model.json      — objects, docs, nodes
└── graph.json      — opcional (canvas)
```

- Export: objeto abierto → Documents → **Export pack** → descarga `.zip`.
- Edición local: descomprimir, editar `model.json` (products/content), volver a comprimir o re-exportar.
- Import: **Import pack** → wizard (acepta `.zip`; legacy `.fnota` / JSON monolito).

### 12.2 Librería

| Archivo | Rol |
|---------|-----|
| `src/lib/pack/packZip.js` | JSZip: `packToZipBlob`, `parseZipPack` |
| `src/lib/pack/packSchema.js` | Versión esquema, parse/validate |
| `src/lib/pack/packCollect.js` | Recorte por `objectId` (sin knowledge) |
| `src/lib/pack/packRemap.js` | Remap IDs al importar |
| `src/lib/pack/packExport.js` | `exportObjectPack`, `downloadPackFile` |
| `src/lib/pack/packImport.js` | `readPackFile`, `stripKnowledgeFromPack`, `applyPackImport` |

### 12.3 Modos de import

- **New object** — crea objeto (satellite si ya hay corpus).
- **Merge into current** — añade docs/nodos al objeto filtrado.

### 12.4 Contenido

- Solo **Products** + **Content** del objeto exportado.
- **Canvas** opcional (`includeGraph: false` por defecto).

### 12.5 Starter

Wizard → “Download empty starter model” → `.zip` con 1 product + 1 content.
