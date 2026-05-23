import { useDocsStore } from "../stores/docsStore.js";

/** Sync status for a doc (canvas ↔ doc) */
export function useSyncState(docId) {
  const doc = useDocsStore((s) => (docId ? s.docs[docId] : null));
  return {
    syncedWithCanvas: doc?.syncedWithCanvas ?? true,
    docId,
    markSynced: () => docId && useDocsStore.getState().setSyncedWithCanvas(docId, true),
    markUnsynced: () => docId && useDocsStore.getState().setSyncedWithCanvas(docId, false),
  };
}
