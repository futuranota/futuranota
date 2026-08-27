import { supabase, getSupabaseConfigError, formatSupabaseError } from "../../lib/supabaseClient.js";
import { resolveSyncUserId } from "../../lib/resolveSyncUserId.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { normalizeFolderLibraryItems, normalizeLibrarySets, normalizePromptClasses } from "../../lib/folderLibraryNormalize.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import { sanitizePersistedSnapshot, pruneStrayDefaultYo, findObjectIdByName } from "../../lib/storeSanitize.js";
import { repairDocNodeLinks } from "../../lib/resolveDocBlockNodes.js";
import { mergeEntityMapsPreferNewer } from "../../lib/mergeEntityMapsPreferNewer.js";
import {
  isLinkedFolderChildNode,
  nodeEntityPersistedContentCharCount,
  nodeHasPersistedContent,
  nodePersistedContentCharCount,
} from "../../lib/nodePersistedContentScore.js";
import {
  clearLastSyncedAt,
  fetchWorkspaceVersion,
  maxUpdatedAtFromRows,
  parseVersionMs,
  readLastSyncedAt,
  shouldSkipFullHydrate,
  writeLastSyncedAt,
} from "../../lib/workspaceVersionGate.js";
import { scheduleDocImageDataUrlBackfill } from "../../lib/migrateDocImageDataUrls.js";
import {
  filterTimelineFileQueueToExistingNodes,
  mergeTimelineFileQueues,
} from "../../lib/timelineFileQueue.js";
import { useScheduledTasksStore } from "../scheduledTasksStore.js";
import { useUIStateStore } from "../uiStateStore.js";

const STORAGE_KEY = "futura-nota-v1";
/** Cross-tab delete ledger — other open /app tabs must not re-upsert ghost folders/corpora. */
const TOMBSTONE_LEDGER_KEY = "futura-nota-deleted-v1";
/** Keep tombstones after remote SELECT says gone so a sibling tab cannot race-reupsert. */
const TOMBSTONE_CLEAR_GRACE_MS = 60_000;

// #region agent log
const DEBUG_TAB_ID = (() => {
  try {
    const existing = sessionStorage.getItem("fn-debug-tab-8974ed");
    if (existing) return existing;
    const created = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem("fn-debug-tab-8974ed", created);
    return created;
  } catch {
    return "tab-unknown";
  }
})();
const debugNodeSummaries = (nodes) => Object.values(nodes || {}).map((node) => ({
  nodeId: node?.id ?? null,
  numericTitle: /^\d+$/.test(String(node?.title || "").trim()) ? String(node.title).trim() : null,
  titleLength: String(node?.title || "").length,
  status: node?.status ?? null,
  completed: Boolean(node?.completed),
  updatedAt: node?.updatedAt ?? null,
})).filter((node) => node.numericTitle !== null || node.status !== null).slice(0, 100);
// #endregion

/** Pack schedule + status + corpus meta into nodes.reference JSONB (no dedicated DB columns). */
function referenceWithNodeMeta(node) {
  const base = node?.reference && typeof node.reference === "object" ? { ...node.reference } : {};
  const anchorAt = node?.anchorAt || base.anchorAt || null;
  if (anchorAt) base.anchorAt = anchorAt;
  else delete base.anchorAt;
  const anchorFinishAt = node?.anchorFinishAt || base.anchorFinishAt || null;
  if (anchorFinishAt) base.anchorFinishAt = anchorFinishAt;
  else delete base.anchorFinishAt;

  if (node?.completed) base.completed = true;
  else delete base.completed;

  let workStatus = typeof node?.status === "string" ? node.status.trim() : "";
  if (
    workStatus !== "not_started"
    && workStatus !== "reserved"
    && workStatus !== "in_progress"
    && workStatus !== "submitted"
    && workStatus !== "past_due"
    && workStatus !== "completed"
  ) {
    workStatus = node?.completed ? "completed" : "";
  }
  if (
    workStatus === "not_started"
    || workStatus === "reserved"
    || workStatus === "in_progress"
    || workStatus === "submitted"
    || workStatus === "past_due"
    || workStatus === "completed"
  ) {
    base.status = workStatus;
  } else {
    delete base.status;
  }

  const sourceId = node?.sourceId || null;
  if (sourceId) base.sourceId = sourceId;
  else delete base.sourceId;

  // Independent Documents scope (parentless nodes) — no nodes.object_id column.
  const objectId = node?.objectId || null;
  if (objectId) base.objectId = objectId;
  else delete base.objectId;

  // Campaign document fields (active|inactive + launch + window).
  if (node?.campaignStatus === "active" || node?.campaignStatus === "inactive") {
    base.campaignStatus = node.campaignStatus;
  } else if (base.campaignStatus !== "active" && base.campaignStatus !== "inactive") {
    delete base.campaignStatus;
  }

  const launchAt = node?.launchAt || base.launchAt || null;
  if (launchAt) base.launchAt = launchAt;
  else delete base.launchAt;

  const windowStartAt = node?.windowStartAt || base.windowStartAt || null;
  if (windowStartAt) base.windowStartAt = windowStartAt;
  else delete base.windowStartAt;

  const windowEndAt = node?.windowEndAt || base.windowEndAt || null;
  if (windowEndAt) base.windowEndAt = windowEndAt;
  else delete base.windowEndAt;

  const subcategory = typeof node?.subcategory === "string"
    ? node.subcategory.trim()
    : (typeof node?.category === "string" ? node.category.trim() : "");
  if (subcategory) base.subcategory = subcategory;
  else {
    delete base.subcategory;
    delete base.category;
  }

  return base;
}

function campaignStatusFromPersistedNode(node) {
  if (!node) return "inactive";
  if (node.campaignStatus === "active" || node.campaignStatus === "inactive") {
    return node.campaignStatus;
  }
  const ref = node.reference;
  if (ref && typeof ref === "object") {
    if (ref.campaignStatus === "active" || ref.campaignStatus === "inactive") {
      return ref.campaignStatus;
    }
  }
  return "inactive";
}

function launchAtFromPersistedNode(node) {
  if (!node) return null;
  if (node.launchAt) return node.launchAt;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.launchAt) return ref.launchAt;
  return null;
}

function windowStartAtFromPersistedNode(node) {
  if (!node) return null;
  if (node.windowStartAt) return node.windowStartAt;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.windowStartAt) return ref.windowStartAt;
  return null;
}

function windowEndAtFromPersistedNode(node) {
  if (!node) return null;
  if (node.windowEndAt) return node.windowEndAt;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.windowEndAt) return ref.windowEndAt;
  return null;
}

function subcategoryFromPersistedNode(node) {
  if (!node) return "";
  if (typeof node.subcategory === "string" && node.subcategory.trim()) {
    return node.subcategory.trim();
  }
  if (typeof node.category === "string" && node.category.trim()) {
    return node.category.trim();
  }
  const ref = node.reference;
  if (ref && typeof ref === "object") {
    if (typeof ref.subcategory === "string" && ref.subcategory.trim()) {
      return ref.subcategory.trim();
    }
    if (typeof ref.category === "string" && ref.category.trim()) {
      return ref.category.trim();
    }
  }
  return "";
}

function timelineSourceNodeIdFromPersistedDoc(camp) {
  if (!camp) return null;
  if (typeof camp.timeline_source_node_id === "string" && camp.timeline_source_node_id) {
    return camp.timeline_source_node_id;
  }
  const ki = camp.knowledge_import;
  if (ki && typeof ki === "object" && typeof ki.timelineSourceNodeId === "string") {
    return ki.timelineSourceNodeId || null;
  }
  return null;
}

function sidebarOrderFromPersistedDoc(camp) {
  if (!camp) return null;
  if (typeof camp.sidebar_order === "number" && Number.isFinite(camp.sidebar_order)) {
    return camp.sidebar_order;
  }
  const ki = camp.knowledge_import;
  if (ki && typeof ki === "object" && typeof ki.sidebarOrder === "number" && Number.isFinite(ki.sidebarOrder)) {
    return ki.sidebarOrder;
  }
  return null;
}

/** knowledge_import JSONB sidecar for timelineSourceNodeId + sidebarOrder (no dedicated columns required). */
function stripKnowledgeImportSidecar(raw) {
  if (!raw || typeof raw !== "object") return raw || null;
  const next = { ...raw };
  let changed = false;
  if (Object.prototype.hasOwnProperty.call(next, "timelineSourceNodeId")) {
    delete next.timelineSourceNodeId;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(next, "sidebarOrder")) {
    delete next.sidebarOrder;
    changed = true;
  }
  if (!changed) return raw;
  return Object.keys(next).length ? next : null;
}

/** @deprecated use stripKnowledgeImportSidecar */
function stripTimelineSourceFromKnowledgeImport(raw) {
  return stripKnowledgeImportSidecar(raw);
}

function knowledgeImportWithTimelineSource(doc) {
  const base = stripKnowledgeImportSidecar(doc?.knowledgeImport);
  const extras = {};
  if (doc?.campaignActive && doc?.timelineSourceNodeId) {
    extras.timelineSourceNodeId = doc.timelineSourceNodeId;
  }
  if (typeof doc?.sidebarOrder === "number" && Number.isFinite(doc.sidebarOrder)) {
    extras.sidebarOrder = doc.sidebarOrder;
  }
  if (!Object.keys(extras).length) return base;
  return { ...(base && typeof base === "object" ? base : {}), ...extras };
}

/** Read schedule from reference payload or legacy top-level field. */
function anchorAtFromPersistedNode(node) {
  if (!node) return null;
  if (node.anchorAt) return node.anchorAt;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.anchorAt) return ref.anchorAt;
  return null;
}

function anchorFinishAtFromPersistedNode(node) {
  if (!node) return null;
  if (node.anchorFinishAt) return node.anchorFinishAt;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.anchorFinishAt) return ref.anchorFinishAt;
  return null;
}

function completedFromPersistedNode(node) {
  if (!node) return false;
  if (node.completed != null) return Boolean(node.completed);
  const ref = node.reference;
  if (ref && typeof ref === "object") return Boolean(ref.completed);
  return false;
}

/** Prefer reference.status; migrate completed:true → completed when status missing. */
function statusFromPersistedNode(node) {
  if (!node) return null;
  const raw = node.status
    ?? (node.reference && typeof node.reference === "object" ? node.reference.status : null);
  if (raw === "in_review") return "submitted";
  if (
    raw === "not_started"
    || raw === "reserved"
    || raw === "in_progress"
    || raw === "submitted"
    || raw === "past_due"
    || raw === "completed"
  ) return raw;
  if (completedFromPersistedNode(node)) return "completed";
  return null;
}

function sourceIdFromPersistedNode(node) {
  if (!node) return null;
  if (node.sourceId) return node.sourceId;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.sourceId) return ref.sourceId;
  return null;
}

function objectIdFromPersistedNode(node) {
  if (!node) return null;
  if (node.objectId) return node.objectId;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.objectId) return ref.objectId;
  return null;
}

/**
 * Restore missing node.anchorAt from linked doc block Schedule fields.
 * Schedule always wins over createdAt.
 */
function backfillNodeAnchorsFromDocs(nodes, docs) {
  const next = { ...(nodes || {}) };
  for (const doc of Object.values(docs || {})) {
    for (const block of doc?.blocks || []) {
      const nodeId = block?.nodeId;
      if (!nodeId || !next[nodeId]?.id) continue;
      if (next[nodeId].anchorAt) continue;
      const date = String(block.anchorDate || "").trim();
      if (!date) continue;
      if (block.anchorFromNode === false) continue;
      const iso = isoFromAnchorFields(date, block.anchorTime || "");
      if (!iso) continue;
      const finishIso = isoFromAnchorFields(date, block.anchorFinishTime || "");
      next[nodeId] = {
        ...next[nodeId],
        anchorAt: iso,
        ...(finishIso ? { anchorFinishAt: finishIso } : {}),
      };
    }
  }
  return next;
}

