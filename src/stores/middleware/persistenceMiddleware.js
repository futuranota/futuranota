import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { sanitizePersistedSnapshot } from "../../lib/storeSanitize.js";

const STORAGE_KEY = "futura-nota-v1";

let initialized = false;
let saveTimer = null;

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

  const getState = () => ({
    objects: useObjectsStore.getState().objects,
    docs: useDocsStore.getState().docs,
    nodes: useNodesStore.getState().nodes,
    canvasNodes: useCanvasStore.getState().canvasNodes,
    canvasConnections: useCanvasStore.getState().canvasConnections,
    groupings: useCanvasStore.getState().groupings,
    timelines: useTimelineStore.getState().timelines,
    currentTier: useTimelineStore.getState().currentTier,
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = sanitizePersistedSnapshot(parsed);
      if (!data) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        useObjectsStore.setState({ objects: data.objects });
        const normalizedDocs = {};
        for (const [id, doc] of Object.entries(data.docs)) {
          normalizedDocs[id] = normalizeDoc(doc);
        }
        useDocsStore.setState({ docs: normalizedDocs });
        useNodesStore.setState({ nodes: data.nodes });
        useCanvasStore.setState({
          canvasNodes: data.canvasNodes,
          canvasConnections: data.canvasConnections,
          groupings: data.groupings,
        });
        if (data.timelines) {
          useTimelineStore.setState({
            timelines: data.timelines,
            currentTier: data.currentTier,
          });
        }
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
      } catch {
        /* quota / private mode */
      }
    }, 400);
  };

  [
    useObjectsStore,
    useDocsStore,
    useNodesStore,
    useCanvasStore,
    useTimelineStore,
  ].forEach((store) => {
    store.subscribe(scheduleSave);
  });
}

export { STORAGE_KEY };
