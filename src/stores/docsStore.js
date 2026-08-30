import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useObjectsStore } from "./objectsStore.js";
import { useNodesStore } from "./nodesStore.js";
import { useUIStateStore } from "./uiStateStore.js";
import {
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
} from "../lib/docBlocks.js";
import { emptyDocCampaignFields, normalizeDoc } from "../lib/normalizeDoc.js";
import {
  nextSidebarOrderAmong,
  sidebarOrderPatchForIds,
} from "../lib/folderSidebarOrder.js";
import {
  applyVisibleNodeReorder,
  reorderLinkedOwnerBundlesInBlocks,
} from "../lib/folderDocumentOrder.js";
import { collectFolderMemberNodeIds, linkedOwnerNodeIdsInOrder } from "../lib/docNodeSync.js";
import {
  flushPersistenceSync,
  markDocsDeletedForSync,
} from "./middleware/persistenceMiddleware.js";
import { emitWorkspaceFolderDeleteSyncFailed } from "../lib/workspaceDeleteRepair.js";
import { resolveProductDocDisplayTitle } from "../lib/templateDoc.js";
import { archiveFolderDelete } from "../lib/workspaceTrashArchive.js";
import { markDocDirty } from "../lib/docSyncDirty.js";

export const useDocsStore = create(
  devtools(
    (set, get) => ({
      docs: {},

      getDoc: (id) => {
        const doc = get().docs[id];
        return doc ? normalizeDoc(doc) : null;
      },

      getAllDocs: () => Object.values(get().docs),

      getDocsByObject: (objectId) =>
        Object.values(get().docs).filter((doc) => doc.parentObjectId === objectId),

      getDocsByParent: (parentObjectId) => get().getDocsByObject(parentObjectId),

      addDoc: (
        title,
        parentObjectId = null,
        dataProperties = [],
        tags = [],
        initialContent = "",
        createdAt = null,
        initialBlocks = null,
        campaignMeta = {},
      ) => {
        const id = generateId("DOC");
        const tagList = Array.isArray(tags)
          ? tags.map((t) => String(t).trim()).filter(Boolean)
          : [];
        const body = String(initialContent ?? "");
        const blocks = normalizeDocBlocks(initialBlocks || docBlocksFromBody(body));
        const normalizedBody = docBlocksToBody(blocks) || body;
        const created = createdAt || new Date().toISOString();
        const campaign = { ...emptyDocCampaignFields(), ...campaignMeta };
        set((state) => ({
          docs: {
            ...state.docs,
            [id]: normalizeDoc({
              id,
              title,
              parentObjectId,
              content: normalizedBody,
              body: normalizedBody,
              blocks,
              dataProperties,
              tags: tagList,
              nodeIds: [],
              syncedWithCanvas: true,
              createdAt: created,
              updatedAt: new Date().toISOString(),
              docKind: campaign.docKind ?? "standard",
              templateKind: campaign.templateKind ?? null,
              templateSubcategoryDocIds: campaign.subcategoryDocIds ?? campaign.templateSubcategoryDocIds ?? [],
              subcategoryDocIds: campaign.subcategoryDocIds ?? campaign.templateSubcategoryDocIds ?? [],
              version: campaign.version ?? "",
              category: campaign.category ?? "",
              icon: typeof campaign.icon === "string" ? campaign.icon : "",
              departmentId: typeof campaign.departmentId === "string" && campaign.departmentId.trim()
                ? campaign.departmentId.trim()
                : null,
              launchAt: campaign.launchAt
                ?? campaign.scheduleStartAt
                ?? null,
              scheduleStartAt: campaign.scheduleStartAt
                ?? campaign.launchAt
                ?? null,
              scheduleFinishAt: campaign.scheduleFinishAt
                ?? campaign.scheduleStartAt
                ?? campaign.launchAt
                ?? null,
              campaignActive: Boolean(campaign.campaignActive),
              timelineSourceNodeId: campaign.timelineSourceNodeId ?? null,
              nodeLinkColor: campaign.nodeLinkColor,
              viewMode: campaign.viewMode,
              knowledgeImport: campaign.knowledgeImport ?? null,
              reportPresentation: campaign.reportPresentation ?? null,
              sidebarOrder: typeof campaign.sidebarOrder === "number"
                ? campaign.sidebarOrder
                : nextSidebarOrderAmong(
                  Object.values(state.docs).filter((d) => d.parentObjectId === parentObjectId),
                ),
            }),
          },
        }));
        if (parentObjectId) {
          useObjectsStore.getState().addChildDoc(parentObjectId, id);
        }
        markDocDirty(id);
        return id;
      },

      updateDoc: (id, patch) =>
        set((state) => {
          const doc = state.docs[id];
          if (!doc) return state;
          const nextPatch = { ...patch };
          if (Object.prototype.hasOwnProperty.call(nextPatch, "blocks")) {
            const normalizedBlocks = normalizeDocBlocks(nextPatch.blocks);
            const mergedBody = docBlocksToBody(normalizedBlocks);
            nextPatch.blocks = normalizedBlocks;
            if (!Object.prototype.hasOwnProperty.call(nextPatch, "body")) {
              nextPatch.body = mergedBody;
            }
            if (!Object.prototype.hasOwnProperty.call(nextPatch, "content")) {
              nextPatch.content = mergedBody;
            }
          }
          const merged = { ...doc, ...nextPatch, updatedAt: new Date().toISOString() };
          const normalized = normalizeDoc(merged);
          // #region agent log
          if (
            Object.prototype.hasOwnProperty.call(nextPatch, "scheduleStartAt")
            || Object.prototype.hasOwnProperty.call(nextPatch, "scheduleFinishAt")
            || Object.prototype.hasOwnProperty.call(nextPatch, "launchAt")
          ) {
            fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'A',location:'docsStore.js:updateDoc',message:'updateDoc schedule fields after normalize',data:{docId:id,title:doc?.title,patchStart:nextPatch.scheduleStartAt??null,patchFinish:nextPatch.scheduleFinishAt??null,patchLaunch:nextPatch.launchAt??null,mergedStart:merged.scheduleStartAt??null,mergedLaunch:merged.launchAt??null,outStart:normalized?.scheduleStartAt??null,outFinish:normalized?.scheduleFinishAt??null,outLaunch:normalized?.launchAt??null,synthesizedFromLaunch:Boolean(!merged.scheduleStartAt&&merged.launchAt&&normalized?.scheduleStartAt)},timestamp:Date.now()})}).catch(()=>{});
          }
          // #endregion
          markDocDirty(id);
          return {
            docs: {
              ...state.docs,
              [id]: normalized,
            },
          };
        }),

      updateDocTitle: (id, title) => get().updateDoc(id, { title }),

      updateDocContent: (id, content) =>
        set((state) => {
          const doc = state.docs[id];
          if (!doc) return state;
          const text = String(content ?? "");
          const blocks = docBlocksFromBody(text);
          return {
            docs: {
              ...state.docs,
              [id]: {
                ...doc,
                content: text,
                body: text,
                blocks,
                syncedWithCanvas: false,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      updateDocBody: (id, body) => get().updateDocContent(id, body),

      linkDocToObject: (docId, objectId) => {
        const doc = get().docs[docId];
        if (!doc) return;
        if (doc.parentObjectId) {
          useObjectsStore.getState().removeChildDoc(doc.parentObjectId, docId);
        }
        get().updateDoc(docId, { parentObjectId: objectId });
        if (objectId) {
          useObjectsStore.getState().addChildDoc(objectId, docId);
        }
      },

      addNodeToDoc: (docId, nodeId) =>
        set((state) => {
          const doc = state.docs[docId];
          if (!doc) return state;
          const nodeIds = doc.nodeIds?.includes(nodeId)
            ? doc.nodeIds
            : [...(doc.nodeIds || []), nodeId];
          return {
            docs: {
              ...state.docs,
              [docId]: { ...doc, nodeIds, updatedAt: new Date().toISOString() },
            },
          };
        }),

      removeNodeFromDoc: (docId, nodeId) =>
        set((state) => {
          const doc = state.docs[docId];
          if (!doc) return state;
          return {
            docs: {
              ...state.docs,
              [docId]: {
                ...doc,
                nodeIds: (doc.nodeIds || []).filter((id) => id !== nodeId),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      addDataProperty: (docId, propertyName, propertyType) =>
        set((state) => {
          const doc = state.docs[docId];
          if (!doc) return state;
          const newProperty = {
            id: generateId("PROP"),
            name: propertyName,
            type: propertyType,
            value: undefined,
          };
          return {
            docs: {
              ...state.docs,
              [docId]: {
                ...doc,
                dataProperties: [...(doc.dataProperties || []), newProperty],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      updateDataProperty: (docId, propertyId, updates) =>
        set((state) => {
          const doc = state.docs[docId];
          if (!doc) return state;
          return {
            docs: {
              ...state.docs,
              [docId]: {
                ...doc,
                dataProperties: (doc.dataProperties || []).map((prop) =>
                  prop.id === propertyId ? { ...prop, ...updates } : prop,
                ),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setSyncedWithCanvas: (id, synced) =>
        get().updateDoc(id, { syncedWithCanvas: synced }),

      /**
       * Persist Documents-sidebar folder order for the given id sequence (dense 0..n-1).
       * @param {string[]} orderedIds
       */
      reorderDocsSidebar: (orderedIds) => {
        const patchById = sidebarOrderPatchForIds(orderedIds);
        const ids = Object.keys(patchById);
        if (!ids.length) return;
        set((state) => {
          let changed = false;
          const nextDocs = { ...state.docs };
          const now = new Date().toISOString();
          for (const id of ids) {
            const doc = nextDocs[id];
            if (!doc) continue;
            const nextOrder = patchById[id];
            if (doc.sidebarOrder === nextOrder) continue;
            changed = true;
            nextDocs[id] = normalizeDoc({ ...doc, sidebarOrder: nextOrder, updatedAt: now });
          }
          return changed ? { docs: nextDocs } : state;
        });
      },

      /**
       * Reorder documents inside a folder (left-panel collapse list).
       * Updates nodeIds + linked owner block bundles so open-folder order stays aligned.
       * @param {string} folderId
       * @param {string[]} orderedNodeIds visible list order after drop
       */
      reorderFolderDocuments: (folderId, orderedNodeIds) => {
        if (!folderId || !Array.isArray(orderedNodeIds) || !orderedNodeIds.length) return;
        const doc = get().docs[folderId];
        if (!doc) return;

        const nodesById = useNodesStore.getState().nodes || {};
        const memberIds = [
          ...new Set([
            ...(Array.isArray(doc.nodeIds) ? doc.nodeIds.filter(Boolean) : []),
            ...collectFolderMemberNodeIds(folderId, nodesById),
          ]),
        ];
        const nextNodeIds = applyVisibleNodeReorder(memberIds, orderedNodeIds);
        const nextBlocks = reorderLinkedOwnerBundlesInBlocks(doc.blocks, orderedNodeIds);

        get().updateDoc(folderId, {
          nodeIds: nextNodeIds,
          blocks: nextBlocks,
        });

        // Keep open/reopen draft cache aligned with left-panel document order.
        const ownerOrder = linkedOwnerNodeIdsInOrder(nextBlocks);
        const cached = useUIStateStore.getState().docEditorDrafts[folderId];
        if (cached?.blocks?.length && ownerOrder.length) {
          const cachedBlocks = reorderLinkedOwnerBundlesInBlocks(cached.blocks, ownerOrder);
          useUIStateStore.getState().setDocEditorDraft(folderId, {
            ...cached,
            blocks: cachedBlocks,
          });
        }
      },

      deleteDoc: (id, options = {}) => {
        const existing = get().docs[id];
        const linkedNodes = useNodesStore.getState().getNodesByDoc(id);
        const linkedNodeIds = linkedNodes.map((node) => node.id).filter(Boolean);
        const deleteLabel = existing
          ? (resolveProductDocDisplayTitle(existing) || existing.title?.trim() || "Untitled")
          : "Untitled";
        if (!options.skipTrashArchive) {
          archiveFolderDelete(existing, linkedNodes, { source: "user_confirm" });
        }
        // Tombstone before local remove so an in-flight hydrate cannot resurrect.
        markDocsDeletedForSync(id, linkedNodeIds);
        for (const node of linkedNodes) {
          useNodesStore.getState().deleteNode(node.id, options);
        }
        set((state) => {
          const doc = state.docs[id];
          if (doc?.parentObjectId) {
            useObjectsStore.getState().removeChildDoc(doc.parentObjectId, id);
          }
          const next = { ...state.docs };
          delete next[id];
          return { docs: next };
        });
        return flushPersistenceSync()
          .then((result) => {
            if (!result?.ok) {
              emitWorkspaceFolderDeleteSyncFailed({
                docId: id,
                label: deleteLabel,
                error: result?.error,
              });
            }
            return result;
          })
          .catch((err) => {
            emitWorkspaceFolderDeleteSyncFailed({
              docId: id,
              label: deleteLabel,
              error: err,
            });
            console.warn("Flush after folder delete failed:", err);
            return { ok: false, error: err };
          });
      },
    }),
    { name: "DocsStore" },
  ),
);
