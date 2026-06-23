import { supabase } from "../../lib/supabaseClient.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { sanitizePersistedSnapshot } from "../../lib/storeSanitize.js";

const STORAGE_KEY = "futura-nota-v1";

let initialized = false;
let saveTimer = null;
let isSyncedWithRemote = false; // True only if we successfully connected and loaded from Supabase

// Helper to debounce database writes
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

  // Apply state to local stores
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

  // Load from local storage fallback
  const loadLocalFallback = () => {
    console.log("Loading fallback state from LocalStorage...");
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const data = sanitizePersistedSnapshot(parsed);
        if (data) {
          applyStateToStores(data);
        }
      }
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
    }
  };

  // Load from Supabase
  const loadFromSupabase = async () => {
    console.log("Synchronizing state from Supabase...");
    try {
      // 1. Fetch all companies/objects
      const { data: dbCompanies, error: compErr } = await supabase.from("companies").select("*");
      if (compErr) throw compErr;

      // 2. Fetch all campaigns/docs
      const { data: dbCampaigns, error: campErr } = await supabase.from("campaigns").select("*");
      if (campErr) throw campErr;

      // 3. Fetch all nodes
      const { data: dbNodes, error: nodeErr } = await supabase.from("nodes").select("*");
      if (nodeErr) throw nodeErr;

      // 4. Fetch canvas nodes
      const { data: dbCanvasNodes, error: cnErr } = await supabase.from("canvas_nodes").select("*");
      if (cnErr) throw cnErr;

      // 5. Fetch canvas connections
      const { data: dbCanvasConnections, error: ccErr } = await supabase.from("canvas_connections").select("*");
      if (ccErr) throw ccErr;

      // 6. Fetch groupings
      const { data: dbGroupings, error: grpErr } = await supabase.from("groupings").select("*");
      if (grpErr) throw grpErr;

      // 7. Fetch timelines
      const { data: dbTimelines, error: tlErr } = await supabase.from("timelines").select("*");
      if (tlErr) throw tlErr;

      // Reconstruct Zustand Objects (Companies)
      const objects = {};
      dbCompanies.forEach((co) => {
        objects[co.id] = {
          id: co.id,
          name: co.name,
          description: co.description || co.sector || "",
          brand: co.brand || co.name,
          color: co.color || "mint",
          role: co.role || "satellite",
          children: [], // Populated below from campaigns
          createdAt: co.created_at,
          updatedAt: co.updated_at || co.created_at,
        };
      });

      // Reconstruct Zustand Docs (Campaigns)
      const docs = {};
      dbCampaigns.forEach((camp) => {
        const docId = camp.id;
        docs[docId] = {
          id: docId,
          title: camp.name,
          parentObjectId: camp.company_id,
          content: camp.content || "",
          body: camp.body || "",
          blocks: camp.blocks || [],
          dataProperties: camp.data_properties || [],
          tags: camp.tags || [],
          nodeIds: [], // Populated below from nodes
          syncedWithCanvas: camp.campaign_active !== false,
          createdAt: camp.created_at,
          updatedAt: camp.updated_at || camp.created_at,
          docKind: camp.doc_kind || "standard",
          templateKind: camp.template_kind || null,
          templateSubcategoryDocIds: camp.subcategory_doc_ids || [],
          subcategoryDocIds: camp.subcategory_doc_ids || [],
          version: camp.version || "",
          category: camp.category || "",
          launchAt: camp.launch_at || null,
          campaignActive: camp.campaign_active !== false,
          nodeLinkColor: camp.node_link_color || "mint",
          knowledgeImport: camp.knowledge_import || null,
        };

        // Link to parent company object children array
        if (camp.company_id && objects[camp.company_id]) {
          objects[camp.company_id].children.push(docId);
        }
      });

      // Reconstruct Zustand Nodes
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

        // Link back to doc's nodeIds list
        if (node.parent_doc_id && docs[node.parent_doc_id]) {
          docs[node.parent_doc_id].nodeIds.push(node.id);
        }
      });

      // Reconstruct Canvas Nodes
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

      // Reconstruct Canvas Connections
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

      // Reconstruct Groupings
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

      // Reconstruct Timelines
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

      applyStateToStores({
        objects,
        docs,
        nodes,
        canvasNodes,
        canvasConnections,
        groupings,
        timelines,
        currentTier: "all",
      });

      isSyncedWithRemote = true;
      console.log("Supabase synchronization successfully loaded.");

      // Store a backup in localstorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalState()));
    } catch (err) {
      console.warn("Supabase connection failed. Falling back to LocalStorage.", err.message || err);
      loadLocalFallback();
    }
  };

  // Sync state back to Supabase
  const syncToSupabase = async (state) => {
    if (!isSyncedWithRemote) {
      console.log("Skipping Supabase sync because connection wasn't established successfully on startup.");
      return;
    }

    console.log("Syncing changes to Supabase...");
    try {
      // 1. Sync Companies (Objects)
      const companiesRows = Object.values(state.objects).map((co) => ({
        id: co.id,
        name: co.name,
        sector: co.description || "",
        description: co.description || "",
        brand: co.brand || co.name,
        color: co.color || "mint",
        role: co.role || "satellite",
        created_at: co.createdAt || new Date().toISOString(),
        updated_at: co.updatedAt || new Date().toISOString(),
      }));

      if (companiesRows.length > 0) {
        const { error } = await supabase.from("companies").upsert(companiesRows);
        if (error) console.error("Error upserting companies:", error.message);
        // Clear deleted companies
        const coIds = companiesRows.map(r => r.id);
        await supabase.from("companies").delete().not("id", "in", `(${coIds.join(",")})`);
      } else {
        await supabase.from("companies").delete().neq("id", "");
      }

      // 2. Sync Campaigns (Docs)
      const campaignsRows = Object.values(state.docs).map((doc) => ({
        id: doc.id,
        company_id: doc.parentObjectId,
        name: doc.title,
        source: doc.knowledgeImport?.sourceUrl || "",
        verification_score: doc.version ? parseInt(doc.version) || 0 : 0,
        content: doc.content || "",
        body: doc.body || "",
        blocks: doc.blocks || [],
        data_properties: doc.dataProperties || [],
        tags: doc.tags || [],
        doc_kind: doc.docKind || "standard",
        template_kind: doc.templateKind || null,
        subcategory_doc_ids: doc.subcategoryDocIds || [],
        version: doc.version || "",
        category: doc.category || "",
        launch_at: doc.launchAt || null,
        campaign_active: doc.campaignActive !== false,
        node_link_color: doc.nodeLinkColor || "mint",
        knowledge_import: doc.knowledgeImport || null,
        created_at: doc.createdAt || new Date().toISOString(),
        updated_at: doc.updatedAt || new Date().toISOString(),
      }));

      if (campaignsRows.length > 0) {
        const { error } = await supabase.from("campaigns").upsert(campaignsRows);
        if (error) console.error("Error upserting campaigns:", error.message);
        const campIds = campaignsRows.map(r => r.id);
        await supabase.from("campaigns").delete().not("id", "in", `(${campIds.join(",")})`);
      } else {
        await supabase.from("campaigns").delete().neq("id", "");
      }

      // 3. Sync Nodes
      const nodesRows = Object.values(state.nodes).map((node) => ({
        id: node.id,
        parent_doc_id: node.parentDocId,
        title: node.title,
        data_type: node.dataType,
        content: node.content,
        source_query: node.sourceQuery || "",
        reference: node.reference || {},
        linked_to_canvas: node.linkedToCanvas || false,
        canvas_node_id: node.canvasNodeId || null,
        created_at: node.createdAt || new Date().toISOString(),
        updated_at: node.updatedAt || new Date().toISOString(),
      }));

      if (nodesRows.length > 0) {
        const { error } = await supabase.from("nodes").upsert(nodesRows);
        if (error) console.error("Error upserting nodes:", error.message);
        const nodeIds = nodesRows.map(r => r.id);
        await supabase.from("nodes").delete().not("id", "in", `(${nodeIds.join(",")})`);
      } else {
        await supabase.from("nodes").delete().neq("id", "");
      }

      // 4. Sync Canvas Nodes
      const canvasNodesRows = Object.values(state.canvasNodes).map((cn) => ({
        id: cn.id,
        campaign_id: useDocsStore.getState().getDoc(useNodesStore.getState().getNode(cn.nodeId)?.parentDocId)?.id || 
                     Object.keys(state.docs)[0] || null, // fallback campaign_id
        title: cn.title,
        data_type: cn.dataType || "text",
        content: cn.content,
        x_pos: cn.x,
        y_pos: cn.y,
        color_theme: cn.colorTheme || "mint",
        node_id: cn.nodeId,
        hidden: cn.hidden || false,
        selected: cn.selected || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (canvasNodesRows.length > 0) {
        const { error } = await supabase.from("canvas_nodes").upsert(canvasNodesRows);
        if (error) console.error("Error upserting canvas_nodes:", error.message);
        const cnIds = canvasNodesRows.map(r => r.id);
        await supabase.from("canvas_nodes").delete().not("id", "in", `(${cnIds.join(",")})`);
      } else {
        await supabase.from("canvas_nodes").delete().neq("id", "");
      }

      // 5. Sync Canvas Connections
      const connectionsRows = Object.values(state.canvasConnections).map((cc) => ({
        id: cc.id,
        campaign_id: Object.keys(state.docs)[0] || null, // placeholder parent relationship
        source_id: cc.from || cc.fromCanvasNodeId,
        target_id: cc.to || cc.toCanvasNodeId,
        from_canvas_node_id: cc.from || cc.fromCanvasNodeId,
        to_canvas_node_id: cc.to || cc.toCanvasNodeId,
        created_at: cc.createdAt || new Date().toISOString(),
      }));

      if (connectionsRows.length > 0) {
        const { error } = await supabase.from("canvas_connections").upsert(connectionsRows);
        if (error) console.error("Error upserting canvas_connections:", error.message);
        const ccIds = connectionsRows.map(r => r.id);
        await supabase.from("canvas_connections").delete().not("id", "in", `(${ccIds.map(id => `'${id}'`).join(",")})`);
      } else {
        await supabase.from("canvas_connections").delete().neq("id", '00000000-0000-0000-0000-000000000000');
      }

      // 6. Sync Groupings
      const groupingsRows = Object.values(state.groupings).map((grp) => ({
        id: grp.id,
        name: grp.name,
        canvas_node_ids: grp.canvasNodeIds || [],
        parent_doc_id: grp.parentDocId,
        created_at: grp.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (groupingsRows.length > 0) {
        const { error } = await supabase.from("groupings").upsert(groupingsRows);
        if (error) console.error("Error upserting groupings:", error.message);
        const grpIds = groupingsRows.map(r => r.id);
        await supabase.from("groupings").delete().not("id", "in", `(${grpIds.join(",")})`);
      } else {
        await supabase.from("groupings").delete().neq("id", "");
      }

      // 7. Sync Timelines
      const timelinesRows = Object.values(state.timelines).map((tl) => ({
        id: tl.id,
        campaign_id: Object.keys(state.docs)[0] || null, // parent relation
        title: tl.name || tl.title,
        name: tl.name || tl.title,
        target_date: tl.entries?.[0]?.date ? tl.entries[0].date.split("T")[0] : new Date().toISOString().split("T")[0],
        tier: tl.tier || "primary",
        entries: tl.entries || [],
        created_at: tl.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (timelinesRows.length > 0) {
        const { error } = await supabase.from("timelines").upsert(timelinesRows);
        if (error) console.error("Error upserting timelines:", error.message);
        const tlIds = timelinesRows.map(r => r.id);
        await supabase.from("timelines").delete().not("id", "in", `(${tlIds.map(id => `'${id}'`).join(",")})`);
      } else {
        await supabase.from("timelines").delete().neq("id", '00000000-0000-0000-0000-000000000000');
      }

      console.log("Supabase sync complete.");
    } catch (err) {
      console.error("Supabase write failed:", err.message || err);
    }
  };

  // Setup initial load
  loadFromSupabase();

  // Schedule local and remote saves
  const debouncedRemoteSync = debounce(syncToSupabase, 1000);

  const handleStoreChange = () => {
    const currentState = getLocalState();
    
    // Save to localStorage immediately
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      // quota / private mode
    }

    // Schedule remote sync to Supabase
    debouncedRemoteSync(currentState);
  };

  // Subscribe to changes in all 5 core stores
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
