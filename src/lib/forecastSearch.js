/**
 * Resolve forecast target from node schedule/created and fetch mock weather.
 * Replace fetchForecastForNode mock body with GET /api/weather/forecast?date=YYYY-MM-DD.
 */
import { daysBetween } from "../data.jsx";
import { FORECAST_MOCK_HORIZON_DAYS } from "../data/forecastMock.js";
import { formatScheduleLabelFromIso } from "./nodeAnchor.js";
import { parseDate, startOfCalendarDay } from "../temporal.js";
import { API_ROUTES } from "../api/routes.js";
import { supabase } from "./supabaseClient.js";
import { buildWeatherLocationQuery } from "./weatherLocation.js";
import { WEATHER_ERROR_LOCATION_NOT_FOUND } from "./weatherErrors.js";

/** OpenWeather 2.5 /forecast covers up to ~5 days (3-hour steps). */
export const FORECAST_HORIZON_DAYS = Math.min(FORECAST_MOCK_HORIZON_DAYS, 6);

export const FORECAST_MESSAGES = {
  noNode: "Select a node to fetch forecast",
  past: "Forecast no longer available",
  future: "data not available yet",
  locationNotFound: "Location not found. Try City,Country (e.g. Houston,US) or use geolocation.",
};

/** @typedef {'available'|'past'|'future'|'invalid'} ForecastAvailability */

/** Build a schedulable node shape from a canvas date/launch node. */
function canvasDateNodeFromCanvas(canvasNode) {
  return {
    id: canvasNode.noteId || canvasNode.id,
    title: canvasNode.title,
    dataType: "date",
    content: canvasNode.content ?? "",
    anchorAt: canvasNode.anchorAt || canvasNode.launchAt || null,
    launchAt: canvasNode.launchAt || null,
    parentDocId: canvasNode.parentDocId || null,
    sourceKind: canvasNode.canvasKind === "launch" ? "launch" : "canvas-date",
  };
}

/**
 * @param {Record<string, object>} nodeEntities
 * @param {Record<string, object>} [docsById]
 * @param {{ expandedNodeId?: string|null, selection?: string[], canvasNodes?: object[] }} context
 */
export function resolveActiveForecastNode(nodeEntities, context = {}, docsById = {}) {
  const { expandedNodeId, selection = [], canvasNodes = [] } = context;

  if (expandedNodeId && nodeEntities[expandedNodeId]) {
    return nodeEntities[expandedNodeId];
  }

  const selectedCanvasId = selection[0];
  if (selectedCanvasId) {
    const canvasNode = canvasNodes.find((n) => n.id === selectedCanvasId);
    if (!canvasNode) return null;

    if (canvasNode.dataType === "document" || canvasNode.canvasKind === "document") {
      const docId = canvasNode.docId || canvasNode.noteId;
      const doc = docId ? docsById[docId] : null;
      if (!doc) return null;
      return {
        id: doc.id,
        title: doc.title,
        parentDocId: doc.id,
        anchorAt: doc.launchAt || null,
        createdAt: doc.createdAt,
        sourceKind: "document",
      };
    }

    const entityId = canvasNode.noteId;
    const entity = entityId ? nodeEntities[entityId] : null;
    if (entity) {
      if (entity.dataType === "date" || canvasNode.dataType === "date") {
        return {
          ...entity,
          dataType: "date",
          content: canvasNode.content ?? entity.content,
          launchAt: canvasNode.launchAt ?? entity.launchAt ?? null,
          anchorAt: canvasNode.anchorAt ?? entity.anchorAt ?? canvasNode.launchAt ?? null,
        };
      }
      return entity;
    }

    if (canvasNode.dataType === "date" || canvasNode.canvasKind === "launch") {
      return canvasDateNodeFromCanvas(canvasNode);
    }
  }

  return null;
}

/**
 * @param {object|null} node
 * @returns {{ date: Date|null, resolvedFrom: 'schedule'|'date'|'created'|null, scheduleIso: string|null }}
 */
