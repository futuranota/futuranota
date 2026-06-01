/**
 * Resolve forecast target from node schedule/created and fetch mock weather.
 * Replace fetchForecastForNode mock body with GET /api/weather/forecast?date=YYYY-MM-DD.
 */
import { daysBetween } from "../data.jsx";
import { getForecastForDate, FORECAST_MOCK_HORIZON_DAYS } from "../data/forecastMock.js";
import { formatScheduleLabelFromIso } from "./nodeAnchor.js";
import { parseDate, startOfCalendarDay } from "../temporal.js";

export const FORECAST_HORIZON_DAYS = FORECAST_MOCK_HORIZON_DAYS;

export const FORECAST_MESSAGES = {
  noNode: "Select a node to fetch forecast",
  past: "Forecast no longer available",
  future: "data not available yet",
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

/**
 * @param {object|null} node
 * @param {Date} [baseToday]
 */
export async function fetchForecastForNode(node, baseToday = new Date()) {
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

  await new Promise((r) => setTimeout(r, 400));

  const result = getForecastForDate(date, baseToday);
  if (!result) {
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
