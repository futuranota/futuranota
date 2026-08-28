import {
  createMoodboardColumn,
  DOC_BLOCK_TYPES,
  MOODBOARD_NOTES_BODY_MAX,
  MOODBOARD_NOTES_TITLE_DEFAULT,
  MOODBOARD_RECIPES,
  MOODBOARD_STICKY_TITLE_MAX,
} from "./docBlocks.js";
import { buildEventCalendarScopeBrief } from "./eventCalendarScopeBrief.js";
import {
  calendarEventPayloadToResult,
  EVENT_CALENDAR_RANGES,
} from "./eventCalendarSearch.js";
import { parseScopeBriefText } from "./calendarEventDisplay.js";
import { startOfCalendarDay } from "../temporal.js";
import { parseNodeWritingBody, serializeNodeWritingBody } from "./nodeInlineContent.js";

/**
 * Plain body for doc/moodboard integration — season blocks only (no scanner intro).
 * @param {{ sections?: { season?: string, events?: { name?: string, date?: string }[] }[] }} parsed
 */
function bodyFromDisplaySections(parsed) {
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  if (!sections.length) return "";
  const lines = [];
  sections.forEach((section) => {
    if (section.season) lines.push(section.season);
    const events = Array.isArray(section.events) ? section.events : [];
    events.forEach((event) => {
      const name = String(event?.name ?? "").trim();
      if (!name) return;
      const date = String(event?.date ?? "").trim();
      lines.push(date ? `${name} · ${date}` : name);
    });
    lines.push("");
  });
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/**
 * @param {{ sections?: { events?: unknown[] }[] }} displayModel
 */
function countDisplayEvents(displayModel) {
  const sections = Array.isArray(displayModel?.sections) ? displayModel.sections : [];
  let total = 0;
  sections.forEach((section) => {
    total += Array.isArray(section.events) ? section.events.length : 0;
  });
  return total;
}

/**
 * @param {{ sections?: { season?: string, events?: { name?: string }[] }[] }} displayModel
 * @param {object} fetchShape
 */
function stickyTitleFromDisplay(displayModel, fetchShape) {
  const sections = Array.isArray(displayModel?.sections) ? displayModel.sections : [];
  const eventCount = countDisplayEvents(displayModel);

  if (eventCount <= 1) {
    const name = sections[0]?.events?.[0]?.name;
    if (name) return String(name).slice(0, MOODBOARD_STICKY_TITLE_MAX);
    const ev = fetchShape.event || fetchShape.events?.[0];
    if (ev?.title) return String(ev.title).slice(0, MOODBOARD_STICKY_TITLE_MAX);
  }

  const seasons = sections.map((s) => String(s.season || "").trim()).filter(Boolean);
  if (seasons.length === 1) {
    return seasons[0].slice(0, MOODBOARD_STICKY_TITLE_MAX);
  }

  const rangeLabel = fetchShape.rangeLabel || fetchShape.rangeId || "week";
  return `Event calendar · ${rangeLabel}`.slice(0, MOODBOARD_STICKY_TITLE_MAX);
}

/**
 * @param {object} source
 * @param {object} fetchShape
 * @param {'en'|'es'} locale
 */
function resolveCalendarDisplayModel(source, fetchShape, locale) {
  if (source.displayModel?.sections?.length) {
    return source.displayModel;
  }
  if (fetchShape.displayModel?.sections?.length) {
    return fetchShape.displayModel;
  }
  if (fetchShape.scopeBrief?.displayModel?.sections?.length) {
    return fetchShape.scopeBrief.displayModel;
  }
  if (typeof source.scopeBrief === "string" && source.scopeBrief.trim()) {
    const parsed = parseScopeBriefText(source.scopeBrief);
    if (parsed?.sections?.length) return parsed;
  }
  if (typeof fetchShape.scopeBrief?.body === "string" && fetchShape.scopeBrief.body.trim()) {
    const parsed = parseScopeBriefText(fetchShape.scopeBrief.body);
    if (parsed?.sections?.length) return parsed;
  }

  const hasEventData = Boolean(
    fetchShape.event
    || (Array.isArray(fetchShape.events) && fetchShape.events.length > 0),
  );
  if (!hasEventData) return null;

  const brief = buildEventCalendarScopeBrief(fetchShape, { locale, omitIntro: true });
  if (brief?.displayModel?.sections?.length) {
    return brief.displayModel;
  }
  return null;
}

/**
 * Ensure scope brief builder has schedule window fields (payload / connect paths).
 * @param {object} fetchShape
 */
function hydrateCalendarFetchShape(fetchShape) {
  if (!fetchShape || typeof fetchShape !== "object") return fetchShape;
  const rangeDays = fetchShape.rangeDays ?? EVENT_CALENDAR_RANGES.week?.days ?? 7;
  const scheduleIso = typeof fetchShape.scheduleIso === "string" && fetchShape.scheduleIso
    ? fetchShape.scheduleIso.slice(0, 10)
    : (fetchShape.event?.date || fetchShape.events?.[0]?.date || "").slice(0, 10);

  let targetDate = fetchShape.targetDate || null;
  let rangeEnd = fetchShape.rangeEnd || null;

  if (scheduleIso && !rangeEnd) {
    const start = startOfCalendarDay(new Date(`${scheduleIso}T12:00:00`));
    if (start && !Number.isNaN(start.getTime())) {
      targetDate = targetDate || start;
      rangeEnd = new Date(start);
      rangeEnd.setDate(rangeEnd.getDate() + rangeDays - 1);
    }
  }

  const events = Array.isArray(fetchShape.events) ? fetchShape.events : [];
  return {
    ...fetchShape,
    scheduleIso: scheduleIso || fetchShape.scheduleIso || null,
    rangeDays,
    targetDate,
    rangeEnd,
    events,
  };
}

/**
 * @typedef {{ scope: "node", target: object, nodeId: string, parentDocId: string|null, docTitle: string }}
 *   | {{ scope: "doc", target: object, nodeId: string, parentDocId: string, docTitle: string }}
 *   MoodboardCalendarFillPlan
 */

/**
 * @param {unknown} column
 */
export function isMoodboardStickyEmpty(column) {
  if (!column || column.recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY) return false;
  const text = String(column.stickyText ?? "").trim();
  if (text) return false;
  const title = String(column.stickyTitle ?? "").trim();
  return !title || title === MOODBOARD_NOTES_TITLE_DEFAULT;
}

/**
 * @param {unknown} column
 */
export function isMoodboardCalendarWireTarget(column) {
  if (!isMoodboardStickyEmpty(column)) return false;
  return Boolean(column?.calendarWireEnabled);
}

/**
 * @param {unknown} blocks
 * @returns {{ blockId: string, colIndex: number } | null}
 */
export function findMoodboardStickyTarget(blocks) {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    const blockType = block?.type;
    if (
      !block?.id
      || (blockType !== DOC_BLOCK_TYPES.MOODBOARD && blockType !== "moodboard")
    ) {
      continue;
    }
    const columns = Array.isArray(block.columns) ? block.columns : [];
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      if (isMoodboardCalendarWireTarget(columns[colIndex])) {
        return { blockId: String(block.id), colIndex };
      }
    }
  }
  return null;
}

