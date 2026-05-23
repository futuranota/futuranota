import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";

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

      addObject: (name, description = "", color = "#6366f1") =>
        set((state) => {
          const id = generateId("OBJ");
          return {
            objects: {
              ...state.objects,
              [id]: {
                id,
                name,
                description,
                children: [],
                color,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

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

      deleteObjectWithCascade: (id) => get().deleteObject(id),
    }),
    { name: "ObjectsStore" },
  ),
);
