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
      const data = JSON.parse(raw);
      if (data.objects) useObjectsStore.setState({ objects: data.objects });
      if (data.docs) useDocsStore.setState({ docs: data.docs });
      if (data.nodes) useNodesStore.setState({ nodes: data.nodes });
      if (data.canvasNodes || data.canvasConnections || data.groupings) {
        useCanvasStore.setState({
          canvasNodes: data.canvasNodes || {},
          canvasConnections: data.canvasConnections || {},
          groupings: data.groupings || {},
        });
      }
      if (data.timelines) {
        useTimelineStore.setState({
          timelines: data.timelines,
          currentTier: data.currentTier || "objects",
        });
      }
    }
  } catch {
    /* corrupt snapshot */
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
