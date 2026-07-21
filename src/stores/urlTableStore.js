import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createLinkEntry, normalizeLinkEntries } from "../lib/vaultBlocks.js";
import { generateId } from "../lib/ids.js";
import {
  collectTagCandidatesForObject,
  findTagConflictInTable,
} from "../lib/urlTableTags.js";

const STORAGE_KEY = "futuranota.urlTableEntries.v1";

/**
 * @typedef {Object} UrlTableStoredEntry
 * @property {string} id
 * @property {string|null} objectId
 * @property {string|null} tableId
 * @property {string} name
 * @property {string} tag
 * @property {string} category
 * @property {string} description
 * @property {string} url
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function readStoredEntries() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.id === "string")
      .map((entry) => normalizeStoredEntry(entry));
  } catch {
    return [];
  }
}

function persistEntries(entries) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * @param {Partial<UrlTableStoredEntry> & { id?: string }} entry
 * @returns {UrlTableStoredEntry}
 */
function normalizeStoredEntry(entry) {
  const link = createLinkEntry(entry);
  const now = new Date().toISOString();
  return {
    id: String(entry?.id || link.id || generateId("LNK")),
    objectId: entry?.objectId ?? null,
    tableId: entry?.tableId ?? null,
    name: link.name,
    tag: link.tag,
    category: link.category,
    description: link.description,
    url: link.url,
    createdAt: entry?.createdAt || now,
    updatedAt: entry?.updatedAt || now,
  };
}

export const useUrlTableStore = create(
  devtools(
    (set, get) => ({
      entries: readStoredEntries(),

      /** @param {UrlTableStoredEntry[]} entries */
      replaceEntries: (entries) => {
        const normalized = (entries || []).map((entry) => normalizeStoredEntry(entry));
        persistEntries(normalized);
        set({ entries: normalized });
      },

      /**
       * @param {string} tableId
       * @param {string|null} objectId
       * @param {import("../lib/vaultBlocks.js").LinkEntry} entry
       * @returns {UrlTableStoredEntry|null}
       */
      addEntry: (tableId, objectId, entry) => {
        if (!tableId || !entry) return null;
        const normalizedLinks = normalizeLinkEntries([entry]);
        if (!normalizedLinks.length) return null;

        const now = new Date().toISOString();
        const nextEntry = normalizeStoredEntry({
          ...normalizedLinks[0],
          tableId,
          objectId: objectId ?? null,
          createdAt: now,
          updatedAt: now,
        });

        const conflict = findTagConflictInTable(
          get().entries,
          tableId,
          nextEntry.tag,
          nextEntry.id,
        );
        if (conflict.conflict) {
          console.warn("[url-table] Tag already used in this table", nextEntry.tag);
          return null;
        }

        set((state) => {
          if (state.entries.some((item) => item.id === nextEntry.id)) {
            const entries = state.entries.map((item) => (
              item.id === nextEntry.id
                ? { ...nextEntry, createdAt: item.createdAt, updatedAt: now }
                : item
            ));
            persistEntries(entries);
            return { entries };
          }
          const entries = [...state.entries, nextEntry];
          persistEntries(entries);
          return { entries };
        });

        return nextEntry;
      },

      /** @param {string} id */
      removeEntry: (id) => {
        if (!id) return;
        set((state) => {
          const entries = state.entries.filter((entry) => entry.id !== id);
          persistEntries(entries);
          return { entries };
        });
      },

      /**
       * Replace all entries for one table.
       * @param {string} tableId
       * @param {string|null} objectId
       * @param {import("../lib/vaultBlocks.js").LinkEntry[]} nextEntries
       */
      replaceEntriesForTable: (tableId, objectId, nextEntries) => {
        if (!tableId) return false;
        const now = new Date().toISOString();
        const existingById = new Map(
          get().entries
            .filter((entry) => entry.tableId === tableId)
            .map((entry) => [entry.id, entry]),
        );

        const normalized = normalizeLinkEntries(nextEntries || []).map((entry) => {
          const prev = existingById.get(entry.id);
          return normalizeStoredEntry({
            ...entry,
            tableId,
            objectId: objectId ?? prev?.objectId ?? null,
            createdAt: prev?.createdAt || now,
            updatedAt: now,
          });
        });

        for (const entry of normalized) {
          // Cross-table duplicates are allowed. Only block within this table payload.
          const internal = findTagConflictInTable(
            normalized.map((item) => ({ ...item, tableId })),
            tableId,
            entry.tag,
            entry.id,
          );
          if (internal.conflict) {
            console.warn("[url-table] Duplicate tags inside one table save", entry.tag);
            return false;
          }
        }

        set((state) => {
          const rest = state.entries.filter((entry) => entry.tableId !== tableId);
          const entries = [...rest, ...normalized];
          persistEntries(entries);
          return { entries };
        });
        return true;
      },

      /**
       * Tag candidates for a company (one per entry; duplicate tag text preserved).
       * @param {string|null} objectId
       */
      getUniqueTagsForObject: (objectId) => (
        collectTagCandidatesForObject(get().entries, objectId)
      ),

      getTagCandidatesForObject: (objectId) => (
        collectTagCandidatesForObject(get().entries, objectId)
      ),

      /** Remove every entry belonging to a table. */
      removeEntriesForTable: (tableId) => {
        if (!tableId) return;
        set((state) => {
          const entries = state.entries.filter((entry) => entry.tableId !== tableId);
          persistEntries(entries);
          return { entries };
        });
      },

      /** @param {string|null} tableId */
      getEntriesForTable: (tableId) => {
        if (!tableId) return [];
        return get().entries.filter((entry) => entry.tableId === tableId);
      },

      /** @deprecated Prefer getEntriesForTable — kept for slash/migration helpers */
      getEntriesForObject: (objectId) => {
        if (!objectId) return [];
        return get().entries.filter((entry) => entry.objectId === objectId);
      },

      /**
       * @deprecated Prefer replaceEntriesForTable
       * @param {string} objectId
       * @param {import("../lib/vaultBlocks.js").LinkEntry[]} nextEntries
       */
      replaceEntriesForObject: (objectId, nextEntries) => {
        if (!objectId) return;
        const now = new Date().toISOString();
        const existingById = new Map(
          get().entries
            .filter((entry) => entry.objectId === objectId)
            .map((entry) => [entry.id, entry]),
        );

        const normalized = normalizeLinkEntries(nextEntries || []).map((entry) => {
          const prev = existingById.get(entry.id);
          return normalizeStoredEntry({
            ...entry,
            objectId,
            tableId: prev?.tableId ?? entry.tableId ?? null,
            createdAt: prev?.createdAt || now,
            updatedAt: now,
          });
        });

        set((state) => {
          const others = state.entries.filter((entry) => entry.objectId !== objectId);
          const entries = [...others, ...normalized];
          persistEntries(entries);
          return { entries };
        });
      },
    }),
    { name: "UrlTableStore" },
  ),
);
