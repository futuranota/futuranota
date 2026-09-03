import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import {
  OBJECT_ROLE_CORPUS,
  OBJECT_ROLE_GUEST,
  OBJECT_ROLE_SATELLITE,
  resolveDefaultObjectColor,
} from "../lib/objectColors.js";
import { useDocsStore } from "./docsStore.js";
import { useNodesStore } from "./nodesStore.js";
import {
  flushPersistenceSync,
  markCompaniesDeletedForSync,
} from "./middleware/persistenceMiddleware.js";
import { archiveCompanyBundleDelete } from "../lib/workspaceTrashArchive.js";

export const useObjectsStore = create(
  devtools(
    (set, get) => ({
      objects: {},

      getObject: (id) => get().objects[id] || null,

      getAllObjects: () => Object.values(get().objects),

      getObjectWithChildren: (id) => {
        const obj = get().objects[id];
        if (!obj) return null;
        return { ...obj };
      },

      addObject: (name, description = "", color, brand = "", role) => {
        const id = generateId("OBJ");
        const existingCount = Object.keys(get().objects).length;
        const resolvedRole = role === OBJECT_ROLE_GUEST
          ? OBJECT_ROLE_GUEST
          : role === OBJECT_ROLE_CORPUS
            ? OBJECT_ROLE_CORPUS
            : role === OBJECT_ROLE_SATELLITE
              ? OBJECT_ROLE_SATELLITE
              : (existingCount === 0 ? OBJECT_ROLE_CORPUS : OBJECT_ROLE_SATELLITE);
        const resolvedColor = color || resolveDefaultObjectColor(
          resolvedRole === OBJECT_ROLE_GUEST ? 1 : (resolvedRole === OBJECT_ROLE_CORPUS ? 0 : existingCount),
        );
        set((state) => ({
          objects: {
            ...state.objects,
            [id]: {
              id,
              name,
              description,
              brand: typeof brand === "string" ? brand : "",
              children: [],
              color: resolvedColor,
              role: resolvedRole,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        }));
        flushPersistenceSync().catch((err) => {
          console.warn("Flush after company create failed:", err?.message || err);
        });
        return id;
      },

      createObject: (name, description = "") => get().addObject(name, description),

      updateObject: (id, updates) =>
        set((state) => {
          const obj = state.objects[id];
          if (!obj) return state;
          return {
            objects: {
              ...state.objects,
              [id]: {
                ...obj,
                ...updates,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      deleteObject: (id) => {
        const before = get().objects?.[id] || null;
        // #region agent log
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'040b1a'},body:JSON.stringify({sessionId:'040b1a',runId:'post-fix-v2',hypothesisId:'H-A',location:'objectsStore.js:deleteObject',message:'mark tombstone + remove local object',data:{id,name:before?.name||null,role:before?.role||null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        markCompaniesDeletedForSync(id);
        set((state) => {
          const next = { ...state.objects };
          delete next[id];
          return { objects: next };
        });
        flushPersistenceSync().catch((err) => {
          console.warn("Flush after corpus delete failed:", err);
          // #region agent log
          fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'040b1a'},body:JSON.stringify({sessionId:'040b1a',runId:'pre-fix',hypothesisId:'H-B',location:'objectsStore.js:flushFailed',message:'Flush after corpus delete failed',data:{id,error:String(err?.message||err)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        });
      },

      addChildDoc: (objectId, docId) =>
        set((state) => {
          const obj = state.objects[objectId];
          if (!obj || obj.children.includes(docId)) return state;
          return {
            objects: {
              ...state.objects,
              [objectId]: {
                ...obj,
                children: [...obj.children, docId],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      addDocToObject: (objectId, docId) => get().addChildDoc(objectId, docId),

      removeChildDoc: (objectId, docId) =>
        set((state) => {
          const obj = state.objects[objectId];
          if (!obj) return state;
          return {
            objects: {
              ...state.objects,
              [objectId]: {
                ...obj,
                children: obj.children.filter((cid) => cid !== docId),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      removeDocFromObject: (objectId, docId) => get().removeChildDoc(objectId, docId),

      deleteObjectWithCascade: (id) => {
        const company = get().objects[id];
        const docs = useDocsStore.getState().getDocsByObject(id);
        const nodeMap = useNodesStore.getState().nodes || {};
        const nodes = [];
        for (const doc of docs) {
          for (const node of useNodesStore.getState().getNodesByDoc(doc.id)) {
            if (node?.id) nodes.push(node);
          }
        }
        for (const node of Object.values(nodeMap)) {
          if (node?.id && !nodes.some((entry) => entry.id === node.id)) {
            if (docs.some((doc) => (doc.nodeIds || []).includes(node.id))) {
              nodes.push(node);
            }
          }
        }
        archiveCompanyBundleDelete(company, docs, nodes, { source: "user_confirm" });
        const skipTrashArchive = { skipTrashArchive: true };
        for (const doc of docs) {
          useDocsStore.getState().deleteDoc(doc.id, skipTrashArchive);
        }
        get().deleteObject(id);
      },
    }),
    { name: "ObjectsStore" },
  ),
);
