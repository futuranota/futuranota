import { useObjectsStore } from "./objectsStore.js";
import { useDocsStore } from "./docsStore.js";
import { useNodesStore } from "./nodesStore.js";
import { useCanvasStore } from "./canvasStore.js";
import { useTimelineStore } from "./timelineStore.js";
import { initSyncMiddleware } from "./middleware/syncMiddleware.js";
import { initPersistenceMiddleware } from "./middleware/persistenceMiddleware.js";

let seeded = false;

export function initStores() {
  if (seeded) return;
  seeded = true;

  const stores = {
    useObjectsStore,
    useDocsStore,
    useNodesStore,
    useCanvasStore,
    useTimelineStore,
  };

  initPersistenceMiddleware(stores);

  const { objects, addObject } = useObjectsStore.getState();
  const hasYo = Object.values(objects).some((o) => o.name.toLowerCase() === "yo");
  if (!hasYo) {
    addObject("yo", "");
  }

  initSyncMiddleware();
}
