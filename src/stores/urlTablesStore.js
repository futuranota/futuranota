import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";

const STORAGE_KEY = "futuranota.urlTables.v1";

/**
 * @typedef {Object} UrlTableMeta
 * @property {string} id
 * @property {string|null} objectId
 * @property {string} title
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {Partial<UrlTableMeta> & { id?: string }} table
 * @returns {UrlTableMeta}
 */
export function normalizeUrlTableMeta(table) {
  const createdAt = table?.createdAt || nowIso();
  return {
    id: String(table?.id || generateId("URLT")),
    objectId: table?.objectId ?? null,
    title: String(table?.title ?? "").trim(),
    createdAt,
    updatedAt: table?.updatedAt || createdAt,
  };
}

function readStoredTables() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((table) => table && typeof table.id === "string")
      .map((table) => normalizeUrlTableMeta(table));
  } catch {
    return [];
  }
}

function persistTables(tables) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch {
    /* ignore quota */
  }
}

export const useUrlTablesStore = create(
  devtools(
    (set, get) => ({
      tables: readStoredTables(),

      /** @param {UrlTableMeta[]} tables */
      replaceTables: (tables) => {
        const normalized = (tables || []).map((table) => normalizeUrlTableMeta(table));
        persistTables(normalized);
        set({ tables: normalized });
      },

      /**
       * @param {{ objectId: string|null, title?: string, id?: string }} patch
       * @returns {UrlTableMeta}
       */
      createTable: ({ objectId = null, title = "", id } = {}) => {
        const now = nowIso();
        const next = normalizeUrlTableMeta({
          id,
          objectId,
          title,
          createdAt: now,
          updatedAt: now,
        });
        set((state) => {
          const tables = [...state.tables, next];
          persistTables(tables);
          return { tables };
        });
        return next;
      },

      /**
       * @param {string} id
       * @param {Partial<UrlTableMeta>} patch
       * @returns {UrlTableMeta|null}
       */
      updateTable: (id, patch) => {
        if (!id) return null;
        const now = nowIso();
        let updated = null;
        set((state) => {
          const tables = state.tables.map((table) => {
            if (table.id !== id) return table;
            updated = normalizeUrlTableMeta({
              ...table,
              ...patch,
              id: table.id,
              createdAt: table.createdAt,
              updatedAt: now,
            });
            return updated;
          });
          persistTables(tables);
          return { tables };
        });
        return updated;
      },

      /** @param {string} id */
      removeTable: (id) => {
        if (!id) return;
        set((state) => {
          const tables = state.tables.filter((table) => table.id !== id);
          persistTables(tables);
          return { tables };
        });
      },

      /** @param {string|null} objectId */
      getTablesForObject: (objectId) => {
        if (!objectId) return [];
        return get().tables
          .filter((table) => table.objectId === objectId)
          .slice()
          .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      },

      /** @param {string} id */
      getTableById: (id) => {
        if (!id) return null;
        return get().tables.find((table) => table.id === id) || null;
      },
    }),
    { name: "UrlTablesStore" },
  ),
);
