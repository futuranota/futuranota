import { supabase, getSupabaseConfigError, formatSupabaseError } from "../../lib/supabaseClient.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import { sanitizePersistedSnapshot, pruneStrayDefaultYo, findObjectIdByName } from "../../lib/storeSanitize.js";
import { repairDocNodeLinks } from "../../lib/resolveDocBlockNodes.js";
import { useScheduledTasksStore } from "../scheduledTasksStore.js";
import { useUIStateStore } from "../uiStateStore.js";

const STORAGE_KEY = "futura-nota-v1";
/** Cross-tab delete ledger — other open /app tabs must not re-upsert ghost folders. */
const TOMBSTONE_LEDGER_KEY = "futura-nota-deleted-v1";
/** Keep tombstones after remote SELECT says gone so a sibling tab cannot race-reupsert. */
const TOMBSTONE_CLEAR_GRACE_MS = 15_000;

/** Pack schedule + status meta into nodes.reference JSONB (no dedicated DB columns). */
function referenceWithNodeMeta(node) {
  const base = node?.reference && typeof node.reference === "object" ? { ...node.reference } : {};
  const anchorAt = node?.anchorAt || base.anchorAt || null;
  if (anchorAt) base.anchorAt = anchorAt;
  else delete base.anchorAt;

  if (node?.completed) base.completed = true;
  else delete base.completed;

  const sourceId = node?.sourceId || null;
  if (sourceId) base.sourceId = sourceId;
  else delete base.sourceId;

  return base;
}

/** Read schedule from reference payload or legacy top-level field. */
function anchorAtFromPersistedNode(node) {
  if (!node) return null;
  if (node.anchorAt) return node.anchorAt;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.anchorAt) return ref.anchorAt;
  return null;
}

function completedFromPersistedNode(node) {
  if (!node) return false;
  if (node.completed != null) return Boolean(node.completed);
  const ref = node.reference;
  if (ref && typeof ref === "object") return Boolean(ref.completed);
  return false;
}

