import { supabase, getSupabaseConfigError, formatSupabaseError } from "../../lib/supabaseClient.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { sanitizePersistedSnapshot } from "../../lib/storeSanitize.js";

const STORAGE_KEY = "futura-nota-v1";

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
let lastSyncWarnAt = 0;

function warnSyncOnce(message) {
  const now = Date.now();
  if (now - lastSyncWarnAt < 15_000) return;
  lastSyncWarnAt = now;
  console.warn(message);
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
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

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
  });

  const applyStateToStores = (data) => {
    if (!data) return;
    useObjectsStore.setState({ objects: data.objects || {} });
    const normalizedDocs = {};
    if (data.docs) {
      for (const [id, doc] of Object.entries(data.docs)) {
        normalizedDocs[id] = normalizeDoc(doc);
      }
    }
    useDocsStore.setState({ docs: normalizedDocs });
    useNodesStore.setState({ nodes: data.nodes || {} });
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
  };

  const loadFromSupabase = async () => {
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
          launchAt: camp.launch_at || null,
          campaignActive: camp.campaign_active !== false,
          nodeLinkColor: camp.node_link_color || "mint",
          knowledgeImport: camp.knowledge_import || null,
        };
        if (camp.company_id && objects[camp.company_id]) {
          objects[camp.company_id].children.push(camp.id);
        }
      });

      // Reconstruct nodes
      const nodes = {};
      dbNodes.forEach((node) => {
        nodes[node.id] = {
          id: node.id,
          parentDocId: node.parent_doc_id,
          title: node.title,
          dataType: node.data_type,
          content: node.content,
          sourceQuery: node.source_query || "",
          reference: node.reference || {},
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

      applyStateToStores({ objects, docs, nodes, canvasNodes, canvasConnections, groupings, timelines, currentTier: "all" });
      isSyncedWithRemote = true;
      console.log("Supabase sync loaded for user:", userId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalState()));
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
        category: doc.category || "",
        launch_at: doc.launchAt || null,
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

      // 3. Nodes
      const nodesRows = Object.values(state.nodes).map((node) => ({
        id: node.id,
        user_id: userId,
        parent_doc_id: node.parentDocId,
        title: node.title,
        data_type: node.dataType,
        content: node.content,
        source_query: node.sourceQuery || "",
        reference: node.reference || {},
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

      console.log("Supabase sync complete for user:", userId);
    } catch (err) {
      console.error("Supabase write failed:", err.message || err);
    }
  };

  // Cargar datos al iniciar
  loadFromSupabase();

  // Escuchar cambios de sesión — recargar datos cuando el usuario cambia
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      isSyncedWithRemote = false;
      loadFromSupabase();
    }
    if (event === "SIGNED_OUT") {
      isSyncedWithRemote = false;
      applyStateToStores({ objects: {}, docs: {}, nodes: {}, canvasNodes: {}, canvasConnections: {}, groupings: {}, timelines: {} });
    }
  });

  const debouncedRemoteSync = debounce(syncToSupabase, 1500);

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
  ].forEach((store) => {
    store.subscribe(handleStoreChange);
  });
}

export { STORAGE_KEY };