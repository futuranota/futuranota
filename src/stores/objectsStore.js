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

      deleteObject: (id) =>
        set((state) => {
          const next = { ...state.objects };
          delete next[id];
          return { objects: next };
        }),

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
        const docs = useDocsStore.getState().getDocsByObject(id);
        for (const doc of docs) {
          useDocsStore.getState().deleteDoc(doc.id);
        }
        get().deleteObject(id);
      },
    }),
    { name: "ObjectsStore" },
  ),
);