function sourceIdFromPersistedNode(node) {
  if (!node) return null;
  if (node.sourceId) return node.sourceId;
  const ref = node.reference;
  if (ref && typeof ref === "object" && ref.sourceId) return ref.sourceId;
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
      next[nodeId] = { ...next[nodeId], anchorAt: iso };
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

/** Doc/node IDs deleted locally that hydrate must not resurrect until remote orphan cleanup lands. */
const pendingDeletedDocIds = new Set();
const pendingDeletedNodeIds = new Set();
/** When each id was tombstoned — used for clear grace against cross-tab upsert races. */
const deletedDocMarkedAt = new Map();
const deletedNodeMarkedAt = new Map();
/** Bumps whenever a folder/node is tombstoned — hydrate uses this to re-strip mid-flight deletes. */
let deleteTombstoneRevision = 0;

/**
 * Broadcast delete tombstones so every open tab stops upserting those ids.
 * Ledger is union-only on adopt; clearing only shrinks this tab's write.
 */
function writeTombstoneLedger() {
  if (typeof localStorage === "undefined") return;
  try {
    const payload = {
      docs: [...pendingDeletedDocIds],
      nodes: [...pendingDeletedNodeIds],
      revision: deleteTombstoneRevision,
      updatedAt: Date.now(),
    };
    localStorage.setItem(TOMBSTONE_LEDGER_KEY, JSON.stringify(payload));
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
  // #region agent log
  fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'post-fix',hypothesisId:'H1',location:'persistenceMiddleware.js:markDocsDeletedForSync',message:'tombstone set',data:{docIds:docs.filter(Boolean),nodeIds:nodes.filter(Boolean),pendingDocs:[...pendingDeletedDocIds],revision:deleteTombstoneRevision,hydrateInFlight},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  if (pendingDeletedDocIds.size > 0) {
    const before = Object.keys(state.docs || {});
    const after = Object.keys(docs || {});
    const stripped = before.filter((id) => pendingDeletedDocIds.has(id) && !after.includes(id));
    const stillPresent = before.filter((id) => pendingDeletedDocIds.has(id) && after.includes(id));
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'79f8b7'},body:JSON.stringify({sessionId:'79f8b7',runId:'pre-fix',hypothesisId:'C',location:'persistenceMiddleware.js:stripPendingDeletesFromState',message:'strip pending deletes',data:{pendingDocs:[...pendingDeletedDocIds],stripped,stillPresent,docCountBefore:before.length,docCountAfter:after.length},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  if (docs === state.docs && nodes === state.nodes) return state;

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

  const next = { ...state, docs, nodes };
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
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'79f8b7'},body:JSON.stringify({sessionId:'79f8b7',runId:'post-fix',hypothesisId:'B',location:'persistenceMiddleware.js:clearTombstonesConfirmedAbsent',message:'skip clear — hydrate in flight',data:{table,pending:[...idSet]},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  const markedAtMap = table === "campaigns" ? deletedDocMarkedAt : deletedNodeMarkedAt;
  for (const id of ids) {
    if (stillRemote.has(id)) continue;
    const markedAt = markedAtMap.get(id) || 0;
    if (now - markedAt < TOMBSTONE_CLEAR_GRACE_MS) {
      heldForGrace.push(id);
      continue;
    }
    idSet.delete(id);
    markedAtMap.delete(id);
    cleared.push(id);
  }
  if (cleared.length) writeTombstoneLedger();
  // #region agent log
  if (cleared.length || stillRemote.size || heldForGrace.length) {
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'post-fix',hypothesisId:'H4',location:'persistenceMiddleware.js:clearTombstonesConfirmedAbsent',message:'tombstones verified against remote',data:{table,cleared,heldForGrace,stillRemote:[...stillRemote],remaining:[...idSet]},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
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
 * Ensure we have a fresh authenticated session before writes.
 * @returns {Promise<string|null>} user id or null
 */
async function resolveSyncUserId() {
  const configErr = getSupabaseConfigError();
  if (configErr) {
    warnSyncOnce(configErr);
    return null;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    warnSyncOnce(`Supabase session error: ${error.message}`);
    return null;
  }
  if (!session?.user?.id) return null;

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const expiresSoon = expiresAt > 0 && expiresAt - Date.now() < 60_000;
  if (expiresSoon) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      warnSyncOnce(
        `Supabase session refresh failed (${refreshErr.message}). `
        + "Reiniciá sesión en /panel — los datos quedan en localStorage.",
      );
      return null;
    }
    return refreshed.session?.user?.id || null;
  }

  return session.user.id;
}

/**
 * Delete remote rows for this user that are no longer in the local id set.
 * @param {string} table
 * @param {string} userId
 * @param {string[]} localIds
 */
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

function pickTimelineUiState(state) {
  return {
    timelineDocQueue: Array.isArray(state.timelineDocQueue) ? state.timelineDocQueue : [],
    timelineDocQueueFocusByDocId: state.timelineDocQueueFocusByDocId || {},
    timelineDocSnapshotsByDocId: state.timelineDocSnapshotsByDocId || {},
    timelineExcludedChildrenByDocId: state.timelineExcludedChildrenByDocId || {},
    timelineAgentSets: Array.isArray(state.timelineAgentSets) ? state.timelineAgentSets : [],
    expandedDocIds: Array.isArray(state.expandedDocIds) ? state.expandedDocIds : [],
    primaryTimelineObjectId: state.primaryTimelineObjectId || null,
    currentTier: typeof state.currentTier === "string" ? state.currentTier : "all",
  };
}

function filterTimelineUiToExistingDocs(ui, docIds) {
  const docSet = new Set(docIds);
  const filterMap = (record) => Object.fromEntries(
    Object.entries(record || {}).filter(([docId]) => docSet.has(docId)),
  );

  return {
    ...ui,
    timelineDocQueue: (ui.timelineDocQueue || []).filter((docId) => docSet.has(docId)),
    timelineDocQueueFocusByDocId: filterMap(ui.timelineDocQueueFocusByDocId),
    timelineDocSnapshotsByDocId: filterMap(ui.timelineDocSnapshotsByDocId),
    timelineExcludedChildrenByDocId: filterMap(ui.timelineExcludedChildrenByDocId),
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
    timelineDocQueueFocusByDocId: {},
    timelineDocSnapshotsByDocId: {},
    timelineExcludedChildrenByDocId: {},
    timelineAgentSets: [],
    expandedDocIds: [],
    primaryTimelineObjectId: null,
    scheduledAutoRunEnabled: true,
    scheduledCompletedTaskKeys: [],
    deletedDocIds: [],
    deletedNodeIds: [],
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
    contentChars += String(node.content || "").length;
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
 * True when local snapshot is clearly richer / newer than remote and must not be wiped.
 * @param {Record<string, unknown>|null|undefined} local
 * @param {Record<string, unknown>|null|undefined} remote
 */
function isLocalRicherThanRemote(local, remote) {
  const L = workspaceContentScore(local);
  const R = workspaceContentScore(remote);

  if (L.docCount === 0 && L.nodeCount === 0 && L.objectCount === 0) return false;

  // Never wipe a larger remote entity set with a smaller local snapshot.
  // (This caused Content list / Next / node loss when reopening localhost.)
  if (R.nodeCount > L.nodeCount) return false;
  if (R.docCount > L.docCount) return false;

  // Cross-browser: if remote is clearly newer, do NOT keep an older localStorage
  // wholesale — that overwrote fresher cloud data and resurfaced "old folders".
  if (
    R.maxUpdated > 0
    && L.maxUpdated > 0
    && R.maxUpdated > L.maxUpdated + 2000
  ) {
    return false;
  }

  // Empty remote vs non-empty local — classic wipe after debounce miss
  if (R.docCount === 0 && L.docCount > 0) return true;
  if (R.objectCount === 0 && L.objectCount > 0) return true;
  if (R.nodeCount === 0 && L.nodeCount > 0 && L.contentChars > R.contentChars) return true;

  // Local has more entities and at least as much content (and is not behind in time)
  if (
    L.docCount > R.docCount
    && L.contentChars >= R.contentChars
    && L.maxUpdated >= R.maxUpdated - 5000
  ) {
    return true;
  }
  if (
    L.nodeCount > R.nodeCount
    && L.contentChars >= R.contentChars
    && L.maxUpdated >= R.maxUpdated - 5000
  ) {
    return true;
  }

  // Local is newer and not poorer in content — only when entity counts aren't behind
  if (
    L.nodeCount >= R.nodeCount
    && L.docCount >= R.docCount
    && L.maxUpdated > R.maxUpdated + 1500
    && L.contentChars >= Math.floor(R.contentChars * 0.9)
  ) {
    return true;
  }

  // Local has substantially more text with similar entity counts (and is not older)
  if (
    L.contentChars > R.contentChars * 1.25
    && L.docCount >= R.docCount
    && L.nodeCount >= R.nodeCount
    && L.maxUpdated >= R.maxUpdated - 1500
  ) {
    return true;
  }

  return false;
}

/**
 * Union maps by id; when both exist, keep the newer updatedAt (ties → richer string content).
 * @param {Record<string, object>} remoteMap
 * @param {Record<string, object>} localMap
 * @param {(item: object) => number} [contentLen]
 */
function mergeEntityMapsPreferNewer(remoteMap, localMap, contentLen) {
  const remote = remoteMap && typeof remoteMap === "object" ? remoteMap : {};
  const local = localMap && typeof localMap === "object" ? localMap : {};
  const out = { ...remote };
  const len = typeof contentLen === "function"
    ? contentLen
    : (item) => String(item?.content || item?.body || item?.title || "").length;

  for (const [id, localItem] of Object.entries(local)) {
    if (!localItem || typeof localItem !== "object") continue;
    const remoteItem = out[id];
    if (!remoteItem) {
      out[id] = localItem;
      continue;
    }
    const localT = Date.parse(String(localItem.updatedAt || localItem.createdAt || "")) || 0;
    const remoteT = Date.parse(String(remoteItem.updatedAt || remoteItem.createdAt || "")) || 0;
    if (localT > remoteT) {
      out[id] = localItem;
    } else if (localT === remoteT && len(localItem) > len(remoteItem)) {
      out[id] = localItem;
    }
  }
  return out;
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

  const docs = mergeEntityMapsPreferNewer(
    remoteState.docs,
    localState.docs,
    (doc) => {
      let n = String(doc?.body || doc?.content || "").length + String(doc?.title || "").length;
      for (const block of Array.isArray(doc?.blocks) ? doc.blocks : []) {
        n += String(block?.text || "").length + String(block?.title || "").length;
      }
      return n;
    },
  );
  const nodes = mergeEntityMapsPreferNewer(
    remoteState.nodes,
    localState.nodes,
    (node) => String(node?.content || "").length + String(node?.title || "").length,
  );
  const objectsRaw = mergeEntityMapsPreferNewer(
    remoteState.objects,
    localState.objects,
    (obj) => String(obj?.name || "").length,
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
      canvasNodes: mergeEntityMapsPreferNewer(
        remoteState.canvasNodes,
        localState.canvasNodes,
      ),
      canvasConnections: mergeEntityMapsPreferNewer(
        remoteState.canvasConnections,
        localState.canvasConnections,
      ),
      groupings: mergeEntityMapsPreferNewer(
        remoteState.groupings,
        localState.groupings,
      ),
      timelines: mergeEntityMapsPreferNewer(
        remoteState.timelines,
        localState.timelines,
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
    timelineDocQueueFocusByDocId: useTimelineStore.getState().timelineDocQueueFocusByDocId,
    timelineDocSnapshotsByDocId: useTimelineStore.getState().timelineDocSnapshotsByDocId,
    timelineExcludedChildrenByDocId: useTimelineStore.getState().timelineExcludedChildrenByDocId,
    timelineAgentSets: useTimelineStore.getState().timelineAgentSets,
    expandedDocIds: useTimelineStore.getState().expandedDocIds,
    primaryTimelineObjectId: useTimelineStore.getState().primaryTimelineObjectId,
    scheduledAutoRunEnabled: useScheduledTasksStore.getState().autoRunEnabled,
    scheduledCompletedTaskKeys: useScheduledTasksStore.getState().completedTaskKeys,
    deletedDocIds: [...pendingDeletedDocIds],
    deletedNodeIds: [...pendingDeletedNodeIds],
  });

  const applyStateToStores = (data) => {
    if (!data) return;
    restorePendingDeletesFromSnapshot(data);
    const stripped = stripPendingDeletesFromState(data);
    // #region agent log
    {
      const pending = [...pendingDeletedDocIds];
      const incomingDocs = Object.keys(stripped.docs || {});
      const resurrectedIds = pending.filter((id) => incomingDocs.includes(id));
      const titleSample = Object.values(stripped.docs || {}).slice(0, 12).map((d) => ({
        id: d?.id,
        title: d?.title || d?.category || null,
      }));
      const ghostTitles = resurrectedIds.map((id) => ({
        id,
        title: stripped.docs?.[id]?.title || null,
      }));
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'pre-fix',hypothesisId:'H1',location:'persistenceMiddleware.js:applyStateToStores',message:'apply state to stores',data:{pendingCount:pending.length,pending,resurrectedIds,ghostTitles,incomingDocCount:incomingDocs.length,titleSample},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
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
    useNodesStore.setState({ nodes });
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
    if (Array.isArray(stripped.timelineDocQueue)) {
      useTimelineStore.setState({
        timelineDocQueue: stripped.timelineDocQueue,
        timelineDocQueueFocusByDocId: stripped.timelineDocQueueFocusByDocId || {},
        timelineDocSnapshotsByDocId: stripped.timelineDocSnapshotsByDocId || {},
        timelineExcludedChildrenByDocId: stripped.timelineExcludedChildrenByDocId || {},
        timelineAgentSets: Array.isArray(stripped.timelineAgentSets) ? stripped.timelineAgentSets : [],
        expandedDocIds: Array.isArray(stripped.expandedDocIds) ? stripped.expandedDocIds : [],
        primaryTimelineObjectId: stripped.primaryTimelineObjectId || null,
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const data = sanitizePersistedSnapshot(parsed);
        if (data) {
          applyStateToStores(data);
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

  const loadFromSupabase = async () => {
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
          launchAt: camp.launch_at || camp.schedule_start_at || null,
          scheduleStartAt: camp.schedule_start_at || camp.launch_at || null,
          scheduleFinishAt: camp.schedule_finish_at
            || camp.schedule_start_at
            || camp.launch_at
            || null,
          campaignActive: camp.campaign_active !== false,
          nodeLinkColor: camp.node_link_color || "mint",
          knowledgeImport: camp.knowledge_import || null,
        };
        if (camp.company_id && objects[camp.company_id]) {
          objects[camp.company_id].children.push(camp.id);
        }
      });

      // Reconstruct nodes (schedule lives in reference.anchorAt — no DB column)
      const nodes = {};
      dbNodes.forEach((node) => {
        const reference = node.reference && typeof node.reference === "object" ? node.reference : {};
        const anchorAt = anchorAtFromPersistedNode({ reference, anchorAt: node.anchor_at });
        nodes[node.id] = {
          id: node.id,
          parentDocId: node.parent_doc_id,
          title: node.title,
          dataType: node.data_type,
          content: node.content,
          sourceQuery: node.source_query || "",
          reference,
          anchorAt,
          completed: completedFromPersistedNode({ reference, completed: node.completed }),
          sourceId: sourceIdFromPersistedNode({ reference, sourceId: node.source_id }),
          linkedToCanvas: node.linked_to_canvas || false,
          canvasNodeId: node.canvas_node_id || null,
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
      // #region agent log
      try {
        const withAnchor = Object.values(hydratedNodes || {}).filter((n) => n?.anchorAt).length;
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'post-fix',hypothesisId:'H5',location:'persistenceMiddleware.js:hydrate',message:'hydrate nodes with schedule',data:{preferredLocal:preferredLocal||preferredMemory,nodeCount:Object.keys(hydratedNodes||{}).length,withAnchor},timestamp:Date.now()})}).catch(()=>{});
      } catch (_) { /* ignore */ }
      // #endregion
      // Re-arm tombstones from disk + memory so mid-flight deletes win over stale remote.
      refreshTombstonesFromDisk();
      const liveNow = sanitizePersistedSnapshot(getLocalState());
      restorePendingDeletesFromSnapshot(liveNow);
      const deletesHappened = deleteTombstoneRevision !== tombstoneRevisionAtStart
        || pendingDeletedDocIds.size > 0
        || pendingDeletedNodeIds.size > 0;
      if (deletesHappened) {
        console.warn(
          "[futura-nota] Hydrate saw deletes mid-flight — keeping live folders, ignoring stale remote ghosts.",
          {
            before: tombstoneRevisionAtStart,
            after: deleteTombstoneRevision,
            pendingDocs: [...pendingDeletedDocIds],
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
      // #region agent log
      {
        const liveIds = new Set(Object.keys(liveNow?.docs || {}));
        const hydratedIds = Object.keys(hydratedState.docs || {});
        const safeIds = Object.keys(safeDocs || {});
        const remoteOnlyDropped = hydratedIds.filter((id) => !liveIds.has(id) && !safeIds.includes(id));
        const remoteOnlyKept = hydratedIds.filter((id) => !liveIds.has(id) && safeIds.includes(id));
        const remoteOnlyKeptTitles = remoteOnlyKept.map((id) => ({
          id,
          title: hydratedState.docs?.[id]?.title || null,
        }));
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'pre-fix',hypothesisId:'H2',location:'persistenceMiddleware.js:hydrate:safeDocs',message:'hydrate safeDocs gate',data:{deletesHappened,revisionStart:tombstoneRevisionAtStart,revisionNow:deleteTombstoneRevision,pendingDocs:[...pendingDeletedDocIds],liveCount:liveIds.size,hydratedCount:hydratedIds.length,safeCount:safeIds.length,remoteOnlyDroppedCount:remoteOnlyDropped.length,remoteOnlyKeptTitles,preferredLocal:Boolean(preferredLocal||preferredMemory)},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      const objectsForApply = deletesHappened
        ? rebuildObjectChildren(liveNow?.objects || hydratedState.objects || {}, safeDocs)
        : rebuildObjectChildren(hydratedState.objects || {}, safeDocs);
      applyStateToStores({
        ...hydratedState,
        objects: objectsForApply,
        docs: safeDocs,
        nodes: safeNodes,
      });

      finishWorkspaceHydration();

      // Tombstones can clear now that hydrate has applied without resurrecting.
      if (pendingDeletedDocIds.size || pendingDeletedNodeIds.size) {
        await clearTombstonesConfirmedAbsent("campaigns", userId, pendingDeletedDocIds);
        await clearTombstonesConfirmedAbsent("nodes", userId, pendingDeletedNodeIds);
      }

      const docIds = Object.keys(useDocsStore.getState().docs || {});
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

      const filteredTimelineUi = filterTimelineUiToExistingDocs(timelineUi, docIds);
      useTimelineStore.setState({
        timelineDocQueue: filteredTimelineUi.timelineDocQueue,
        timelineDocQueueFocusByDocId: filteredTimelineUi.timelineDocQueueFocusByDocId,
        timelineDocSnapshotsByDocId: filteredTimelineUi.timelineDocSnapshotsByDocId,
        timelineExcludedChildrenByDocId: filteredTimelineUi.timelineExcludedChildrenByDocId,
        timelineAgentSets: filteredTimelineUi.timelineAgentSets,
        expandedDocIds: filteredTimelineUi.expandedDocIds,
        primaryTimelineObjectId: filteredTimelineUi.primaryTimelineObjectId,
        currentTier: filteredTimelineUi.currentTier,
        tier: filteredTimelineUi.currentTier,
      });

      isSyncedWithRemote = true;
      console.log("Supabase sync loaded for user:", userId);
      finishWorkspaceHydration();
      const finalState = getLocalState();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalState));
      } catch {
        // private mode / quota
      }

      // If we kept local over a poorer remote, push immediately so the next reload is safe.
      if (preferredLocal || preferredMemory) {
        syncToSupabase(finalState).catch((err) => {
          console.warn("Failed to push preferred-local workspace to Supabase:", err);
        });
      }
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
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'79f8b7'},body:JSON.stringify({sessionId:'79f8b7',runId:'post-fix',hypothesisId:'D',location:'persistenceMiddleware.js:syncToSupabase:queue',message:'sync queued behind in-flight',data:{pending:[...pendingDeletedDocIds]},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
          console.warn("No authenticated user — skipping Supabase sync.");
          return false;
        }

        // Always read live store — debounce snapshots can re-upsert deleted folders.
        const state = stripPendingDeletesFromState(getLocalState());

        // #region agent log
        {
          const liveDocIds = Object.keys(state?.docs || {});
          const pending = [...pendingDeletedDocIds];
          const resurrectInLive = pending.filter((id) => liveDocIds.includes(id));
          fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'79f8b7'},body:JSON.stringify({sessionId:'79f8b7',runId:'post-fix',hypothesisId:'D',location:'persistenceMiddleware.js:syncToSupabase:start',message:'sync start — live stripped state',data:{pending,liveDocCount:liveDocIds.length,resurrectInLive,queuedRerun:syncNeedsRerun},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion

    try {
      const now = new Date().toISOString();
      const upsertOpts = { onConflict: "id" };

      // 1. Companies
      const companiesRows = Object.values(state.objects).map((co) => ({
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

      if (companiesRows.length > 0) {
        const ok = await runUpsert(
          "Upsert companies",
          supabase.from("companies").upsert(companiesRows, upsertOpts),
        );
        if (!ok) criticalOk = false;
        if (ok) {
          await deleteOrphanRows("companies", userId, companiesRows.map((r) => r.id));
        }
      }

      // 2. Campaigns (folders = doc_kind content)
      const campaignsRows = Object.values(state.docs || {})
        .filter((doc) => doc?.id && !pendingDeletedDocIds.has(doc.id))
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
        launch_at: doc.scheduleStartAt || doc.launchAt || null,
        schedule_start_at: doc.scheduleStartAt || doc.launchAt || null,
        schedule_finish_at: doc.scheduleFinishAt
          || doc.scheduleStartAt
          || doc.launchAt
          || null,
        campaign_active: doc.campaignActive !== false,
        node_link_color: doc.nodeLinkColor || "mint",
        knowledge_import: doc.knowledgeImport || null,
        created_at: doc.createdAt || now,
        updated_at: doc.updatedAt || now,
      }));
      // #region agent log
      {
        const pending = [...pendingDeletedDocIds];
        const upsertNames = campaignsRows.slice(0, 20).map((r) => ({ id: r.id, name: r.name }));
        const pendingStillInState = pending.filter((id) => Boolean(state.docs?.[id]));
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'pre-fix',hypothesisId:'H3',location:'persistenceMiddleware.js:syncToSupabase:campaigns',message:'campaigns upsert batch',data:{rowCount:campaignsRows.length,pending,pendingStillInState,upsertNames,hydrateInFlight},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion

      const campaignLocalIds = campaignsRows.map((r) => r.id);
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

      // 3. Nodes — persist Schedule in reference.anchorAt (JSONB)
      const nodesRows = Object.values(state.nodes || {})
        .filter((node) => node?.id && !pendingDeletedNodeIds.has(node.id))
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
        created_at: node.createdAt || now,
        updated_at: node.updatedAt || now,
      }));

      const nodeLocalIds = nodesRows.map((r) => r.id);
      let nodesUpsertOk = true;
      if (nodesRows.length > 0) {
        nodesUpsertOk = await runUpsert(
          "Upsert nodes",
          supabase.from("nodes").upsert(nodesRows, upsertOpts),
        );
        if (!nodesUpsertOk) criticalOk = false;
      }
      const nodesOrphansOk = nodesUpsertOk
        ? await deleteOrphanRows("nodes", userId, nodeLocalIds)
        : false;
      const nodesTombstoneOk = nodesUpsertOk
        ? await purgeTombstonedRows("nodes", userId, pendingDeletedNodeIds)
        : false;

      // Only drop tombstones after remote SELECT proves the rows are gone.
      if (campaignsOrphansOk && campaignsTombstoneOk) {
        await clearTombstonesConfirmedAbsent("campaigns", userId, pendingDeletedDocIds);
      }
      if (nodesOrphansOk && nodesTombstoneOk) {
        await clearTombstonesConfirmedAbsent("nodes", userId, pendingDeletedNodeIds);
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
      // #region agent log
      try {
        const nodes = useNodesStore.getState().nodes || {};
        const withAnchor = Object.values(nodes).filter((n) => n?.anchorAt).slice(0, 5).map((n) => ({ id: n.id, anchorAt: n.anchorAt, createdAt: n.createdAt }));
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'post-fix',hypothesisId:'H5',location:'persistenceMiddleware.js:visibilitychange',message:'tab hidden — flush persistence',data:{nodeCount:Object.keys(nodes).length,withAnchorCount:Object.values(nodes).filter((n)=>n?.anchorAt).length,sampleWithAnchor:withAnchor},timestamp:Date.now()})}).catch(()=>{});
      } catch (_) { /* ignore */ }
      // #endregion
      flushPersistenceSyncBestEffort();
    }
  };

  window.addEventListener("pagehide", flushPersistenceSyncBestEffort);
  window.addEventListener("beforeunload", flushPersistenceSyncBestEffort);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Paint local workspace immediately so reload does not flash empty companies.
  // Remote hydrate merges on top; seed default "yo" only after hydrate finishes.
  paintLocalWorkspace();
  adoptTombstoneLedger(readTombstoneLedger());
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
    const docsState = useDocsStore.getState().docs || {};
    const nodesState = useNodesStore.getState().nodes || {};
    let docsChanged = false;
    let nodesChanged = false;
    const nextDocs = { ...docsState };
    const nextNodes = { ...nodesState };
    for (const id of pendingDeletedDocIds) {
      if (id in nextDocs) {
        delete nextDocs[id];
        docsChanged = true;
      }
    }
    for (const id of pendingDeletedNodeIds) {
      if (id in nextNodes) {
        delete nextNodes[id];
        nodesChanged = true;
      }
    }
    if (docsChanged) useDocsStore.setState({ docs: nextDocs });
    if (nodesChanged) useNodesStore.setState({ nodes: nextNodes });
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93b014'},body:JSON.stringify({sessionId:'93b014',runId:'post-fix',hypothesisId:'H4',location:'persistenceMiddleware.js:storage:tombstoneLedger',message:'adopted cross-tab tombstones',data:{pendingDocs:[...pendingDeletedDocIds],docsChanged,nodesChanged},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    debouncedRemoteSync();
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
      deletedDocMarkedAt.clear();
      deletedNodeMarkedAt.clear();
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
    const currentState = getLocalState();
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