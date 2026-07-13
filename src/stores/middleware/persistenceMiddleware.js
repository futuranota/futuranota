import { supabase, getSupabaseConfigError, formatSupabaseError } from "../../lib/supabaseClient.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import { sanitizePersistedSnapshot, pruneStrayDefaultYo, findObjectIdByName } from "../../lib/storeSanitize.js";
import { repairDocNodeLinks } from "../../lib/resolveDocBlockNodes.js";
import { useScheduledTasksStore } from "../scheduledTasksStore.js";

const STORAGE_KEY = "futura-nota-v1";

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
let hydrateInFlight = false;
let lastSyncWarnAt = 0;

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
async function deleteOrphanRows(table, userId, localIds) {
  const { data: remoteRows, error: selectErr } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.error(formatSupabaseError(selectErr, `Select ${table} for cleanup`));
    return;
  }

  const localSet = new Set(localIds);
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => id && !localSet.has(id));

  if (!orphanIds.length) return;

  const { error: deleteErr } = await supabase
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id", orphanIds);

  if (deleteErr) {
    console.error(formatSupabaseError(deleteErr, `Delete orphans in ${table}`));
  }
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
  };
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

  // Empty remote vs non-empty local — classic wipe after debounce miss
  if (R.docCount === 0 && L.docCount > 0) return true;
  if (R.objectCount === 0 && L.objectCount > 0) return true;
  if (R.nodeCount === 0 && L.nodeCount > 0 && L.contentChars > R.contentChars) return true;

  // Local has more entities and at least as much content
  if (L.docCount > R.docCount && L.contentChars >= R.contentChars) return true;
  if (L.nodeCount > R.nodeCount && L.contentChars >= R.contentChars) return true;

  // Local is newer and not poorer in content — only when entity counts aren't behind
  if (
    L.nodeCount >= R.nodeCount
    && L.docCount >= R.docCount
    && L.maxUpdated > R.maxUpdated + 1500
    && L.contentChars >= Math.floor(R.contentChars * 0.9)
  ) {
    return true;
  }

  // Local has substantially more text with similar entity counts
  if (
    L.contentChars > R.contentChars * 1.25
    && L.docCount >= R.docCount
    && L.nodeCount >= R.nodeCount
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
    return { state: remoteState, preferredLocal: false };
  }

  if (isLocalRicherThanRemote(localState, remoteState)) {
    return {
      state: {
        ...remoteState,
        objects: localState.objects || {},
        docs: localState.docs || {},
        nodes: localState.nodes || {},
        canvasNodes: localState.canvasNodes || remoteState.canvasNodes || {},
        canvasConnections: localState.canvasConnections || remoteState.canvasConnections || {},
        groupings: localState.groupings || remoteState.groupings || {},
        timelines: localState.timelines || remoteState.timelines || {},
      },
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
    state: {
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
    },
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

let flushPersistenceSyncImpl = async () => {};

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
  });

  const applyStateToStores = (data) => {
    if (!data) return;
    const objects = pruneStrayDefaultYo(data.objects || {});
    useObjectsStore.setState({ objects });
    const normalizedDocs = {};
    if (data.docs) {
      for (const [id, doc] of Object.entries(data.docs)) {
        normalizedDocs[id] = normalizeDoc(doc);
      }
    }
    let nodes = data.nodes || {};
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
      canvasNodes: data.canvasNodes || {},
      canvasConnections: data.canvasConnections || {},
      groupings: data.groupings || {},
    });
    if (data.timelines) {
      useTimelineStore.setState({
        timelines: data.timelines,
        currentTier: data.currentTier || "all",
      });
    }
    if (Array.isArray(data.timelineDocQueue)) {
      useTimelineStore.setState({
        timelineDocQueue: data.timelineDocQueue,
        timelineDocQueueFocusByDocId: data.timelineDocQueueFocusByDocId || {},
        timelineDocSnapshotsByDocId: data.timelineDocSnapshotsByDocId || {},
        timelineExcludedChildrenByDocId: data.timelineExcludedChildrenByDocId || {},
        timelineAgentSets: Array.isArray(data.timelineAgentSets) ? data.timelineAgentSets : [],
        expandedDocIds: Array.isArray(data.expandedDocIds) ? data.expandedDocIds : [],
        primaryTimelineObjectId: data.primaryTimelineObjectId || null,
      });
    }
    if (typeof data.scheduledAutoRunEnabled === "boolean"
      || Array.isArray(data.scheduledCompletedTaskKeys)) {
      useScheduledTasksStore.setState({
        autoRunEnabled: typeof data.scheduledAutoRunEnabled === "boolean"
          ? data.scheduledAutoRunEnabled
          : true,
        completedTaskKeys: Array.isArray(data.scheduledCompletedTaskKeys)
          ? data.scheduledCompletedTaskKeys
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
    if (Object.keys(nextObjects).length > 0) return;
    if (!findObjectIdByName(nextObjects, "yo")) {
      addObject("yo", "");
    }
  };

  const loadLocalFallback = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const data = sanitizePersistedSnapshot(parsed);
        if (data) applyStateToStores(data);
      }
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
    }
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
    try {
      const configErr = getSupabaseConfigError();
      if (configErr) {
        console.log(configErr);
        loadLocalFallback();
        return;
      }

      const userId = await resolveSyncUserId();
      if (!userId) {
        console.log("No session — loading from localStorage.");
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
          "Supabase hydrate looked poorer than local workspace — keeping local data and pushing to remote.",
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
      applyStateToStores({ ...hydratedState, nodes: hydratedNodes });

      finishWorkspaceHydration();

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
    }
  };

  const syncToSupabase = async (state) => {
    if (!isSyncedWithRemote) return;

    const userId = await resolveSyncUserId();
    if (!userId) {
      console.warn("No authenticated user — skipping Supabase sync.");
      return;
    }

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
        if (ok) {
          await deleteOrphanRows("companies", userId, companiesRows.map((r) => r.id));
        }
      }

      // 2. Campaigns
      const campaignsRows = Object.values(state.docs).map((doc) => ({
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
        updated_at: now,
      }));

      if (campaignsRows.length > 0) {
        const ok = await runUpsert(
          "Upsert campaigns",
          supabase.from("campaigns").upsert(campaignsRows, upsertOpts),
        );
        if (ok) {
          await deleteOrphanRows("campaigns", userId, campaignsRows.map((r) => r.id));
        }
      }

      // 3. Nodes — persist Schedule in reference.anchorAt (JSONB)
      const nodesRows = Object.values(state.nodes).map((node) => ({
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
        updated_at: now,
      }));

      if (nodesRows.length > 0) {
        const ok = await runUpsert(
          "Upsert nodes",
          supabase.from("nodes").upsert(nodesRows, upsertOpts),
        );
        if (ok) {
          await deleteOrphanRows("nodes", userId, nodesRows.map((r) => r.id));
        }
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

      console.log("Supabase sync complete for user:", userId);
    } catch (err) {
      console.error("Supabase write failed:", err.message || err);
    }
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
    if (!userId) return;
    isSyncedWithRemote = true;
    await syncToSupabase(currentState);
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

  // Cargar datos al iniciar
  loadFromSupabase();

  // Escuchar cambios de sesión — recargar solo en login real, no en cada refresh de token
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      // Initial boot already called loadFromSupabase(); skip duplicate wipe on auth echo.
      if (isSyncedWithRemote || hydrateInFlight) return;
      loadFromSupabase();
    }
    if (event === "SIGNED_OUT") {
      isSyncedWithRemote = false;
      debouncedRemoteSync.cancel();
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

export { STORAGE_KEY };

export async function flushPersistenceSync() {
  await flushPersistenceSyncImpl();
}