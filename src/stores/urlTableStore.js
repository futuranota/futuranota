import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createLinkEntry, normalizeLinkEntries } from "../lib/vaultBlocks.js";
import { generateId } from "../lib/ids.js";

const STORAGE_KEY = "futuranota.urlTableEntries.v1";

/**
 * @typedef {Object} UrlTableStoredEntry
 * @property {string} id
 * @property {string|null} objectId
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
       * @param {string} objectId
       * @param {import("../lib/vaultBlocks.js").LinkEntry} entry
       * @returns {UrlTableStoredEntry|null}
       */
      addEntry: (objectId, entry) => {
        if (!objectId || !entry) return null;
        const normalizedLinks = normalizeLinkEntries([entry]);
        if (!normalizedLinks.length) return null;

        const now = new Date().toISOString();
        const nextEntry = normalizeStoredEntry({
          ...normalizedLinks[0],
          objectId,
          createdAt: now,
          updatedAt: now,
        });

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
       * Replace all entries for one company (overlay Save).
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

      /** @param {string|null} objectId */
      getEntriesForObject: (objectId) => {
        if (!objectId) return [];
        return get().entries.filter((entry) => entry.objectId === objectId);
      },
    }),
    { name: "UrlTableStore" },
  ),
);