export function resolveForecastTargetDate(node) {
  if (!node) {
    return { date: null, resolvedFrom: null, scheduleIso: null };
  }

  if (node.anchorAt) {
    const date = parseDate(node.anchorAt);
    return {
      date: startOfCalendarDay(date),
      resolvedFrom: "schedule",
      scheduleIso: node.anchorAt,
    };
  }

  if (node.launchAt) {
    const date = parseDate(node.launchAt);
    if (date) {
      return {
        date: startOfCalendarDay(date),
        resolvedFrom: "schedule",
        scheduleIso: node.launchAt,
      };
    }
  }

  if (node.dataType === "date") {
    const date = parseDate(node.content);
    if (date) {
      const raw = typeof node.content === "string" ? node.content.trim() : "";
      const scheduleIso = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T12:00:00`
        : (node.launchAt || null);
      return {
        date: startOfCalendarDay(date),
        resolvedFrom: "date",
        scheduleIso,
      };
    }
  }

  if (node.createdAt) {
    const date = parseDate(node.createdAt);
    return {
      date: startOfCalendarDay(date),
      resolvedFrom: "created",
      scheduleIso: null,
    };
  }

  return { date: null, resolvedFrom: null, scheduleIso: null };
}

/**
 * @param {Date|null|undefined} targetDate
 * @param {Date} [baseToday]
 * @param {number} [horizon]
 * @returns {ForecastAvailability}
 */
export function getForecastAvailability(targetDate, baseToday = new Date(), horizon = FORECAST_HORIZON_DAYS) {
  const target = startOfCalendarDay(targetDate);
  const base = startOfCalendarDay(baseToday);
  if (!target || !base) return "invalid";

  const diff = daysBetween(base, target);
  if (diff < 0) return "past";
  if (diff > horizon) return "future";
  return "available";
}

/** Display mm/dd for UI labels (year kept internally). */
export function formatForecastUiDate(date) {
  const d = startOfCalendarDay(date);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

/** @param {Date|null|undefined} date */
export function toForecastDateIso(date) {
  const d = startOfCalendarDay(date);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @param {string[]} dayIds ISO dates YYYY-MM-DD */
export function formatForecastWindowLabel(dayIds) {
  if (!dayIds?.length) return "";
  const fmt = (iso) => {
    const mm = iso.slice(5, 7);
    const dd = iso.slice(8, 10);
    return `${mm}/${dd}`;
  };
  if (dayIds.length === 1) return fmt(dayIds[0]);
  return `${fmt(dayIds[0])}–${fmt(dayIds[dayIds.length - 1])}`;
}

/**
 * Gate for the node forecast search button.
 * @param {{
 *   hasLocation: boolean,
 *   panelStatus: string,
 *   panelLocationKey: string,
 *   locationKey: string,
 *   dayIds: string[],
 *   node: object|null,
 * }} params
 */
export function getForecastSearchGate({
  hasLocation,
  panelStatus,
  panelLocationKey,
  locationKey,
  dayIds,
  node,
}) {
  if (!hasLocation) {
    return { enabled: false, reason: "location" };
  }
  if (panelStatus === "loading") {
    return { enabled: false, reason: "loading" };
  }
  if (panelStatus !== "ready" || panelLocationKey !== locationKey || !dayIds?.length) {
    return { enabled: false, reason: "panel" };
  }

  if (!node) {
    return {
      enabled: false,
      reason: "noNode",
      windowLabel: formatForecastWindowLabel(dayIds),
    };
  }

  const { date } = resolveForecastTargetDate(node);
  const dateIso = toForecastDateIso(date);
  if (!dateIso) {
    return {
      enabled: false,
      reason: "noNode",
      windowLabel: formatForecastWindowLabel(dayIds),
    };
  }

  if (dayIds.includes(dateIso)) {
    return {
      enabled: true,
      reason: "ready",
      dateIso,
      windowLabel: formatForecastWindowLabel(dayIds),
    };
  }

  const availability = getForecastAvailability(date, new Date(), dayIds.length - 1);
  if (availability === "past") {
    return {
      enabled: false,
      reason: "past",
      dateIso,
      windowLabel: formatForecastWindowLabel(dayIds),
    };
  }

  return {
    enabled: false,
    reason: "outOfRange",
    dateIso,
    windowLabel: formatForecastWindowLabel(dayIds),
  };
}

/**
 * @param {object|null} node
 * @param {Date} [baseToday]
 * @param {import('./weatherLocation.js').WeatherLocation} [weatherLocation]
 */
export async function fetchForecastForNode(node, baseToday = new Date(), weatherLocation) {
  if (!node) {
    return {
      status: "error",
      message: FORECAST_MESSAGES.noNode,
    };
  }

  const { date, resolvedFrom, scheduleIso } = resolveForecastTargetDate(node);
  if (!date) {
    return {
      status: "error",
      message: FORECAST_MESSAGES.noNode,
    };
  }

  const availability = getForecastAvailability(date, baseToday);
  const uiDate = formatForecastUiDate(date);
  const sourceLabel = resolvedFrom === "schedule"
    ? (formatScheduleLabelFromIso(scheduleIso) || `schedule: ${uiDate}`)
    : resolvedFrom === "date"
      ? `date: ${uiDate}`
      : `created: ${uiDate}`;

  if (availability === "past") {
    return {
      status: "unavailable",
      reason: "past",
      message: FORECAST_MESSAGES.past,
      uiDate,
      sourceLabel,
      resolvedFrom,
      targetDate: date,
      node,
    };
  }

  if (availability === "future") {
    return {
      status: "unavailable",
      reason: "future",
      message: FORECAST_MESSAGES.future,
      uiDate,
      sourceLabel,
      resolvedFrom,
      targetDate: date,
      node,
    };
  }

  await new Promise((r) => setTimeout(r, 200));

  const dateIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  let apiResult;
  let locationError = "";
  try {
    const locationQuery = weatherLocation ? buildWeatherLocationQuery(weatherLocation) : "";
    if (!locationQuery) {
      return {
        status: "unavailable",
        reason: "location",
        message: FORECAST_MESSAGES.locationNotFound,
        uiDate,
        sourceLabel,
        resolvedFrom,
        targetDate: date,
        node,
      };
    }
    const query = `&${locationQuery}`;
    const res = await fetch(`${API_ROUTES.weatherForecast}?date=${dateIso}${query}`, {
      headers,
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      apiResult = body;
    } else if (body.error === WEATHER_ERROR_LOCATION_NOT_FOUND) {
      locationError = FORECAST_MESSAGES.locationNotFound;
    }
  } catch {
    apiResult = null;
  }

  if (locationError) {
    return {
      status: "unavailable",
      reason: "location",
      message: locationError,
      uiDate,
      sourceLabel,
      resolvedFrom,
      targetDate: date,
      node,
    };
  }

  const dayPayload = apiResult?.day;
  if (!dayPayload) {
    return {
      status: "unavailable",
      reason: "future",
      message: FORECAST_MESSAGES.future,
      uiDate,
      sourceLabel,
      resolvedFrom,
      targetDate: date,
      node,
    };
  }

  const result = {
    location: apiResult.location || "Default",
    asOf: apiResult.asOf || new Date().toISOString(),
    day: dayPayload,
  };

  return {
    status: "success",
    uiDate,
    sourceLabel,
    resolvedFrom,
    scheduleIso,
    targetDate: date,
    node,
    location: result.location,
    asOf: result.asOf,
    day: result.day,
    disclaimer: "Weather estimates only — not exact conditions.",
  };
}

/**
 * @param {object} fetchResult
 */
export function buildForecastNodePayload(fetchResult) {
  const day = fetchResult.day;
  const wind = day?.wind || {};
  const period = day?.day || {};

  return {
    kind: "weather-forecast",
    scheduleLabel: fetchResult.sourceLabel,
    scheduleIso: fetchResult.scheduleIso || null,
    resolvedFrom: fetchResult.resolvedFrom,
    uiDate: fetchResult.uiDate,
    location: fetchResult.location,
    asOf: fetchResult.asOf,
    condition: day?.condition,
    conditionIcon: day?.conditionIcon,
    high: day?.high,
    low: day?.low,
    precipPct: day?.precipPct,
    wind,
    summary: period.description || day?.condition,
    disclaimer: fetchResult.disclaimer,
    fetchedAt: new Date().toISOString(),
  };
}

export function buildForecastNodeTitle(uiDate) {
  return `Forecast · ${uiDate || "—"}`;
}
