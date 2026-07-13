import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useObjectsStore } from "./objectsStore.js";
import { useNodesStore } from "./nodesStore.js";
import {
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
} from "../lib/docBlocks.js";
import { emptyDocCampaignFields, normalizeDoc } from "../lib/normalizeDoc.js";
import {
  flushPersistenceSync,
  markDocsDeletedForSync,
} from "./middleware/persistenceMiddleware.js";

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
              nodeLinkColor: campaign.nodeLinkColor,
              knowledgeImport: campaign.knowledgeImport ?? null,
              reportPresentation: campaign.reportPresentation ?? null,
            }),
          },
        }));
        if (parentObjectId) {
          useObjectsStore.getState().addChildDoc(parentObjectId, id);
        }
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
          return {
            docs: {
              ...state.docs,
              [id]: normalizeDoc({ ...doc, ...nextPatch, updatedAt: new Date().toISOString() }),
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

      deleteDoc: (id) => {
        const linkedNodes = useNodesStore.getState().getNodesByDoc(id);
        const linkedNodeIds = linkedNodes.map((node) => node.id).filter(Boolean);
        // Tombstone before local remove so an in-flight hydrate cannot resurrect.
        markDocsDeletedForSync(id, linkedNodeIds);
        for (const node of linkedNodes) {
          useNodesStore.getState().deleteNode(node.id);
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
        // #region agent log
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'79f8b7'},body:JSON.stringify({sessionId:'79f8b7',runId:'pre-fix',hypothesisId:'A',location:'docsStore.js:deleteDoc',message:'folder removed from store',data:{deletedId:id,remainingDocIds:Object.keys(get().docs),remainingCount:Object.keys(get().docs).length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        flushPersistenceSync().catch((err) => {
          console.warn("Flush after folder delete failed:", err);
        });
      },
    }),
    { name: "DocsStore" },
  ),
);
