/**
 * Inline Calendar / Forecast widgets inside a document (macronode) writing body.
 * Inserts as TEXT.embedded so the textarea stays editable below the widget.
 */
import { getCalendarEventDisplayModel } from "./calendarEventDisplay.js";
import { parseCalendarEventNodeContent } from "./eventCalendarSearch.js";
import { parseWeatherForecastNodeContent } from "./forecastSearch.js";
import {
  createEmptyTextBlock,
  ensureNodeWritingTail,
  isNodeWritingBody,
  NODE_BLOCK_TYPES,
  NODE_BODY_KIND,
  normalizeWritingBlocks,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "./nodeInlineContent.js";

/**
 * @param {object} payload calendar-event JSON payload
 * @returns {{ kind: string, displayModel: object }|null}
 */
export function buildCalendarEmbeddedFromPayload(payload) {
  if (!payload || payload.kind !== "calendar-event") return null;
  const displayModel = getCalendarEventDisplayModel(payload);
  if (!displayModel) return null;
  return {
    kind: "calendar-event",
    displayModel,
    // Kept for canvas-connection dedupe (same event + date already pasted).
    eventId: payload.eventId || null,
    uiDate: payload.uiDate || null,
  };
}

/**
 * @param {object} payload weather-forecast JSON payload
 * @returns {{ kind: string, payload: object }|null}
 */
export function buildForecastEmbeddedFromPayload(payload) {
  if (!payload || payload.kind !== "weather-forecast") return null;
  return {
    kind: "weather-forecast",
    payload,
  };
}

/**
 * Widget lives on TEXT.embedded; keep textarea empty so writing continues below.
 * @param {{ kind: string, displayModel?: object, payload?: object }} embedded
 */
function createWidgetTextBlock(embedded) {
  return {
    ...createEmptyTextBlock(""),
    embedded: { ...embedded },
  };
}

/**
 * Migrate legacy root-level calendar-event / weather-forecast content into node-body.
 * @param {unknown} content
 * @returns {{ content: object|string, migrated: boolean }}
 */
export function migrateLegacyIntelWidgetContent(content) {
  const calendar = parseCalendarEventNodeContent(content);
  if (calendar) {
    const embedded = buildCalendarEmbeddedFromPayload(calendar);
    if (embedded) {
      return {
        content: serializeNodeWritingBody({
          blocks: ensureNodeWritingTail([createWidgetTextBlock(embedded)]),
        }),
        migrated: true,
      };
    }
  }

  const forecast = parseWeatherForecastNodeContent(content);
  if (forecast) {
    const embedded = buildForecastEmbeddedFromPayload(forecast);
    if (embedded) {
      return {
        content: serializeNodeWritingBody({
          blocks: ensureNodeWritingTail([createWidgetTextBlock(embedded)]),
        }),
        migrated: true,
      };
    }
  }

  return { content, migrated: false };
}

/**
 * Append an Intel widget block to node writing content and keep a writable TEXT tail.
 * @param {unknown} content
 * @param {{ kind: string, displayModel?: object, payload?: object }} embedded
 * @returns {{ content: object, focusBlockIndex: number }|null}
 */
export function appendIntelWidgetToNodeContent(content, embedded) {
  if (!embedded?.kind) return null;

  let working = content;
  const migrated = migrateLegacyIntelWidgetContent(working);
  if (migrated.migrated) working = migrated.content;

  const { blocks } = parseNodeWritingBody(working);
  const widgetBlock = createWidgetTextBlock(embedded);
  const withoutEmptyTail = (() => {
    const normalized = normalizeWritingBlocks(blocks);
    const last = normalized[normalized.length - 1];
    if (
      last?.type === NODE_BLOCK_TYPES.TEXT
      && !(last.text || "").trim()
      && !last.embedded
    ) {
      return normalized.slice(0, -1);
    }
    return normalized;
  })();

  const nextBlocks = ensureNodeWritingTail([...withoutEmptyTail, widgetBlock]);
  const focusBlockIndex = nextBlocks.length - 1;

  return {
    content: {
      kind: NODE_BODY_KIND,
      blocks: nextBlocks,
    },
    focusBlockIndex,
  };
}

/**
 * @param {unknown} content
 * @returns {boolean}
 */
export function nodeContentAcceptsIntelWidget(content) {
  if (content == null || content === "") return true;
  if (typeof content === "string") {
    if (!content.trim()) return true;
    if (parseCalendarEventNodeContent(content)) return true;
    if (parseWeatherForecastNodeContent(content)) return true;
    // Plain string body — can be wrapped into node-body
    return true;
  }
  if (isNodeWritingBody(content)) return true;
  if (parseCalendarEventNodeContent(content)) return true;
  if (parseWeatherForecastNodeContent(content)) return true;
  return false;
}

/**
 * Strip embedded from a writing TEXT block (keep user text).
 * @param {object[]} blocks
 * @param {number} blockIndex
 */
export function removeEmbeddedFromWritingBlock(blocks, blockIndex) {
  const normalized = normalizeWritingBlocks(blocks);
  if (blockIndex < 0 || blockIndex >= normalized.length) return normalized;
  const block = normalized[blockIndex];
  if (block?.type !== NODE_BLOCK_TYPES.TEXT || !block.embedded) return normalized;
  const next = normalized.map((entry, index) => {
    if (index !== blockIndex) return entry;
    const { embedded: _drop, ...rest } = entry;
    return rest;
  });
  return ensureNodeWritingTail(next);
}
