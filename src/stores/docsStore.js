import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { useObjectsStore } from "./objectsStore.js";
import {
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
} from "../lib/docBlocks.js";

export const useDocsStore = create(
  devtools(
    (set, get) => ({
      docs: {},

      getDoc: (id) => get().docs[id] || null,

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
      ) => {
        const id = generateId("DOC");
        const tagList = Array.isArray(tags)
          ? tags.map((t) => String(t).trim()).filter(Boolean)
          : [];
        const body = String(initialContent ?? "");
        const blocks = normalizeDocBlocks(initialBlocks || docBlocksFromBody(body));
        const normalizedBody = docBlocksToBody(blocks) || body;
        const created = createdAt || new Date().toISOString();
        set((state) => ({
          docs: {
            ...state.docs,
            [id]: {
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
            },
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
              [id]: { ...doc, ...nextPatch, updatedAt: new Date().toISOString() },
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

      deleteDoc: (id) =>
        set((state) => {
          const doc = state.docs[id];
          if (doc?.parentObjectId) {
            useObjectsStore.getState().removeChildDoc(doc.parentObjectId, id);
          }
          const next = { ...state.docs };
          delete next[id];
          return { docs: next };
        }),
    }),
    { name: "DocsStore" },
  ),
);
