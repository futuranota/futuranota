import { useObjectsStore } from "./objectsStore.js";
import { useDocsStore } from "./docsStore.js";
import { useNodesStore } from "./nodesStore.js";
import { useCanvasStore } from "./canvasStore.js";
import { useTimelineStore } from "./timelineStore.js";
import { findObjectIdByName, pruneStrayDefaultYo } from "../lib/storeSanitize.js";
import { initSyncMiddleware } from "./middleware/syncMiddleware.js";
import { initPersistenceMiddleware } from "./middleware/persistenceMiddleware.js";
import { useLazyTodosStore } from "./lazyTodosStore.js";
import { initLazyTodosSync } from "../lib/lazyTodosSync.js";

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
  initLazyTodosSync(useLazyTodosStore);
  initSyncMiddleware();
}

/** Default empty workspace — only after persistence load, never before remote hydrate. */
export function seedDefaultWorkspaceIfEmpty() {
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
}