/**
 * @param {unknown} blocks
 * @param {{ blockId: string, colIndex: number }} target
 * @param {{ stickyTitle?: string, stickyText?: string }} content
 */
export function fillMoodboardStickyColumn(blocks, target, content) {
  if (!Array.isArray(blocks) || !target?.blockId) return null;
  const stickyTitle = String(content?.stickyTitle ?? "").slice(0, MOODBOARD_STICKY_TITLE_MAX);
  const stickyText = String(content?.stickyText ?? "").slice(0, MOODBOARD_NOTES_BODY_MAX);
  if (!stickyText.trim()) return null;

  let changed = false;
  const next = blocks.map((block) => {
    if (!block || block.id !== target.blockId) return block;
    const blockType = block.type;
    if (blockType !== DOC_BLOCK_TYPES.MOODBOARD && blockType !== "moodboard") return block;
    const columns = Array.isArray(block.columns) ? block.columns : [];
    const nextColumns = columns.map((col, colIndex) => {
      if (colIndex !== target.colIndex) return col;
      if (!isMoodboardCalendarWireTarget(col)) return col;
      changed = true;
      return createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY, {
        images: col.images,
        stickyTitle,
        stickyText,
        infoLabel: col.infoLabel,
        noteStyle: col.noteStyle,
        calendarWireEnabled: false,
        stickyFromCalendar: true,
      });
    });
    return changed ? { ...block, columns: nextColumns } : block;
  });
  return changed ? next : null;
}

/**
 * @param {unknown} blocks
 * @param {string} stickyText
 */
export function moodboardHasStickyText(blocks, stickyText) {
  const needle = String(stickyText ?? "").trim();
  if (!needle) return false;
  if (!Array.isArray(blocks)) return false;
  for (const block of blocks) {
    const blockType = block?.type;
    if (blockType !== DOC_BLOCK_TYPES.MOODBOARD && blockType !== "moodboard") continue;
    const columns = Array.isArray(block?.columns) ? block.columns : [];
    for (const col of columns) {
      if (col?.recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY) continue;
      if (String(col.stickyText ?? "").trim() === needle) return true;
    }
  }
  return false;
}

/**
 * @param {object|null|undefined} source fetch result or calendar-event payload
 * @param {{ locale?: 'en'|'es' }} [options]
 */