/** Coerce app doc version strings to int4/null for Supabase (version column is integer). */
function docVersionToDbInt(version) {
  const raw = String(version ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Read version from DB int/text into app string field. */
function docVersionFromDb(version) {
  if (version === null || version === undefined || version === "") return "";
  return String(version);
}

let initialized = false;
let isSyncedWithRemote = false;
/** Last completed flush of companies/campaigns/nodes to cloud. Guards SIGNED_OUT wipe. */
let lastCloudFlushOk = true;
let hydrateInFlight = false;
let lastSyncWarnAt = 0;
/** Serialize remote writes so a stale in-flight upsert cannot resurrect deleted folders. */
let syncInFlight = null;
let syncNeedsRerun = false;

/** Doc/node/company IDs deleted locally that hydrate must not resurrect until remote orphan cleanup lands. */
const pendingDeletedDocIds = new Set();
const pendingDeletedNodeIds = new Set();
const pendingDeletedCompanyIds = new Set();
/** When each id was tombstoned — used for clear grace against cross-tab upsert races. */
const deletedDocMarkedAt = new Map();
const deletedNodeMarkedAt = new Map();
const deletedCompanyMarkedAt = new Map();
/** Bumps whenever a folder/node is tombstoned — hydrate uses this to re-strip mid-flight deletes. */
let deleteTombstoneRevision = 0;

/**
 * Union two id lists (order not significant).
 * @param {unknown} a
 * @param {unknown} b
 */
function unionIdLists(a, b) {
  const out = new Set();
  for (const id of Array.isArray(a) ? a : []) {
    if (id) out.add(String(id));
  }
  for (const id of Array.isArray(b) ? b : []) {
    if (id) out.add(String(id));
  }
  return [...out];
}

/**
 * Broadcast delete tombstones so every open tab stops upserting those ids.
 * Writes are **union with disk** — a tab that only tombstoned docs must not wipe
 * another tab's company tombstones by replacing the whole ledger.
 */
function writeTombstoneLedger() {
  if (typeof localStorage === "undefined") return;
  try {
    const existing = readTombstoneLedger();
    const payload = {
      docs: unionIdLists(existing?.docs, [...pendingDeletedDocIds]),
      nodes: unionIdLists(existing?.nodes, [...pendingDeletedNodeIds]),
      companies: unionIdLists(existing?.companies, [...pendingDeletedCompanyIds]),
      revision: Math.max(
        Number(existing?.revision) || 0,
        deleteTombstoneRevision,
      ),
      updatedAt: Date.now(),
    };
    localStorage.setItem(TOMBSTONE_LEDGER_KEY, JSON.stringify(payload));
  } catch {
    // private mode / quota
  }
}

/**
 * After remote confirms deletes, drop those ids from the shared disk ledger.
 * @param {"docs"|"nodes"|"companies"} kind
 * @param {string[]} clearedIds
 */
function removeIdsFromTombstoneLedger(kind, clearedIds) {
  if (typeof localStorage === "undefined") return;
  const remove = new Set((clearedIds || []).filter(Boolean).map(String));
  if (!remove.size) return;
  try {
    const existing = readTombstoneLedger() || {};
    const prev = Array.isArray(existing[kind]) ? existing[kind] : [];
    const next = prev.filter((id) => id && !remove.has(String(id)));
    if (next.length === prev.length) return;
    localStorage.setItem(
      TOMBSTONE_LEDGER_KEY,
      JSON.stringify({
        ...existing,
        docs: kind === "docs" ? next : unionIdLists(existing.docs, [...pendingDeletedDocIds]),
        nodes: kind === "nodes" ? next : unionIdLists(existing.nodes, [...pendingDeletedNodeIds]),
        companies: kind === "companies"
          ? next
          : unionIdLists(existing.companies, [...pendingDeletedCompanyIds]),
        revision: Math.max(Number(existing.revision) || 0, deleteTombstoneRevision),
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // private mode / quota
  }
}

function readTombstoneLedger() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOMBSTONE_LEDGER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Union ledger into in-memory tombstones (never removes).
 * @param {Record<string, unknown>|null|undefined} ledger
 * @returns {boolean}
 */
function adoptTombstoneLedger(ledger) {
  if (!ledger || typeof ledger !== "object") return false;
  const docs = Array.isArray(ledger.docs) ? ledger.docs : [];
  const nodes = Array.isArray(ledger.nodes) ? ledger.nodes : [];
  const companies = Array.isArray(ledger.companies) ? ledger.companies : [];
  let changed = false;
  const now = Date.now();
  for (const id of docs) {
    if (!id || pendingDeletedDocIds.has(id)) continue;
    pendingDeletedDocIds.add(id);
    if (!deletedDocMarkedAt.has(id)) deletedDocMarkedAt.set(id, now);
    changed = true;
  }
  for (const id of nodes) {
    if (!id || pendingDeletedNodeIds.has(id)) continue;
    pendingDeletedNodeIds.add(id);
    if (!deletedNodeMarkedAt.has(id)) deletedNodeMarkedAt.set(id, now);
    changed = true;
  }
  for (const id of companies) {
    if (!id || pendingDeletedCompanyIds.has(id)) continue;
    pendingDeletedCompanyIds.add(id);
    if (!deletedCompanyMarkedAt.has(id)) deletedCompanyMarkedAt.set(id, now);
    changed = true;
  }
  if (changed) deleteTombstoneRevision += 1;
  return changed;
}

/**
 * Mark folders (docs) and cascaded nodes as intentionally deleted so merge cannot restore them.
 * @param {string|string[]} docIds
 * @param {string|string[]} [nodeIds]
 */
export function markDocsDeletedForSync(docIds, nodeIds = []) {
  const docs = Array.isArray(docIds) ? docIds : [docIds];
  const nodes = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
  let changed = false;
  const now = Date.now();
  for (const id of docs) {
    if (id && !pendingDeletedDocIds.has(id)) {
      pendingDeletedDocIds.add(id);
      deletedDocMarkedAt.set(id, now);
      changed = true;
    }
  }
  for (const id of nodes) {
    if (id && !pendingDeletedNodeIds.has(id)) {
      pendingDeletedNodeIds.add(id);
      deletedNodeMarkedAt.set(id, now);
      changed = true;
    }
  }
  if (changed) {
    deleteTombstoneRevision += 1;
    writeTombstoneLedger();
  }
}

/** True when a node id is tombstoned and must not remarge into open folder drafts. */
export function isNodeMarkedDeletedForSync(nodeId) {
  const id = String(nodeId || "").trim();
  return Boolean(id && pendingDeletedNodeIds.has(id));
}

/**
 * Mark corpora (companies) as intentionally deleted so hydrate merge cannot restore them.
 * @param {string|string[]} companyIds
 */
export function markCompaniesDeletedForSync(companyIds) {
  const ids = Array.isArray(companyIds) ? companyIds : [companyIds];
  let changed = false;
  const now = Date.now();
  for (const id of ids) {
    if (id && !pendingDeletedCompanyIds.has(id)) {
      pendingDeletedCompanyIds.add(id);
      deletedCompanyMarkedAt.set(id, now);
      changed = true;
    }
  }
  if (changed) {
    deleteTombstoneRevision += 1;
    writeTombstoneLedger();
  }
}

/**
 * @param {Record<string, object>|null|undefined} map
 * @param {Set<string>} pendingIds
 */
function omitPendingDeletedIds(map, pendingIds) {
  if (!map || typeof map !== "object" || pendingIds.size === 0) return map || {};
  let changed = false;
  const out = { ...map };
  for (const id of pendingIds) {
    if (id in out) {
      delete out[id];
      changed = true;
    }
  }
  return changed ? out : map;
}

/**
 * Drop intentionally-deleted docs/nodes from a merged workspace snapshot.
 * @param {Record<string, unknown>} state
 */
function stripPendingDeletesFromState(state) {
  if (!state || typeof state !== "object") return state;
  let docs = omitPendingDeletedIds(state.docs, pendingDeletedDocIds);
  const nodes = omitPendingDeletedIds(state.nodes, pendingDeletedNodeIds);
  const objectsOmitted = omitPendingDeletedIds(state.objects, pendingDeletedCompanyIds);
  if (docs === state.docs && nodes === state.nodes && objectsOmitted === state.objects) return state;

  // Keep doc.nodeIds consistent after stripping resurrected nodes (copy-on-write).
  if (pendingDeletedNodeIds.size > 0 && docs && typeof docs === "object") {
    let docsCopied = docs !== state.docs;
    const nextDocs = docsCopied ? docs : { ...docs };
    for (const [id, doc] of Object.entries(nextDocs)) {
      if (!doc || typeof doc !== "object" || !Array.isArray(doc.nodeIds)) continue;
      const filtered = doc.nodeIds.filter((nid) => nid && !pendingDeletedNodeIds.has(nid) && nodes?.[nid]);
      if (filtered.length !== doc.nodeIds.length) {
        if (!docsCopied) {
          docsCopied = true;
        }
        nextDocs[id] = { ...doc, nodeIds: filtered };
      }
    }
    docs = nextDocs;
  }

  const next = { ...state, docs, nodes, objects: objectsOmitted };
  if (next.objects && typeof next.objects === "object") {
    next.objects = rebuildObjectChildren(next.objects, docs);
  }
  return next;
}

/**
 * Hard-delete tombstoned ids from a remote table (batched).
 * @param {string} table
 * @param {string} userId
 * @param {Set<string>} idSet
 * @returns {Promise<boolean>}
 */
async function purgeTombstonedRows(table, userId, idSet) {
  const ids = [...idSet].filter(Boolean);
  if (!ids.length) return true;
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) {
      console.error(formatSupabaseError(error, `Purge tombstones in ${table}`));
      return false;
    }
  }
  return true;
}

/**
 * Drop tombstones only after SELECT proves those ids are gone from remote.
 * Never clear just because local upsert omitted them (stale hydrate can reintroduce them).
 * Never clear while hydrate is in flight — that race restores folders without a page reload.
 * @param {string} table
 * @param {string} userId
 * @param {Set<string>} idSet
 */
async function clearTombstonesConfirmedAbsent(table, userId, idSet) {
  if (hydrateInFlight) {
    return;
  }
  const ids = [...idSet].filter(Boolean);
  if (!ids.length) return;
  const CHUNK = 100;
  const stillRemote = new Set();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) {
      console.error(formatSupabaseError(error, `Verify tombstones in ${table}`));
      return;
    }
    for (const row of data || []) {
      if (row?.id) stillRemote.add(row.id);
    }
  }
  const cleared = [];
  const heldForGrace = [];
  const now = Date.now();
  const markedAtMap = table === "campaigns"
    ? deletedDocMarkedAt
    : table === "companies"
      ? deletedCompanyMarkedAt
      : deletedNodeMarkedAt;
  for (const id of ids) {
    if (stillRemote.has(id)) continue;
    // Companies: NEVER auto-clear. A sibling tab / in-flight sync can re-upsert
    // during grace; clearing the tombstone then lets hydrate resurrect forever.
    if (table === "companies") {
      heldForGrace.push(id);
      continue;
    }
    // Missing markedAt ⇒ treat as "just now" so we never clear before grace.
    const markedAt = markedAtMap.get(id);
    if (markedAt == null || now - markedAt < TOMBSTONE_CLEAR_GRACE_MS) {
      heldForGrace.push(id);
      continue;
    }
    idSet.delete(id);
    markedAtMap.delete(id);
    cleared.push(id);
  }
  // #region agent log
  if (table === "companies" && (cleared.length || heldForGrace.length || stillRemote.size)) {
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'040b1a'},body:JSON.stringify({sessionId:'040b1a',runId:'post-fix-v2',hypothesisId:'H-D',location:'persistenceMiddleware.js:clearCompanyTombstones',message:'Company tombstone clear decision',data:{cleared,heldForGrace,stillRemote:[...stillRemote],pendingAfter:[...idSet],neverClearCompanies:true},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  if (cleared.length) {
    const kind = table === "campaigns" ? "docs" : table === "companies" ? "companies" : "nodes";
    removeIdsFromTombstoneLedger(kind, cleared);
    writeTombstoneLedger();
  }
}

/**
 * When the user deletes mid-hydrate, a stale remote payload would union folders
 * back into the live store without a page reload. Keep live ids + never reintroduce
 * remote-only ids while deletes were active.
 * @param {Record<string, object>|null|undefined} hydratedMap
 * @param {Record<string, object>|null|undefined} liveMap
 * @param {Set<string>} pendingIds
 * @param {boolean} deletesHappened
 */
function preferLiveMapAfterMidFlightDeletes(hydratedMap, liveMap, pendingIds, deletesHappened) {
  const hydrated = hydratedMap && typeof hydratedMap === "object" ? hydratedMap : {};
  const live = liveMap && typeof liveMap === "object" ? liveMap : {};
  if (!deletesHappened && pendingIds.size === 0) {
    return omitPendingDeletedIds(hydrated, pendingIds);
  }
  const out = {};
  for (const [id, item] of Object.entries(live)) {
    if (!id || !item || pendingIds.has(id)) continue;
    out[id] = item;
  }
  for (const [id, item] of Object.entries(hydrated)) {
    if (!id || !item || pendingIds.has(id)) continue;
    // Stale remote-only rows (deleted in this session, or never in live after paint+delete).
    if (!(id in live)) continue;
    if (!out[id]) out[id] = item;
  }
  return out;
}

/**
 * Clear tombstones for IDs that are no longer local (remote orphan cleanup succeeded).
 * @deprecated Prefer clearTombstonesConfirmedAbsent — local-absence clear races with stale hydrate.
 * @param {Iterable<string>} localDocIds
 * @param {Iterable<string>} localNodeIds
 */
function clearResolvedDeleteTombstones(localDocIds, localNodeIds) {
  // Intentionally no-op: clearing by local absence allowed stale hydrate to resurrect
  // deleted folders and then re-upsert them to production. Tombstones clear only via
  // clearTombstonesConfirmedAbsent after a remote SELECT proves the rows are gone.
  void localDocIds;
  void localNodeIds;
}

/**
 * Re-load persisted tombstones from disk before applying a hydrate payload.
 */
function refreshTombstonesFromDisk() {
  try {
    restorePendingDeletesFromSnapshot(readLocalWorkspaceSnapshot());
    adoptTombstoneLedger(readTombstoneLedger());
  } catch {
    // ignore
  }
}

function warnSyncOnce(message) {
  const now = Date.now();
  if (now - lastSyncWarnAt < 15_000) return;
  lastSyncWarnAt = now;
  console.warn(message);
}

/**
 * @param {Record<string, unknown>|null|undefined} remoteCadence
 * @param {Record<string, unknown>|null|undefined} localCadence
 */
function mergeObjectCadence(remoteCadence, localCadence) {
  const remote = remoteCadence && typeof remoteCadence === "object" ? remoteCadence : {};
  const local = localCadence && typeof localCadence === "object" ? localCadence : {};
  return {
    ...local,
    ...remote,
    marketHypePanelSaved: remote.marketHypePanelSaved || local.marketHypePanelSaved,
    launchRadarPanelSaved: remote.launchRadarPanelSaved || local.launchRadarPanelSaved,
  };
}

/**
 * Merge Intel panel cadence from localStorage when remote rows omit it.
 * @param {Record<string, object>} objects
 */
function mergeLocalCadenceIntoObjects(objects) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return objects;
    const parsed = JSON.parse(raw);
    const localObjects = parsed?.objects;
    if (!localObjects || typeof localObjects !== "object") return objects;

    const merged = { ...objects };
    for (const [id, localObj] of Object.entries(localObjects)) {
      if (!merged[id]?.cadence && !localObj?.cadence) continue;
      merged[id] = {
        ...merged[id],
        cadence: mergeObjectCadence(merged[id]?.cadence, localObj?.cadence),
      };
    }
    return merged;
  } catch {
    return objects;
  }
}

/**
 * Delete remote rows for this user that are not in localIds.
 * @param {string} table
 * @param {string} userId
 * @param {string[]} localIds
 * @returns {Promise<boolean>} true when select/delete succeeded (or nothing to delete)
 */
async function deleteOrphanRows(table, userId, localIds) {
  const { data: remoteRows, error: selectErr } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.error(formatSupabaseError(selectErr, `Select ${table} for cleanup`));
    return false;
  }

  const localSet = new Set(localIds);
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => id && !localSet.has(id));

  if (!orphanIds.length) return true;

  const { error: deleteErr } = await supabase
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id", orphanIds);

  if (deleteErr) {
    console.error(formatSupabaseError(deleteErr, `Delete orphans in ${table}`));
    return false;
  }
  return true;
}

