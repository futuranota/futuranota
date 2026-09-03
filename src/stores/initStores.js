import { useObjectsStore } from "./objectsStore.js";
import { useDocsStore } from "./docsStore.js";
import { useNodesStore } from "./nodesStore.js";
import { useCanvasStore } from "./canvasStore.js";
import { useTimelineStore } from "./timelineStore.js";
import { pruneStrayDefaultYo } from "../lib/storeSanitize.js";
import { initSyncMiddleware } from "./middleware/syncMiddleware.js";
import { initPersistenceMiddleware } from "./middleware/persistenceMiddleware.js";
import { useLazyTodosStore } from "./lazyTodosStore.js";
import { initLazyTodosSync } from "../lib/lazyTodosSync.js";
import { useUrlTableStore } from "./urlTableStore.js";
import { initUrlTableSync } from "../lib/urlTableSync.js";
import { useUrlTablesStore } from "./urlTablesStore.js";
import { initUrlTablesSync } from "../lib/urlTablesSync.js";
import { migrateLocalUrlEntriesToTables } from "../lib/urlTableLibrary.js";
import { usePasswordTableStore } from "./passwordTableStore.js";
import { initPasswordTableSync } from "../lib/passwordTableSync.js";
import { migrateVaultTablesFromCampaignDocs } from "../lib/migrateVaultTablesFromCampaigns.js";
import { useDepartmentsStore } from "./departmentsStore.js";
import { initDepartmentsSync } from "../lib/departmentsSync.js";
import { restoreMisclassifiedGuestCorpora } from "../lib/objectPlanLimits.js";

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
  initUrlTablesSync(useUrlTablesStore);
  initUrlTableSync(useUrlTableStore);
  migrateLocalUrlEntriesToTables();
  initPasswordTableSync(usePasswordTableStore);
  initDepartmentsSync(useDepartmentsStore);

  const restoreCorpusRoles = () => {
    const objects = useObjectsStore.getState().objects;
    const departments = useDepartmentsStore.getState().departments;
    const docs = useDocsStore.getState().docs;
    const next = restoreMisclassifiedGuestCorpora(objects, departments, docs);
    if (next !== objects) useObjectsStore.setState({ objects: next });
  };
  restoreCorpusRoles();
  window.setTimeout(restoreCorpusRoles, 800);
  initSyncMiddleware();

  // After campaigns hydrate from localStorage/Supabase, migrate dedicated vault docs once.
  window.setTimeout(() => {
    migrateVaultTablesFromCampaignDocs().catch((err) => {
      console.warn("[vault-migrate]", err);
    });
  }, 2500);
}

/** Never invent a default company — empty means wait for cloud hydrate. */
export function seedDefaultWorkspaceIfEmpty() {
  const { objects } = useObjectsStore.getState();
  const pruned = pruneStrayDefaultYo(objects);
  if (pruned !== objects) {
    useObjectsStore.setState({ objects: pruned });
  }
}