export function buildStickyContentFromCalendarSource(source, options = {}) {
  if (!source) return null;

  const locale = options.locale === "es" ? "es" : "en";
  let fetchShape = null;

  if (source.kind === "calendar-event") {
    const pseudo = calendarEventPayloadToResult(source);
    if (!pseudo) return null;
    const eventsFromPayload = Array.isArray(source.events) ? source.events : [];
    fetchShape = {
      ...pseudo,
      rangeId: source.rangeId || null,
      rangeDays: source.rangeDays ?? null,
      rangeLabel: source.rangeLabel || null,
      scheduleIso: source.scheduleIso || null,
      targetDate: source.targetDate || null,
      rangeEnd: source.rangeEnd || null,
      displayModel: source.displayModel || pseudo.displayModel || null,
      events: eventsFromPayload.length > 0
        ? eventsFromPayload
        : (pseudo.event ? [pseudo.event] : []),
    };
  } else if (source.scopeBrief || Array.isArray(source.events)) {
    fetchShape = source;
  }

  if (!fetchShape) return null;

  fetchShape = hydrateCalendarFetchShape(fetchShape);

  const displayModel = resolveCalendarDisplayModel(source, fetchShape, locale);
  if (!displayModel?.sections?.length) return null;

  const stickyText = bodyFromDisplaySections(displayModel).slice(0, MOODBOARD_NOTES_BODY_MAX);
  if (!stickyText.trim()) return null;

  const stickyTitle = stickyTitleFromDisplay(displayModel, fetchShape);

  return { stickyTitle, stickyText };
}

/**
 * @param {object|null|undefined} activeNode
 * @param {object|null|undefined} parentDoc
 * @returns {MoodboardCalendarFillPlan|null}
 */
export function resolveMoodboardCalendarFillPlan(activeNode, parentDoc) {
  if (!activeNode?.id) return null;

  const docTitle = String(
    parentDoc?.title || activeNode.title || activeNode.sourceQuery || "document",
  ).trim() || "document";
  const nodeBlocks = parseNodeWritingBody(activeNode.content).blocks;
  const nodeTarget = findMoodboardStickyTarget(nodeBlocks);
  if (nodeTarget) {
    return {
      scope: "node",
      target: nodeTarget,
      nodeId: String(activeNode.id),
      parentDocId: activeNode.parentDocId || null,
      docTitle,
    };
  }

  const parentDocId = activeNode.parentDocId || parentDoc?.id || null;
  if (!parentDocId) return null;
  const docBlocks = Array.isArray(parentDoc?.blocks) ? parentDoc.blocks : [];
  const docTarget = findMoodboardStickyTarget(docBlocks);
  if (!docTarget) return null;

  return {
    scope: "doc",
    target: docTarget,
    nodeId: String(activeNode.id),
    parentDocId: String(parentDocId),
    docTitle,
  };
}

/**
 * @param {MoodboardCalendarFillPlan} plan
 * @param {object} source fetch result or calendar-event payload
 * @param {{
 *   getNode: (id: string) => object|null|undefined,
 *   updateNode: (id: string, patch: object) => void,
 *   syncNodeToParentDoc?: (nodeId: string, parentDocId: string) => void,
 *   getDoc: (id: string) => object|null|undefined,
 *   updateDoc: (id: string, patch: object) => void,
 *   locale?: 'en'|'es',
 * }} api
 * @returns {boolean}
 */
export function applyMoodboardCalendarFill(plan, source, api) {
  const content = buildStickyContentFromCalendarSource(source, { locale: api.locale });
  if (!plan || !content) return false;

  if (plan.scope === "node") {
    const node = api.getNode(plan.nodeId);
    if (!node) return false;
    const nodeBlocks = parseNodeWritingBody(node.content).blocks;
    if (moodboardHasStickyText(nodeBlocks, content.stickyText)) return true;
    const nextNodeBlocks = fillMoodboardStickyColumn(nodeBlocks, plan.target, content);
    if (!nextNodeBlocks) return false;
    const nextContent = serializeNodeWritingBody({ blocks: nextNodeBlocks });
    api.updateNode(plan.nodeId, { content: nextContent });
    if (plan.parentDocId && api.syncNodeToParentDoc) {
      api.syncNodeToParentDoc(plan.nodeId, plan.parentDocId);
    }
    return true;
  }

  if (plan.scope === "doc" && plan.parentDocId) {
    const parentDoc = api.getDoc(plan.parentDocId);
    const docBlocks = Array.isArray(parentDoc?.blocks) ? parentDoc.blocks : [];
    if (moodboardHasStickyText(docBlocks, content.stickyText)) return true;
    const nextBlocks = fillMoodboardStickyColumn(docBlocks, plan.target, content);
    if (!nextBlocks) return false;
    api.updateDoc(plan.parentDocId, { blocks: nextBlocks });
    return true;
  }

  return false;
}