/**
 * @param {string} action
 * @param {Promise<{ error: unknown }>} promise
 */
async function runUpsert(action, promise) {
  try {
    const { error } = await promise;
    if (error) {
      const msg = formatSupabaseError(error, action);
      console.error(msg);
      if (String(error.message || "").includes("Failed to fetch")) {
        warnSyncOnce(
          "Red o Supabase inaccesible al guardar. Verificá conexión, "
          + "SUPABASE_PROJECT_URL en .env.local, y que el proyecto no esté pausado.",
        );
      }
      return false;
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${action} failed:`, message);
    if (message.includes("Failed to fetch")) {
      warnSyncOnce(
        "Failed to fetch al contactar Supabase. Revisá .env.local, reiniciá `npm run dev`, "
        + "o iniciá sesión de nuevo en /panel.",
      );
    }
    return false;
  }
}

function debounce(fn, delay) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

function normalizeTimelineViewMode(value) {
  return value === "doc-wire" ? "doc-wire" : "folders";
}

function pickTimelineUiState(state) {
  return {
    timelineDocQueue: Array.isArray(state.timelineDocQueue) ? state.timelineDocQueue : [],
    timelineFileQueue: Array.isArray(state.timelineFileQueue) ? state.timelineFileQueue : [],
    timelineDocQueueFocusByDocId: state.timelineDocQueueFocusByDocId || {},
    timelineDocSnapshotsByDocId: state.timelineDocSnapshotsByDocId || {},
    timelineExcludedChildrenByDocId: state.timelineExcludedChildrenByDocId || {},
    timelineAgentSets: Array.isArray(state.timelineAgentSets) ? state.timelineAgentSets : [],
    timelineDateNodeIds: Array.isArray(state.timelineDateNodeIds) ? state.timelineDateNodeIds : [],
    timelineDateSnapshotsById: state.timelineDateSnapshotsById || {},
    timelineGuestLinksById: state.timelineGuestLinksById || {},
    expandedDocIds: Array.isArray(state.expandedDocIds) ? state.expandedDocIds : [],
    primaryTimelineObjectId: state.primaryTimelineObjectId || null,
    timelineViewMode: normalizeTimelineViewMode(state.timelineViewMode),
    currentTier: typeof state.currentTier === "string" ? state.currentTier : "all",
  };
}

function filterTimelineUiToExistingDocs(ui, docIds, nodeIds = []) {
  const docSet = new Set(docIds);
  const nodeSet = new Set(nodeIds);
  const filterMap = (record) => Object.fromEntries(
    Object.entries(record || {}).filter(([docId]) => docSet.has(docId)),
  );
  const guestLinksById = Object.fromEntries(
    Object.entries(ui.timelineGuestLinksById || {}).filter(([, link]) => {
      if (!link) return false;
      // Keep if host still exists (guest strip authority); guest may be soft-absent.
      return Boolean(link.hostDocId && docSet.has(link.hostDocId));
    }),
  );

  return {
    ...ui,
    timelineDocQueue: (ui.timelineDocQueue || []).filter((docId) => docSet.has(docId)),
    timelineFileQueue: filterTimelineFileQueueToExistingNodes(
      ui.timelineFileQueue,
      nodeIds,
    ),
    timelineDocQueueFocusByDocId: filterMap(ui.timelineDocQueueFocusByDocId),
    timelineDocSnapshotsByDocId: filterMap(ui.timelineDocSnapshotsByDocId),
    timelineExcludedChildrenByDocId: filterMap(ui.timelineExcludedChildrenByDocId),
    timelineDateNodeIds: Array.isArray(ui.timelineDateNodeIds) ? ui.timelineDateNodeIds : [],
    timelineDateSnapshotsById: ui.timelineDateSnapshotsById || {},
    timelineGuestLinksById: guestLinksById,
    expandedDocIds: (ui.expandedDocIds || []).filter((docId) => docSet.has(docId)),
  };
}

function emptyWorkspaceSnapshot() {
  return {
    objects: {},
    docs: {},
    nodes: {},
    canvasNodes: {},
    canvasConnections: {},
    groupings: {},
    timelines: {},
    currentTier: "all",
    timelineDocQueue: [],
    timelineFileQueue: [],
    timelineDocQueueFocusByDocId: {},
    timelineDocSnapshotsByDocId: {},
    timelineExcludedChildrenByDocId: {},
    timelineAgentSets: [],
    timelineDateNodeIds: [],
    timelineDateSnapshotsById: {},
    timelineGuestLinksById: {},
    expandedDocIds: [],
    primaryTimelineObjectId: null,
    timelineViewMode: "folders",
    scheduledAutoRunEnabled: true,
    scheduledCompletedTaskKeys: [],
    deletedDocIds: [],
    deletedNodeIds: [],
    deletedCompanyIds: [],
  };
}

/**
 * Restore in-memory tombstones from a persisted snapshot (reload / paint).
 * @param {Record<string, unknown>|null|undefined} data
 */
function restorePendingDeletesFromSnapshot(data) {
  if (!data || typeof data !== "object") return;
  const docs = Array.isArray(data.deletedDocIds) ? data.deletedDocIds : [];
  const nodes = Array.isArray(data.deletedNodeIds) ? data.deletedNodeIds : [];
  const companies = Array.isArray(data.deletedCompanyIds) ? data.deletedCompanyIds : [];
  const now = Date.now();
  for (const id of docs) {
    if (!id) continue;
    pendingDeletedDocIds.add(id);
    if (!deletedDocMarkedAt.has(id)) deletedDocMarkedAt.set(id, now);
  }
  for (const id of nodes) {
    if (!id) continue;
    pendingDeletedNodeIds.add(id);
    if (!deletedNodeMarkedAt.has(id)) deletedNodeMarkedAt.set(id, now);
  }
  for (const id of companies) {
    if (!id) continue;
    pendingDeletedCompanyIds.add(id);
    if (!deletedCompanyMarkedAt.has(id)) deletedCompanyMarkedAt.set(id, now);
  }
}

/**
 * Score how much real workspace content a snapshot holds.
 * Used to avoid wiping a rich localStorage with a stale/empty remote hydrate.
 * @param {Record<string, unknown>|null|undefined} state
 */
function workspaceContentScore(state) {
  if (!state || typeof state !== "object") {
    return { docCount: 0, nodeCount: 0, objectCount: 0, contentChars: 0, maxUpdated: 0 };
  }
  const docs = state.docs && typeof state.docs === "object" ? state.docs : {};
  const nodes = state.nodes && typeof state.nodes === "object" ? state.nodes : {};
  const objects = state.objects && typeof state.objects === "object" ? state.objects : {};

  let contentChars = 0;
  let maxUpdated = 0;

  const bumpUpdated = (value) => {
    const t = Date.parse(String(value || "")) || 0;
    if (t > maxUpdated) maxUpdated = t;
  };

  for (const doc of Object.values(docs)) {
    if (!doc || typeof doc !== "object") continue;
    contentChars += String(doc.body || doc.content || "").length;
    contentChars += String(doc.title || "").length;
    contentChars += String(doc.category || "").length;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    contentChars += tags.join(",").length;
    const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      contentChars += String(block.text || "").length;
      contentChars += String(block.title || "").length;
    }
    bumpUpdated(doc.updatedAt || doc.createdAt);
  }

  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== "object") continue;
    contentChars += nodePersistedContentCharCount(node.content);
    contentChars += String(node.title || "").length;
    bumpUpdated(node.updatedAt || node.createdAt);
  }

  for (const obj of Object.values(objects)) {
    if (!obj || typeof obj !== "object") continue;
    bumpUpdated(obj.updatedAt || obj.createdAt);
  }

  return {
    docCount: Object.keys(docs).length,
    nodeCount: Object.keys(nodes).length,
    objectCount: Object.keys(objects).length,
    contentChars,
    maxUpdated,
  };
}

/**
 * True only when remote looks empty/broken and local must not be wiped.
 * NEVER prefer local just because it has MORE folders — that re-upserts deletes.
 * @param {Record<string, unknown>|null|undefined} local
 * @param {Record<string, unknown>|null|undefined} remote
 */
function isLocalRicherThanRemote(local, remote) {
  const L = workspaceContentScore(local);
  const R = workspaceContentScore(remote);

  if (L.docCount === 0 && L.nodeCount === 0 && L.objectCount === 0) return false;

  // Empty / wiped remote vs non-empty local — classic debounce-miss wipe
  if (R.docCount === 0 && L.docCount > 0) return true;
  if (R.objectCount === 0 && L.objectCount > 0 && R.docCount === 0) return true;
  if (R.nodeCount === 0 && R.docCount === 0 && L.nodeCount > 0) return true;

  return false;
}

/**
 * Merge maps: remote decides which ids exist; local can win field content when both exist.
 * Local-only ids are kept when their wall-clock activity is after lastSyncedAt (unsynced creates)
 * or when shouldKeepLocalOnly says so (e.g. linked folder docs with /code body).
 * Prefer max(updatedAt, createdAt): Created UI uses noon-of-day (isoFromDateInput), which is
 * often ≤ lastSyncedAt even for brand-new rows that still have updatedAt = now.
 * This stops deleted folders in a fat localStorage from resurrecting after purge.
 * @param {Record<string, object>} remoteMap
 * @param {Record<string, object>} localMap
 * @param {(item: object) => number} [contentLen]
 * @param {{ lastSyncedAt?: string|null, allowAllLocalOnly?: boolean, preferRicherContent?: boolean, shouldKeepLocalOnly?: (item: object) => boolean }} [opts]
 */
function mergeMapsWithTombstones(remoteMap, localMap, contentLen, opts = {}) {
  const pendingDeletedIds = new Set([
    ...pendingDeletedDocIds,
    ...pendingDeletedNodeIds,
    ...pendingDeletedCompanyIds,
  ]);
  return mergeEntityMapsPreferNewer(remoteMap, localMap, contentLen, {
    ...opts,
    pendingDeletedIds,
    parseVersionMs,
  });
}

/**
 * Rebuild company.children from docs.parentObjectId after a merge.
 * @param {Record<string, object>} objects
 * @param {Record<string, object>} docs
 */
function rebuildObjectChildren(objects, docs) {
  const next = {};
  for (const [id, obj] of Object.entries(objects || {})) {
    next[id] = { ...obj, children: [] };
  }
  for (const doc of Object.values(docs || {})) {
    const parentId = doc?.parentObjectId;
    if (parentId && next[parentId]) {
      next[parentId].children.push(doc.id);
    }
  }
  return next;
}

/**
 * Merge remote hydrate with localStorage so a stale/empty remote cannot wipe local work.
 * @param {Record<string, unknown>} remoteState
 * @param {Record<string, unknown>|null} localState
 * @returns {{ state: Record<string, unknown>, preferredLocal: boolean }}
 */
function mergeRemoteWithLocalSnapshot(remoteState, localState) {
  if (!localState) {
    return {
      state: stripPendingDeletesFromState(remoteState),
      preferredLocal: false,
    };
  }

  if (isLocalRicherThanRemote(localState, remoteState)) {
    // #region agent log
    {
      const localDocs = localState.docs && typeof localState.docs === "object" ? localState.docs : {};
      const remoteDocs = remoteState.docs && typeof remoteState.docs === "object" ? remoteState.docs : {};
      const scheduleDiffs = Object.keys(localDocs).slice(0, 40).map((id) => {
        const l = localDocs[id];
        const r = remoteDocs[id];
        return {
          id,
          title: l?.title || null,
          localStart: l?.scheduleStartAt || null,
          remoteStart: r?.scheduleStartAt || null,
          localLaunch: l?.launchAt || null,
          remoteLaunch: r?.launchAt || null,
        };
      }).filter((d) => d.localStart || d.remoteStart || d.localLaunch || d.remoteLaunch);
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'C',location:'persistenceMiddleware.js:isLocalRicherThanRemote',message:'Hydrate preferred entire LOCAL workspace',data:{scheduleDiffs},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return {
      state: stripPendingDeletesFromState({
        ...remoteState,
        objects: localState.objects || {},
        docs: localState.docs || {},
        nodes: localState.nodes || {},
        canvasNodes: localState.canvasNodes || remoteState.canvasNodes || {},
        canvasConnections: localState.canvasConnections || remoteState.canvasConnections || {},
        groupings: localState.groupings || remoteState.groupings || {},
        timelines: localState.timelines || remoteState.timelines || {},
      }),
      preferredLocal: true,
    };
  }

  const mergeOpts = { lastSyncedAt: readLastSyncedAt() };

  const docs = mergeMapsWithTombstones(
    remoteState.docs,
    localState.docs,
    (doc) => {
      let n = String(doc?.body || doc?.content || "").length + String(doc?.title || "").length;
      for (const block of Array.isArray(doc?.blocks) ? doc.blocks : []) {
        n += String(block?.text || "").length + String(block?.title || "").length;
      }
      return n;
    },
    mergeOpts,
  );
  const nodes = mergeMapsWithTombstones(
    remoteState.nodes,
    localState.nodes,
    (node) => nodeEntityPersistedContentCharCount(node),
    {
      ...mergeOpts,
      preferRicherContent: true,
      shouldKeepLocalOnly: (node) =>
        nodeHasPersistedContent(node) && isLinkedFolderChildNode(node),
    },
  );
  const objectsRaw = mergeMapsWithTombstones(
    remoteState.objects,
    localState.objects,
    (obj) => String(obj?.name || "").length,
    mergeOpts,
  );

  // Preserve classification fields when remote row is empty/stale but local still has them.
  const localDocs = localState.docs && typeof localState.docs === "object" ? localState.docs : {};
  for (const [id, doc] of Object.entries(docs)) {
    const localDoc = localDocs[id];
    if (!doc || !localDoc) continue;
    const remoteTags = Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [];
    const localTags = Array.isArray(localDoc.tags) ? localDoc.tags.filter(Boolean) : [];
    if (remoteTags.length === 0 && localTags.length > 0) {
      doc.tags = [...localTags];
    }
    if (!String(doc.category || "").trim() && String(localDoc.category || "").trim()) {
      doc.category = localDoc.category;
    }
    if (!doc.parentObjectId && localDoc.parentObjectId) {
      doc.parentObjectId = localDoc.parentObjectId;
    }
    if ((!doc.docKind || doc.docKind === "standard")
      && localDoc.docKind
      && localDoc.docKind !== "standard") {
      doc.docKind = localDoc.docKind;
    }
    // Prefer explicit Launch schedule from local when remote wiped it.
    const beforeLaunch = doc.launchAt || null;
    const beforeStart = doc.scheduleStartAt || null;
    const beforeFinish = doc.scheduleFinishAt || null;
    if (!doc.launchAt && localDoc.launchAt) {
      doc.launchAt = localDoc.launchAt;
    }
    if (!doc.scheduleStartAt && (localDoc.scheduleStartAt || localDoc.launchAt)) {
      doc.scheduleStartAt = localDoc.scheduleStartAt || localDoc.launchAt;
    }
    if (!doc.scheduleFinishAt && (localDoc.scheduleFinishAt || localDoc.scheduleStartAt || localDoc.launchAt)) {
      doc.scheduleFinishAt = localDoc.scheduleFinishAt
        || localDoc.scheduleStartAt
        || localDoc.launchAt;
    }
    // #region agent log
    if ((!beforeStart && doc.scheduleStartAt) || (!beforeFinish && doc.scheduleFinishAt) || (!beforeLaunch && doc.launchAt)) {
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'B',location:'persistenceMiddleware.js:mergeSchedulePreserve',message:'Merge reinjected schedule/launch from local into empty remote',data:{docId:id,title:doc.title||localDoc.title||null,beforeStart,beforeFinish,beforeLaunch,afterStart:doc.scheduleStartAt||null,afterFinish:doc.scheduleFinishAt||null,afterLaunch:doc.launchAt||null,localStart:localDoc.scheduleStartAt||null,localFinish:localDoc.scheduleFinishAt||null,localLaunch:localDoc.launchAt||null,localUpdatedAt:localDoc.updatedAt||null,mergedUpdatedAt:doc.updatedAt||null},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
  }

  // Schedule (anchorAt) always wins — never let a newer remote row without it wipe local.
  const localNodes = localState.nodes && typeof localState.nodes === "object" ? localState.nodes : {};
  for (const [id, node] of Object.entries(nodes)) {
    const localNode = localNodes[id];
    if (!node || !localNode) continue;
    const localAnchor = anchorAtFromPersistedNode(localNode);
    if (!node.anchorAt && localAnchor) {
      node.anchorAt = localAnchor;
    }
    const localFinishAnchor = anchorFinishAtFromPersistedNode(localNode);
    if (!node.anchorFinishAt && localFinishAnchor) {
      node.anchorFinishAt = localFinishAnchor;
    }
  }

  // Re-link nodeIds on docs after merge
  for (const doc of Object.values(docs)) {
    if (doc && typeof doc === "object") doc.nodeIds = [];
  }
  for (const node of Object.values(nodes)) {
    if (node?.parentDocId && docs[node.parentDocId]) {
      docs[node.parentDocId].nodeIds.push(node.id);
    }
  }

  const nodesWithSchedule = backfillNodeAnchorsFromDocs(nodes, docs);

  return {
    state: stripPendingDeletesFromState({
      ...remoteState,
      objects: rebuildObjectChildren(objectsRaw, docs),
      docs,
      nodes: nodesWithSchedule,
      canvasNodes: mergeMapsWithTombstones(
        remoteState.canvasNodes,
        localState.canvasNodes,
        undefined,
        mergeOpts,
      ),
      canvasConnections: mergeMapsWithTombstones(
        remoteState.canvasConnections,
        localState.canvasConnections,
        undefined,
        mergeOpts,
      ),
      groupings: mergeMapsWithTombstones(
        remoteState.groupings,
        localState.groupings,
        undefined,
        mergeOpts,
      ),
      timelines: mergeMapsWithTombstones(
        remoteState.timelines,
        localState.timelines,
        undefined,
        mergeOpts,
      ),
    }),
    preferredLocal: false,
  };
}

function readLocalWorkspaceSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizePersistedSnapshot(parsed);
  } catch {
    return null;
  }
}

let flushPersistenceSyncImpl = async () => ({ ok: true });

export function initPersistenceMiddleware(stores) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const {
    useObjectsStore,
    useDocsStore,
    useNodesStore,
    useCanvasStore,
    useTimelineStore,
  } = stores;

  /**
   * Drop tombstoned docs/nodes/companies from live Zustand stores.
   * Must live inside init so store hooks from `stores` are in scope.
   * @returns {boolean} true if any store changed
   */
  function stripPendingDeletesFromLiveStores() {
    if (
      pendingDeletedDocIds.size === 0
      && pendingDeletedNodeIds.size === 0
      && pendingDeletedCompanyIds.size === 0
    ) {
      return false;
    }
    const docsState = useDocsStore.getState().docs || {};
    const nodesState = useNodesStore.getState().nodes || {};
    const objectsState = useObjectsStore.getState().objects || {};
    const stripped = stripPendingDeletesFromState({
      docs: docsState,
      nodes: nodesState,
      objects: objectsState,
    });
    if (stripped === undefined || stripped === null) return false;
    const docsChanged = stripped.docs !== docsState;
    const nodesChanged = stripped.nodes !== nodesState;
    const objectsChanged = stripped.objects !== objectsState;
    if (!docsChanged && !nodesChanged && !objectsChanged) return false;
    if (docsChanged) useDocsStore.setState({ docs: stripped.docs });
    if (nodesChanged) useNodesStore.setState({ nodes: stripped.nodes });
    if (objectsChanged) {
      useObjectsStore.setState({ objects: stripped.objects || {} });
    }
    return true;
  }

  const getLocalState = () => ({
    objects: useObjectsStore.getState().objects,
    docs: useDocsStore.getState().docs,
    nodes: useNodesStore.getState().nodes,
    canvasNodes: useCanvasStore.getState().canvasNodes,
    canvasConnections: useCanvasStore.getState().canvasConnections,
    groupings: useCanvasStore.getState().groupings,
    timelines: useTimelineStore.getState().timelines,
    currentTier: useTimelineStore.getState().currentTier,
    timelineDocQueue: useTimelineStore.getState().timelineDocQueue,
    timelineFileQueue: useTimelineStore.getState().timelineFileQueue,
    timelineDocQueueFocusByDocId: useTimelineStore.getState().timelineDocQueueFocusByDocId,
    timelineDocSnapshotsByDocId: useTimelineStore.getState().timelineDocSnapshotsByDocId,
    timelineExcludedChildrenByDocId: useTimelineStore.getState().timelineExcludedChildrenByDocId,
    timelineAgentSets: useTimelineStore.getState().timelineAgentSets,
    timelineDateNodeIds: useTimelineStore.getState().timelineDateNodeIds,
    timelineDateSnapshotsById: useTimelineStore.getState().timelineDateSnapshotsById,
    timelineGuestLinksById: useTimelineStore.getState().timelineGuestLinksById,
    expandedDocIds: useTimelineStore.getState().expandedDocIds,
    primaryTimelineObjectId: useTimelineStore.getState().primaryTimelineObjectId,
    timelineViewMode: useTimelineStore.getState().timelineViewMode,
    scheduledAutoRunEnabled: useScheduledTasksStore.getState().autoRunEnabled,
    scheduledCompletedTaskKeys: useScheduledTasksStore.getState().completedTaskKeys,
    deletedDocIds: [...pendingDeletedDocIds],
    deletedNodeIds: [...pendingDeletedNodeIds],
    deletedCompanyIds: [...pendingDeletedCompanyIds],
    // Mirror only — authoritative gate key is LAST_SYNCED_AT_KEY (never bump on local edit).
    lastSyncedAt: readLastSyncedAt(),
  });

  const applyStateToStores = (data) => {
    if (!data) return;
    restorePendingDeletesFromSnapshot(data);
    const stripped = stripPendingDeletesFromState(data);
    const objects = pruneStrayDefaultYo(stripped.objects || {});
    useObjectsStore.setState({ objects });
    const normalizedDocs = {};
    if (stripped.docs) {
      for (const [id, doc] of Object.entries(stripped.docs)) {
        normalizedDocs[id] = normalizeDoc(doc);
      }
    }
    let nodes = stripped.nodes || {};
    const repaired = repairDocNodeLinks(normalizedDocs, nodes);
    if (repaired) {
      for (const [id, doc] of Object.entries(repaired.docs)) {
        normalizedDocs[id] = normalizeDoc(doc);
      }
      nodes = repaired.nodes;
    }
    useDocsStore.setState({ docs: normalizedDocs });
    const normalizedNodes = {};
    for (const [id, node] of Object.entries(nodes || {})) {
      normalizedNodes[id] = node && typeof node === "object"
        ? {
            ...node,
            libraryItems: normalizeFolderLibraryItems(node.libraryItems),
            librarySets: normalizeLibrarySets(node.librarySets),
            promptClasses: normalizePromptClasses(node.promptClasses),
          }
        : node;
    }
    useNodesStore.setState({ nodes: normalizedNodes });
    useCanvasStore.setState({
      canvasNodes: stripped.canvasNodes || {},
      canvasConnections: stripped.canvasConnections || {},
      groupings: stripped.groupings || {},
    });
    if (stripped.timelines) {
      useTimelineStore.setState({
        timelines: stripped.timelines,
        currentTier: stripped.currentTier || "all",
      });
    }
    if (
      Array.isArray(stripped.timelineDocQueue)
      || Array.isArray(stripped.timelineFileQueue)
      || Array.isArray(stripped.timelineDateNodeIds)
      || stripped.timelineGuestLinksById
      || stripped.timelineViewMode
    ) {
      useTimelineStore.setState({
        timelineDocQueue: Array.isArray(stripped.timelineDocQueue) ? stripped.timelineDocQueue : [],
        timelineFileQueue: Array.isArray(stripped.timelineFileQueue) ? stripped.timelineFileQueue : [],
        timelineDocQueueFocusByDocId: stripped.timelineDocQueueFocusByDocId || {},
        timelineDocSnapshotsByDocId: stripped.timelineDocSnapshotsByDocId || {},
        timelineExcludedChildrenByDocId: stripped.timelineExcludedChildrenByDocId || {},
        timelineAgentSets: Array.isArray(stripped.timelineAgentSets) ? stripped.timelineAgentSets : [],
        timelineDateNodeIds: Array.isArray(stripped.timelineDateNodeIds) ? stripped.timelineDateNodeIds : [],
        timelineDateSnapshotsById: stripped.timelineDateSnapshotsById || {},
        timelineGuestLinksById: stripped.timelineGuestLinksById || {},
        expandedDocIds: Array.isArray(stripped.expandedDocIds) ? stripped.expandedDocIds : [],
        primaryTimelineObjectId: stripped.primaryTimelineObjectId || null,
        timelineViewMode: stripped.timelineViewMode === "doc-wire" ? "doc-wire" : "folders",
      });
    }
    if (typeof stripped.scheduledAutoRunEnabled === "boolean"
      || Array.isArray(stripped.scheduledCompletedTaskKeys)) {
      useScheduledTasksStore.setState({
        autoRunEnabled: typeof stripped.scheduledAutoRunEnabled === "boolean"
          ? stripped.scheduledAutoRunEnabled
          : true,
        completedTaskKeys: Array.isArray(stripped.scheduledCompletedTaskKeys)
          ? stripped.scheduledCompletedTaskKeys
          : [],
      });
    }
  };

  const finishWorkspaceHydration = () => {
    const { objects, addObject } = useObjectsStore.getState();
    const pruned = pruneStrayDefaultYo(objects);
    if (pruned !== objects) {
      useObjectsStore.setState({ objects: pruned });
    }
    const nextObjects = useObjectsStore.getState().objects;
    if (Object.keys(nextObjects).length > 0) {
      useUIStateStore.getState().setWorkspaceHydrated(true);
      return;
    }
    if (!findObjectIdByName(nextObjects, "yo")) {
      addObject("yo", "");
    }
    useUIStateStore.getState().setWorkspaceHydrated(true);
  };

  /** Instant UI paint from disk — do not seed default "yo" (remote may still arrive). */
  const paintLocalWorkspace = () => {
    try {
      refreshTombstonesFromDisk();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const data = sanitizePersistedSnapshot(parsed);
        if (data) {
          applyStateToStores(data);
          stripPendingDeletesFromLiveStores();
          useUIStateStore.getState().setWorkspaceHydrated(true);
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
    }
    return false;
  };

  const loadLocalFallback = () => {
    paintLocalWorkspace();
    finishWorkspaceHydration();
  };

  const loadLocalTimelineUiFallback = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return pickTimelineUiState({});
      const parsed = JSON.parse(raw);
      return pickTimelineUiState(parsed || {});
    } catch {
      return pickTimelineUiState({});
    }
  };

  /**
   * @param {{ hydrateOnVersionError?: boolean }} [opts]
   *   hydrateOnVersionError: on boot true (full hydrate if version probe fails);
   *   on tab-focus false (keep local — avoid egress spikes when RPC is down).
   */
  const loadFromSupabase = async (opts = {}) => {
    const { hydrateOnVersionError = true } = opts;
    if (hydrateInFlight) return;
    hydrateInFlight = true;
    const tombstoneRevisionAtStart = deleteTombstoneRevision;
    try {
      const configErr = getSupabaseConfigError();
      if (configErr) {
        console.log(configErr);
        loadLocalFallback();
        return;
      }

      const userId = await resolveSyncUserId();
      if (!userId) {
        console.warn(
          "[futura-nota] No Supabase session — workspace stays in this browser's "
            + "localStorage only (futura-nota-v1). Log in to sync across browsers.",
        );
        loadLocalFallback();
        return;
      }

      const hasPendingDeletes =
        pendingDeletedDocIds.size > 0
        || pendingDeletedNodeIds.size > 0
        || pendingDeletedCompanyIds.size > 0;
      const lastSyncedAt = readLastSyncedAt();
      let remoteVersion = null;
      let versionFetchFailed = false;
      try {
        remoteVersion = await fetchWorkspaceVersion(supabase, userId);
      } catch (versionErr) {
        versionFetchFailed = true;
        console.warn(
          "[futura-nota] Workspace version check failed —",
          hydrateOnVersionError ? "falling through to full hydrate." : "keeping local snapshot.",
          versionErr?.message || versionErr,
        );
      }

      if (
        !versionFetchFailed
        && shouldSkipFullHydrate({
          lastSyncedAt,
          remoteVersion,
          hasPendingDeletes,
        })
      ) {
        stripPendingDeletesFromLiveStores();
        isSyncedWithRemote = true;
        finishWorkspaceHydration();
        console.log(
          "[futura-nota] Version gate: skipped full hydrate (local in sync).",
          { lastSyncedAt, remoteVersion },
        );
        scheduleDocImageDataUrlBackfill();
        return;
      }

      if (versionFetchFailed && !hydrateOnVersionError) {
        stripPendingDeletesFromLiveStores();
        isSyncedWithRemote = true;
        finishWorkspaceHydration();
        scheduleDocImageDataUrlBackfill();
        return;
      }

      const [
        { data: dbCompanies, error: compErr },
        { data: dbCampaigns, error: campErr },
        { data: dbNodes, error: nodeErr },
        { data: dbCanvasNodes, error: cnErr },
        { data: dbCanvasConnections, error: ccErr },
        { data: dbGroupings, error: grpErr },
        { data: dbTimelines, error: tlErr },
      ] = await Promise.all([
        supabase.from("companies").select("*").eq("user_id", userId),
        supabase.from("campaigns").select("*").eq("user_id", userId),
        supabase.from("nodes").select("*").eq("user_id", userId),
        supabase.from("canvas_nodes").select("*").eq("user_id", userId),
        supabase.from("canvas_connections").select("*").eq("user_id", userId),
        supabase.from("groupings").select("*").eq("user_id", userId),
        supabase.from("timelines").select("*").eq("user_id", userId),
      ]);

      if (compErr) throw compErr;
      if (campErr) throw campErr;
      if (nodeErr) throw nodeErr;
      if (cnErr) throw cnErr;
      if (ccErr) throw ccErr;
      if (grpErr) throw grpErr;
      if (tlErr) throw tlErr;

      // Reconstruct objects (companies)
      const objects = {};
      dbCompanies.forEach((co) => {
        objects[co.id] = {
          id: co.id,
          name: co.name,
          description: co.description || co.sector || "",
          brand: co.brand || co.name,
          color: co.color || "mint",
          role: co.role || "satellite",
          children: [],
          cadence: co.cadence && typeof co.cadence === "object" ? co.cadence : {},
          createdAt: co.created_at,
          updatedAt: co.updated_at || co.created_at,
        };
      });

      // Reconstruct docs (campaigns)
      const docs = {};
      dbCampaigns.forEach((camp) => {
        docs[camp.id] = {
          id: camp.id,
          title: camp.name,
          parentObjectId: camp.company_id,
          content: camp.content || "",
          body: camp.body || "",
          blocks: camp.blocks || [],
          dataProperties: camp.data_properties || [],
          tags: camp.tags || [],
          nodeIds: [],
          syncedWithCanvas: camp.campaign_active !== false,
          createdAt: camp.created_at,
          updatedAt: camp.updated_at || camp.created_at,
          docKind: camp.doc_kind || "standard",
          templateKind: camp.template_kind || null,
          templateSubcategoryDocIds: camp.subcategory_doc_ids || [],
          subcategoryDocIds: camp.subcategory_doc_ids || [],
          version: docVersionFromDb(camp.version),
          category: camp.category || "",
          icon: typeof camp.icon === "string" ? camp.icon : "",
          departmentId: typeof camp.department_id === "string" && camp.department_id.trim()
            ? camp.department_id.trim()
            : null,
          launchAt: camp.launch_at || null,
          scheduleStartAt: camp.schedule_start_at || null,
          scheduleFinishAt: camp.schedule_finish_at
            || camp.schedule_start_at
            || null,
          // Match normalizeDoc: only explicit true is a Campaign folder.
          campaignActive: Boolean(camp.campaign_active),
          timelineSourceNodeId: timelineSourceNodeIdFromPersistedDoc(camp),
          sidebarOrder: sidebarOrderFromPersistedDoc(camp),
          nodeLinkColor: camp.node_link_color || "mint",
          viewMode: camp.view_mode === "quick" ? "quick" : "story",
          knowledgeImport: stripKnowledgeImportSidecar(camp.knowledge_import),
          libraryItems: normalizeFolderLibraryItems(camp.library_items),
          promptClasses: normalizePromptClasses(camp.prompt_classes ?? camp.promptClasses),
        };
        if (camp.company_id && objects[camp.company_id]) {
          objects[camp.company_id].children.push(camp.id);
        }
      });
      // #region agent log
      {
        const remoteSchedules = Object.values(docs)
          .filter((d) => d?.scheduleStartAt || d?.scheduleFinishAt || d?.launchAt)
          .slice(0, 30)
          .map((d) => ({
            id: d.id,
            title: d.title,
            scheduleStartAt: d.scheduleStartAt,
            scheduleFinishAt: d.scheduleFinishAt,
            launchAt: d.launchAt,
            updatedAt: d.updatedAt,
          }));
        const clearedRemote = Object.values(docs)
          .filter((d) => !d?.scheduleStartAt && !d?.scheduleFinishAt)
          .length;
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'D',location:'persistenceMiddleware.js:loadFromSupabase:remoteDocs',message:'Remote campaigns schedule snapshot after SELECT',data:{totalDocs:Object.keys(docs).length,clearedRemote,remoteSchedules},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion

      // Reconstruct nodes (schedule lives in reference.anchorAt — no DB column)
      const nodes = {};
      dbNodes.forEach((node) => {
        const reference = node.reference && typeof node.reference === "object" ? node.reference : {};
        const anchorAt = anchorAtFromPersistedNode({ reference, anchorAt: node.anchor_at });
        const anchorFinishAt = anchorFinishAtFromPersistedNode({ reference });
        const persisted = { reference, completed: node.completed, sourceId: node.source_id, objectId: node.object_id };
        const workStatus = statusFromPersistedNode(persisted);
        nodes[node.id] = {
          id: node.id,
          parentDocId: node.parent_doc_id,
          title: node.title,
          dataType: node.data_type,
          content: node.content,
          sourceQuery: node.source_query || "",
          reference,
          anchorAt,
          anchorFinishAt,
          status: workStatus,
          completed: workStatus === "completed",
          campaignStatus: campaignStatusFromPersistedNode({ reference, campaignStatus: node.campaign_status }),
          launchAt: launchAtFromPersistedNode({ reference, launchAt: node.launch_at }),
          windowStartAt: windowStartAtFromPersistedNode({ reference }),
          windowEndAt: windowEndAtFromPersistedNode({ reference }),
          subcategory: subcategoryFromPersistedNode({ reference, subcategory: reference.subcategory, category: reference.category }),
          sourceId: sourceIdFromPersistedNode(persisted),
          objectId: objectIdFromPersistedNode(persisted),
          linkedToCanvas: node.linked_to_canvas || false,
          canvasNodeId: node.canvas_node_id || null,
          libraryItems: normalizeFolderLibraryItems(
            node.library_items !== undefined
              ? node.library_items
              : reference.libraryItems,
          ),
          librarySets: normalizeLibrarySets(
            node.library_sets !== undefined
              ? node.library_sets
              : reference.librarySets,
          ),
          promptClasses: normalizePromptClasses(
            node.prompt_classes !== undefined
              ? node.prompt_classes
              : reference.promptClasses,
          ),
          createdAt: node.created_at,
          updatedAt: node.updated_at,
        };
        if (node.parent_doc_id && docs[node.parent_doc_id]) {
          docs[node.parent_doc_id].nodeIds.push(node.id);
        }
      });

      // Reconstruct canvas nodes
      const canvasNodes = {};
      dbCanvasNodes.forEach((cn) => {
        canvasNodes[cn.id] = {
          id: cn.id,
          nodeId: cn.node_id,
          title: cn.title,
          dataType: cn.data_type,
          content: cn.content,
          x: cn.x_pos,
          y: cn.y_pos,
          hidden: cn.hidden || false,
          selected: cn.selected || false,
        };
      });

      // Reconstruct canvas connections
      const canvasConnections = {};
      dbCanvasConnections.forEach((cc) => {
        canvasConnections[cc.id] = {
          id: cc.id,
          from: cc.from_canvas_node_id || cc.source_id,
          to: cc.to_canvas_node_id || cc.target_id,
          fromCanvasNodeId: cc.from_canvas_node_id || cc.source_id,
          toCanvasNodeId: cc.to_canvas_node_id || cc.target_id,
          createdAt: cc.created_at,
        };
      });

      // Reconstruct groupings
      const groupings = {};
      dbGroupings.forEach((grp) => {
        groupings[grp.id] = {
          id: grp.id,
          name: grp.name,
          canvasNodeIds: grp.canvas_node_ids || [],
          parentDocId: grp.parent_doc_id,
          createdAt: grp.created_at,
        };
      });

      // Reconstruct timelines
      const timelines = {};
      dbTimelines.forEach((tl) => {
        timelines[tl.id] = {
          id: tl.id,
          name: tl.name || tl.title,
          tier: tl.tier,
          entries: tl.entries || [],
          createdAt: tl.created_at,
        };
      });

      const remoteState = {
        objects: mergeLocalCadenceIntoObjects(objects),
        docs,
        nodes,
        canvasNodes,
        canvasConnections,
        groupings,
        timelines,
        currentTier: "all",
      };

      // Re-arm tombstones before merge so remote-only ghosts cannot union back in.
      refreshTombstonesFromDisk();

      const localSnapshot = readLocalWorkspaceSnapshot();
      const { state: hydratedFromDisk, preferredLocal } = mergeRemoteWithLocalSnapshot(
        remoteState,
        localSnapshot,
      );

      // Protect in-memory edits that haven't flushed to localStorage yet (tab switch / re-auth).
      const memorySnapshot = sanitizePersistedSnapshot(getLocalState());
      const { state: hydratedState, preferredLocal: preferredMemory } = mergeRemoteWithLocalSnapshot(
        hydratedFromDisk,
        memorySnapshot,
      );

      if (preferredLocal || preferredMemory) {
        console.warn(
          "[futura-nota] Hydrate kept LOCAL workspace over Supabase "
            + "(local looked richer). If another browser shows old folders, "
            + "clear localStorage key futura-nota-v1 there and reload while logged in.",
          { preferredLocal, preferredMemory },
        );
      }

      const hydratedNodes = backfillNodeAnchorsFromDocs(
        hydratedState.nodes,
        hydratedState.docs,
      );
      // Re-arm tombstones from disk + memory so mid-flight deletes win over stale remote.
      refreshTombstonesFromDisk();
      const liveNow = sanitizePersistedSnapshot(getLocalState());
      restorePendingDeletesFromSnapshot(liveNow);
      const deletesHappened = deleteTombstoneRevision !== tombstoneRevisionAtStart
        || pendingDeletedDocIds.size > 0
        || pendingDeletedNodeIds.size > 0
        || pendingDeletedCompanyIds.size > 0;
      if (deletesHappened) {
        console.warn(
          "[futura-nota] Hydrate saw deletes mid-flight — keeping live folders, ignoring stale remote ghosts.",
          {
            before: tombstoneRevisionAtStart,
            after: deleteTombstoneRevision,
            pendingDocs: [...pendingDeletedDocIds],
            pendingCompanies: [...pendingDeletedCompanyIds],
          },
        );
      }
      const safeDocs = preferLiveMapAfterMidFlightDeletes(
        hydratedState.docs,
        liveNow?.docs,
        pendingDeletedDocIds,
        deletesHappened,
      );
      const safeNodes = preferLiveMapAfterMidFlightDeletes(
        hydratedNodes,
        liveNow?.nodes,
        pendingDeletedNodeIds,
        deletesHappened,
      );
      const safeObjects = preferLiveMapAfterMidFlightDeletes(
        hydratedState.objects,
        liveNow?.objects,
        pendingDeletedCompanyIds,
        deletesHappened,
      );
      const objectsForApply = rebuildObjectChildren(safeObjects, safeDocs);
      // #region agent log
      {
        const pickHd = (map) => Object.values(map || {}).filter((o) => /home\s*depot/i.test(String(o?.name || ""))).map((o) => ({ id: o.id, name: o.name, role: o.role || null }));
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'040b1a'},body:JSON.stringify({sessionId:'040b1a',runId:'post-fix-v2',hypothesisId:'H-C',location:'persistenceMiddleware.js:hydrateObjects',message:'Hydrate Home Depot objects remote vs safe apply',data:{deletesHappened,pendingCompanies:[...pendingDeletedCompanyIds],remoteHd:pickHd(hydratedState.objects),liveHd:pickHd(liveNow?.objects),safeHd:pickHd(safeObjects),applyHd:pickHd(objectsForApply),preferredLocal,preferredMemory},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974ed'},body:JSON.stringify({sessionId:'8974ed',runId:'pre-fix',hypothesisId:'H4',location:'src/stores/middleware/persistenceMiddleware.js:beforeHydrateApply',message:'Comparing hydrate snapshots before store replacement',data:{tabId:DEBUG_TAB_ID,deletesHappened,memory:debugNodeSummaries(memorySnapshot?.nodes),live:debugNodeSummaries(liveNow?.nodes),hydrated:debugNodeSummaries(hydratedNodes),chosen:debugNodeSummaries(safeNodes)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      applyStateToStores({
        ...hydratedState,
        objects: objectsForApply,
        docs: safeDocs,
        nodes: safeNodes,
      });

      finishWorkspaceHydration();

      // Tombstones can clear now that hydrate has applied without resurrecting.
      if (
        pendingDeletedDocIds.size
        || pendingDeletedNodeIds.size
        || pendingDeletedCompanyIds.size
      ) {
        await clearTombstonesConfirmedAbsent("campaigns", userId, pendingDeletedDocIds);
        await clearTombstonesConfirmedAbsent("nodes", userId, pendingDeletedNodeIds);
        await clearTombstonesConfirmedAbsent("companies", userId, pendingDeletedCompanyIds);
      }

      const docIds = Object.keys(useDocsStore.getState().docs || {});
      const nodeIds = Object.keys(useNodesStore.getState().nodes || {});
      let timelineUi = pickTimelineUiState(loadLocalTimelineUiFallback());
      try {
        const { data: timelineUiRow, error: timelineUiErr } = await supabase
          .from("user_timeline_ui")
          .select("payload")
          .eq("user_id", userId)
          .maybeSingle();
        if (!timelineUiErr && timelineUiRow?.payload && typeof timelineUiRow.payload === "object") {
          timelineUi = {
            ...timelineUi,
            ...timelineUiRow.payload,
          };
        } else if (timelineUiErr && !String(timelineUiErr.message || "").includes("does not exist")) {
          console.warn("Timeline UI load:", timelineUiErr.message);
        }
      } catch (timelineUiLoadErr) {
        console.warn("Timeline UI load failed — using local snapshot.", timelineUiLoadErr);
      }

      const filteredTimelineUi = filterTimelineUiToExistingDocs(timelineUi, docIds, nodeIds);
      const liveFileQueue = useTimelineStore.getState().timelineFileQueue || [];
      const localFileQueue = loadLocalTimelineUiFallback().timelineFileQueue || [];
      const mergedFileQueue = mergeTimelineFileQueues(
        liveFileQueue,
        localFileQueue,
        filteredTimelineUi.timelineFileQueue,
      );
      useTimelineStore.setState({
        timelineDocQueue: filteredTimelineUi.timelineDocQueue,
        timelineFileQueue: mergedFileQueue,
        timelineDocQueueFocusByDocId: filteredTimelineUi.timelineDocQueueFocusByDocId,
        timelineDocSnapshotsByDocId: filteredTimelineUi.timelineDocSnapshotsByDocId,
        timelineExcludedChildrenByDocId: filteredTimelineUi.timelineExcludedChildrenByDocId,
        timelineAgentSets: filteredTimelineUi.timelineAgentSets,
        timelineDateNodeIds: filteredTimelineUi.timelineDateNodeIds,
        timelineDateSnapshotsById: filteredTimelineUi.timelineDateSnapshotsById || {},
        timelineGuestLinksById: filteredTimelineUi.timelineGuestLinksById || {},
        expandedDocIds: filteredTimelineUi.expandedDocIds,
        primaryTimelineObjectId: filteredTimelineUi.primaryTimelineObjectId,
        timelineViewMode: filteredTimelineUi.timelineViewMode,
        currentTier: filteredTimelineUi.currentTier,
        tier: filteredTimelineUi.currentTier,
      });

      isSyncedWithRemote = true;
      console.log("Supabase sync loaded for user:", userId);
      finishWorkspaceHydration();
      const hydratedVersion =
        maxUpdatedAtFromRows([
          ...(dbCompanies || []),
          ...(dbCampaigns || []),
          ...(dbNodes || []),
          ...(dbCanvasNodes || []),
          ...(dbCanvasConnections || []),
          ...(dbGroupings || []),
          ...(dbTimelines || []),
        ]) || remoteVersion;
      if (hydratedVersion) {
        writeLastSyncedAt(hydratedVersion);
      }
      const finalState = getLocalState();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalState));
      } catch {
        // private mode / quota
      }

      // Only push when remote was empty/broken — never when local merely had MORE folders
      // (that path re-upserted intentionally deleted campaigns).
      if (preferredLocal || preferredMemory) {
        console.warn(
          "[futura-nota] Pushing local workspace because remote looked empty/wiped.",
        );
        syncToSupabase(finalState).catch((err) => {
          console.warn("Failed to push preferred-local workspace to Supabase:", err);
        });
      }
      scheduleDocImageDataUrlBackfill();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("Supabase load failed — falling back to localStorage.", message);
      if (message.includes("Failed to fetch")) {
        warnSyncOnce(
          "No se pudo cargar desde Supabase (Failed to fetch). "
          + "Usando localStorage. Revisá SUPABASE_PROJECT_URL y reiniciá `npm run dev`.",
        );
      }
      loadLocalFallback();
    } finally {
      hydrateInFlight = false;
      useUIStateStore.getState().setWorkspaceHydrated(true);
    }
  };

  const syncToSupabase = async (_stateArg) => {
    if (!isSyncedWithRemote) return true;

    if (syncInFlight) {
      syncNeedsRerun = true;
      try {
        await syncInFlight;
      } catch {
        // prior sync logged its own error
      }
      // If the in-flight run already consumed the rerun flag, we are done; otherwise
      // start a fresh live sync (covers the race where the flag was set too late).
      if (syncInFlight) return syncInFlight;
      return syncToSupabase();
    }

    const runSync = async () => {
      let criticalOk = true;
      do {
        syncNeedsRerun = false;

        const userId = await resolveSyncUserId();
        if (!userId) {
          warnSyncOnce(
            "No authenticated user — skipping Supabase sync. "
            + "Iniciá sesión de nuevo en /login (el token no está disponible para writes).",
          );
          return false;
        }

        // Re-arm tombstones from disk before every write (cross-tab / mid-await races).
        refreshTombstonesFromDisk();
        // Freeze delete sets for this iteration so awaits cannot let a resurrected
        // row sneak into an upsert that was planned while the id was pending.
        const frozenDeletedCompanyIds = new Set(pendingDeletedCompanyIds);
        const frozenDeletedDocIds = new Set(pendingDeletedDocIds);
        const frozenDeletedNodeIds = new Set(pendingDeletedNodeIds);
        const state = stripPendingDeletesFromState(getLocalState());


    try {
      const now = new Date().toISOString();
      const upsertOpts = { onConflict: "id" };

      // Companies upsert is deferred until AFTER campaigns/nodes so an in-flight
      // sync that started before a delete cannot re-upsert a tombstoned corpus
      // at the top of the loop, then lose the race to orphan cleanup.

      // 1. Campaigns (folders = doc_kind content)
      const campaignsRows = Object.values(state.docs || {})
        .filter((doc) => doc?.id && !frozenDeletedDocIds.has(doc.id))
        .map((doc) => ({
        id: doc.id,
        user_id: userId,
        company_id: doc.parentObjectId,
        name: doc.title,
        source: doc.knowledgeImport?.sourceUrl || "",
        verification_score: docVersionToDbInt(doc.version) ?? 0,
        content: doc.content || "",
        body: doc.body || "",
        blocks: doc.blocks || [],
        data_properties: doc.dataProperties || [],
        tags: doc.tags || [],
        doc_kind: doc.docKind || "standard",
        template_kind: doc.templateKind || null,
        subcategory_doc_ids: doc.subcategoryDocIds || [],
        version: docVersionToDbInt(doc.version),
        // DB column is VARCHAR(50) — truncate so one long category cannot fail the whole upsert batch.
        category: String(doc.category || "").slice(0, 50),
        icon: typeof doc.icon === "string" && doc.icon.trim() ? doc.icon : null,
        department_id: typeof doc.departmentId === "string" && doc.departmentId.trim()
          ? doc.departmentId.trim()
          : null,
        // Keep Launch and Schedule as separate columns — never write schedule into launch_at.
        launch_at: doc.launchAt || null,
        schedule_start_at: doc.scheduleStartAt || null,
        schedule_finish_at: doc.scheduleFinishAt
          || doc.scheduleStartAt
          || null,
        campaign_active: Boolean(doc.campaignActive),
        node_link_color: doc.nodeLinkColor || "mint",
        view_mode: doc.viewMode === "quick" ? "quick" : "story",
        knowledge_import: knowledgeImportWithTimelineSource(doc),
        library_items: normalizeFolderLibraryItems(doc.libraryItems),
        prompt_classes: normalizePromptClasses(doc.promptClasses),
        created_at: doc.createdAt || now,
        updated_at: doc.updatedAt || now,
      }));

      const campaignLocalIds = campaignsRows.map((r) => r.id);
      // #region agent log
      {
        const scheduleRows = campaignsRows
          .filter((r) => r.schedule_start_at || r.schedule_finish_at || r.launch_at || true)
          .slice(0, 30)
          .map((r) => ({
            id: r.id,
            name: r.name,
            schedule_start_at: r.schedule_start_at,
            schedule_finish_at: r.schedule_finish_at,
            launch_at: r.launch_at,
            updated_at: r.updated_at,
            cleared: !r.schedule_start_at && !r.schedule_finish_at,
          }));
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'D',location:'persistenceMiddleware.js:syncCampaignsUpsert',message:'Upserting campaigns schedule fields to Supabase',data:{rowCount:campaignsRows.length,scheduleRows},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      // Empty local = intentional wipe (last folder deleted) → orphan-delete still runs.
      let campaignsUpsertOk = true;
      if (campaignsRows.length > 0) {
        campaignsUpsertOk = await runUpsert(
          "Upsert campaigns",
          supabase.from("campaigns").upsert(campaignsRows, upsertOpts),
        );
        if (!campaignsUpsertOk) {
          criticalOk = false;
          console.error(
            "Upsert campaigns failed — skipping orphan delete to avoid wiping remote folders",
            { attemptedCount: campaignsRows.length },
          );
        }
      }
      const campaignsOrphansOk = campaignsUpsertOk
        ? await deleteOrphanRows("campaigns", userId, campaignLocalIds)
        : false;
      // Explicitly DELETE tombstoned folders even if orphan select glitches.
      const campaignsTombstoneOk = campaignsUpsertOk
        ? await purgeTombstonedRows("campaigns", userId, pendingDeletedDocIds)
        : false;
      if (pendingDeletedDocIds.size > 0 && !campaignsTombstoneOk) {
        criticalOk = false;
        console.error(
          "Purge tombstoned campaigns failed — deletes may resurrect until purge succeeds",
          { pending: [...pendingDeletedDocIds] },
        );
      }

      // 3. Nodes — persist Schedule in reference.anchorAt (JSONB)
      const nodesRows = Object.values(state.nodes || {})
        .filter((node) => node?.id && !frozenDeletedNodeIds.has(node.id))
        .map((node) => ({
        id: node.id,
        user_id: userId,
        parent_doc_id: node.parentDocId,
        title: node.title,
        data_type: node.dataType,
        content: node.content,
        source_query: node.sourceQuery || "",
        reference: referenceWithNodeMeta(node),
        linked_to_canvas: node.linkedToCanvas || false,
        canvas_node_id: node.canvasNodeId || null,
        library_items: normalizeFolderLibraryItems(node.libraryItems),
        library_sets: normalizeLibrarySets(node.librarySets),
        prompt_classes: normalizePromptClasses(node.promptClasses),
        created_at: node.createdAt || now,
        updated_at: node.updatedAt || now,
      }));

      const nodeLocalIds = nodesRows.map((r) => r.id);
      let nodesUpsertOk = true;
      if (nodesRows.length > 0) {
        // #region agent log
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974ed'},body:JSON.stringify({sessionId:'8974ed',runId:'pre-fix',hypothesisId:'H2-H3',location:'src/stores/middleware/persistenceMiddleware.js:beforeNodesUpsert',message:'Cloud node upsert starting',data:{tabId:DEBUG_TAB_ID,nodes:debugNodeSummaries(state.nodes),count:nodesRows.length,visibility:document.visibilityState},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        nodesUpsertOk = await runUpsert(
          "Upsert nodes",
          supabase.from("nodes").upsert(nodesRows, upsertOpts),
        );
        // #region agent log
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974ed'},body:JSON.stringify({sessionId:'8974ed',runId:'pre-fix',hypothesisId:'H3',location:'src/stores/middleware/persistenceMiddleware.js:afterNodesUpsert',message:'Cloud node upsert finished',data:{tabId:DEBUG_TAB_ID,ok:Boolean(nodesUpsertOk),count:nodesRows.length,visibility:document.visibilityState},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!nodesUpsertOk) criticalOk = false;
      }
      const nodesOrphansOk = nodesUpsertOk
        ? await deleteOrphanRows("nodes", userId, nodeLocalIds)
        : false;
      const nodesTombstoneOk = nodesUpsertOk
        ? await purgeTombstonedRows("nodes", userId, pendingDeletedNodeIds)
        : false;
      if (pendingDeletedNodeIds.size > 0 && !nodesTombstoneOk) {
        criticalOk = false;
        console.error(
          "Purge tombstoned nodes failed — deleted docs may resurrect until purge succeeds",
          { pending: [...pendingDeletedNodeIds] },
        );
      }

      // Only drop tombstones after remote SELECT proves the rows are gone.
      if (campaignsOrphansOk && campaignsTombstoneOk) {
        await clearTombstonesConfirmedAbsent("campaigns", userId, pendingDeletedDocIds);
      }
      if (nodesOrphansOk && nodesTombstoneOk) {
        await clearTombstonesConfirmedAbsent("nodes", userId, pendingDeletedNodeIds);
      }

      // Companies last: re-arm tombstones + live strip so mid-flight deletes win.
      refreshTombstonesFromDisk();
      for (const id of pendingDeletedCompanyIds) frozenDeletedCompanyIds.add(id);
      const liveCompaniesState = stripPendingDeletesFromState(getLocalState());
      const companiesRows = Object.values(liveCompaniesState.objects || {})
        .filter((co) => co?.id && !frozenDeletedCompanyIds.has(co.id))
        .map((co) => ({
        id: co.id,
        user_id: userId,
        name: co.name,
        sector: co.description || "",
        description: co.description || "",
        brand: co.brand || co.name,
        color: co.color || "mint",
        role: co.role || "satellite",
        cadence: co.cadence && typeof co.cadence === "object" ? co.cadence : {},
        created_at: co.createdAt || now,
        updated_at: now,
      }));

      let companiesUpsertOk = true;
      if (companiesRows.length > 0) {
        companiesUpsertOk = await runUpsert(
          "Upsert companies",
          supabase.from("companies").upsert(companiesRows, upsertOpts),
        );
        if (!companiesUpsertOk) {
          criticalOk = false;
          console.error(
            "Upsert companies failed — skipping orphan delete to avoid wiping remote corpora",
            { attemptedCount: companiesRows.length },
          );
        }
      }

      // Empty local = last corpus deleted → orphan-delete still runs.
      const companyLocalIds = companiesRows.map((r) => r.id);
      const companiesOrphansOk = companiesUpsertOk
        ? await deleteOrphanRows("companies", userId, companyLocalIds)
        : false;
      const companiesTombstoneOk = companiesUpsertOk
        ? await purgeTombstonedRows("companies", userId, frozenDeletedCompanyIds)
        : false;
      // #region agent log
      {
        const hdUpsert = companiesRows.filter((r) => /home\s*depot/i.test(String(r.name || "")));
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'040b1a'},body:JSON.stringify({sessionId:'040b1a',runId:'post-fix-v2',hypothesisId:'H-B',location:'persistenceMiddleware.js:companiesPurge',message:'Companies upsert/orphan/tombstone purge result',data:{companiesUpsertOk,companiesOrphansOk,companiesTombstoneOk,pendingCompanies:[...pendingDeletedCompanyIds],frozenCompanies:[...frozenDeletedCompanyIds],homeDepotStillInUpsert:hdUpsert.map((r)=>({id:r.id,name:r.name,role:r.role})),companyLocalIdsCount:companyLocalIds.length},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      if (pendingDeletedCompanyIds.size > 0 && !companiesTombstoneOk) {
        criticalOk = false;
        console.error(
          "Purge tombstoned companies failed — deleted corpora may resurrect until purge succeeds",
          { pending: [...pendingDeletedCompanyIds] },
        );
      }
      if (companiesOrphansOk && companiesTombstoneOk) {
        await clearTombstonesConfirmedAbsent("companies", userId, pendingDeletedCompanyIds);
      }

      // 4. Canvas nodes
      const canvasNodesRows = Object.values(state.canvasNodes).map((cn) => ({
        id: cn.id,
        user_id: userId,
        campaign_id: useDocsStore.getState().getDoc?.(
          useNodesStore.getState().getNode?.(cn.nodeId)?.parentDocId
        )?.id || Object.keys(state.docs)[0] || null,
        title: cn.title,
        data_type: cn.dataType || "text",
        content: cn.content,
        x_pos: cn.x,
        y_pos: cn.y,
        color_theme: cn.colorTheme || "mint",
        node_id: cn.nodeId,
        hidden: cn.hidden || false,
        selected: cn.selected || false,
        created_at: now,
        updated_at: now,
      }));

      if (canvasNodesRows.length > 0) {
        const ok = await runUpsert(
          "Upsert canvas_nodes",
          supabase.from("canvas_nodes").upsert(canvasNodesRows, upsertOpts),
        );
        if (ok) {
          await deleteOrphanRows("canvas_nodes", userId, canvasNodesRows.map((r) => r.id));
        }
      }

      // 5. Canvas connections
      const connectionsRows = Object.values(state.canvasConnections).map((cc) => ({
        id: cc.id,
        user_id: userId,
        campaign_id: Object.keys(state.docs)[0] || null,
        source_id: cc.from || cc.fromCanvasNodeId,
        target_id: cc.to || cc.toCanvasNodeId,
        from_canvas_node_id: cc.from || cc.fromCanvasNodeId,
        to_canvas_node_id: cc.to || cc.toCanvasNodeId,
        created_at: cc.createdAt || now,
        updated_at: now,
      }));

      if (connectionsRows.length > 0) {
        const ok = await runUpsert(
          "Upsert canvas_connections",
          supabase.from("canvas_connections").upsert(connectionsRows, upsertOpts),
        );
        if (ok) {
          await deleteOrphanRows("canvas_connections", userId, connectionsRows.map((r) => r.id));
        }
      }

      // 6. Groupings
      const groupingsRows = Object.values(state.groupings).map((grp) => ({
        id: grp.id,
        user_id: userId,
        name: grp.name,
        canvas_node_ids: grp.canvasNodeIds || [],
        parent_doc_id: grp.parentDocId,
        created_at: grp.createdAt || now,
        updated_at: now,
      }));

      if (groupingsRows.length > 0) {
        const ok = await runUpsert(
          "Upsert groupings",
          supabase.from("groupings").upsert(groupingsRows, upsertOpts),
        );
        if (ok) {
          await deleteOrphanRows("groupings", userId, groupingsRows.map((r) => r.id));
        }
      }

      // 7. Timelines
      const timelinesRows = Object.values(state.timelines).map((tl) => ({
        id: tl.id,
        user_id: userId,
        campaign_id: Object.keys(state.docs)[0] || null,
        title: tl.name || tl.title,
        name: tl.name || tl.title,
        target_date: tl.entries?.[0]?.date
          ? tl.entries[0].date.split("T")[0]
          : now.split("T")[0],
        tier: tl.tier || "primary",
        entries: tl.entries || [],
        created_at: tl.createdAt || now,
        updated_at: now,
      }));

      if (timelinesRows.length > 0) {
        const ok = await runUpsert(
          "Upsert timelines",
          supabase.from("timelines").upsert(timelinesRows, upsertOpts),
        );
        if (ok) {
          await deleteOrphanRows("timelines", userId, timelinesRows.map((r) => r.id));
        }
      }

      const timelineUiPayload = pickTimelineUiState(state);
      const timelineUiOk = await runUpsert(
        "Upsert user_timeline_ui",
        supabase.from("user_timeline_ui").upsert({
          user_id: userId,
          payload: timelineUiPayload,
          updated_at: now,
        }, { onConflict: "user_id" }),
      );
      if (!timelineUiOk) {
        warnSyncOnce(
          "No se pudo guardar la cola del timeline en Supabase. "
          + "Ejecutá supabase_timeline_ui_state.sql en el SQL editor.",
        );
      }

      if (criticalOk) {
        // Gate token only after a confirmed cloud write (not on local edit alone).
        writeLastSyncedAt(now);
        console.log("Supabase sync complete for user:", userId);
      } else {
        console.warn("Supabase sync finished with critical upsert failures for user:", userId);
      }
    } catch (err) {
      criticalOk = false;
      console.error("Supabase write failed:", err.message || err);
    }
      } while (syncNeedsRerun);
      return criticalOk;
    };

    syncInFlight = runSync().finally(() => {
      syncInFlight = null;
    });
    return await syncInFlight;
  };

  const debouncedRemoteSync = debounce(syncToSupabase, 1500);

  flushPersistenceSyncImpl = async () => {
    debouncedRemoteSync.cancel();
    const currentState = getLocalState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch {
      // quota / private mode
    }
    const userId = await resolveSyncUserId();
    if (!userId) {
      lastCloudFlushOk = false;
      return { ok: false, reason: "no_user" };
    }
    isSyncedWithRemote = true;
    try {
      const syncOk = await syncToSupabase(currentState);
      const ok = syncOk !== false;
      lastCloudFlushOk = ok;
      if (!ok) {
        console.error(
          "Cloud flush failed: required upsert (companies/campaigns/nodes) did not succeed",
        );
      }
      return { ok };
    } catch (err) {
      lastCloudFlushOk = false;
      console.error("Cloud flush failed:", err?.message || err);
      return { ok: false, error: err };
    }
  };

  /** Sync localStorage + kick remote write without awaiting (safe for unload). */
  const flushPersistenceSyncBestEffort = () => {
    debouncedRemoteSync.cancel();
    const currentState = getLocalState();
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974ed'},body:JSON.stringify({sessionId:'8974ed',runId:'pre-fix',hypothesisId:'H2-H3',location:'src/stores/middleware/persistenceMiddleware.js:flushBestEffort',message:'Lifecycle flush requested',data:{tabId:DEBUG_TAB_ID,visibility:document.visibilityState,isSyncedWithRemote,nodes:debugNodeSummaries(currentState.nodes)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch {
      // quota / private mode
    }
    if (!isSyncedWithRemote) return;
    syncToSupabase(currentState).catch((err) => {
      console.warn("Unload flush to Supabase failed:", err);
    });
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushPersistenceSyncBestEffort();
      return;
    }
    // Tab visible again: version-gated re-check (no full SELECT * if unchanged).
    if (isSyncedWithRemote && !hydrateInFlight) {
      loadFromSupabase({ hydrateOnVersionError: false }).catch((err) => {
        console.warn("Version-gated focus hydrate failed:", err?.message || err);
      });
    }
  };

  window.addEventListener("pagehide", flushPersistenceSyncBestEffort);
  window.addEventListener("beforeunload", flushPersistenceSyncBestEffort);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Adopt delete ledger BEFORE paint so tombstoned corpora/folders never flash
  // back from futura-nota-v1 and cannot be re-upserted on version-gate skip.
  adoptTombstoneLedger(readTombstoneLedger());
  paintLocalWorkspace();
  if (stripPendingDeletesFromLiveStores()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalState()));
    } catch {
      // quota / private mode
    }
  }
  loadFromSupabase();

  // Sibling /app tabs: adopt delete ledger so they stop re-upserting ghost folders.
  window.addEventListener("storage", (event) => {
    if (event.key !== TOMBSTONE_LEDGER_KEY || !event.newValue) return;
    let ledger = null;
    try {
      ledger = JSON.parse(event.newValue);
    } catch {
      return;
    }
    if (!adoptTombstoneLedger(ledger)) return;
    if (stripPendingDeletesFromLiveStores()) {
      debouncedRemoteSync();
    }
  });

  // Escuchar cambios de sesión — recargar solo en login real, no en cada refresh de token
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      // Initial boot already called loadFromSupabase(); skip duplicate wipe on auth echo.
      if (isSyncedWithRemote || hydrateInFlight) return;
      loadFromSupabase();
    }
    if (event === "SIGNED_OUT") {
      isSyncedWithRemote = false;
      pendingDeletedDocIds.clear();
      pendingDeletedNodeIds.clear();
      pendingDeletedCompanyIds.clear();
      deletedDocMarkedAt.clear();
      deletedNodeMarkedAt.clear();
      deletedCompanyMarkedAt.clear();
      clearLastSyncedAt();
      try {
        localStorage.removeItem(TOMBSTONE_LEDGER_KEY);
      } catch {
        // private mode / quota
      }
      debouncedRemoteSync.cancel();
      // Keep local workspace if the last cloud flush failed — otherwise a new folder
      // that only lived in localStorage would be wiped before it ever reached Supabase.
      if (!lastCloudFlushOk) {
        console.warn(
          "SIGNED_OUT: skipping workspace wipe — last cloud flush did not confirm sync",
        );
        useUIStateStore.getState().setWorkspaceHydrated(true);
        return;
      }
      useUIStateStore.getState().setWorkspaceHydrated(false);
      const empty = emptyWorkspaceSnapshot();
      applyStateToStores(empty);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      } catch {
        // private mode / quota
      }
      try {
        localStorage.removeItem("futura-nota-left-panel-v1");
      } catch {
        // private mode / quota
      }
      useUIStateStore.getState().setWorkspaceHydrated(true);
    }
  });

  const handleStoreChange = () => {
    refreshTombstonesFromDisk();
    stripPendingDeletesFromLiveStores();
    const currentState = stripPendingDeletesFromState(getLocalState());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      // quota / private mode
    }
    debouncedRemoteSync(currentState);
  };

  [
    useObjectsStore,
    useDocsStore,
    useNodesStore,
    useCanvasStore,
    useTimelineStore,
    useScheduledTasksStore,
  ].forEach((store) => {
    store.subscribe(handleStoreChange);
  });
}

export { STORAGE_KEY, TOMBSTONE_LEDGER_KEY };

/** @returns {Promise<{ ok: boolean, reason?: string, error?: unknown }>} */
export async function flushPersistenceSync() {
  return flushPersistenceSyncImpl();
}