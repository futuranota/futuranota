import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createPasswordEntry, normalizePasswordEntries } from "../lib/vaultBlocks.js";
import { generateId } from "../lib/ids.js";

const STORAGE_KEY = "futuranota.passwordTableEntries.v1";

/**
 * @typedef {Object} PasswordTableStoredEntry
 * @property {string} id
 * @property {string|null} objectId
 * @property {string} description
 * @property {string} password
 * @property {string} tag
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
 * @param {Partial<PasswordTableStoredEntry> & { id?: string }} entry
 * @returns {PasswordTableStoredEntry}
 */
function normalizeStoredEntry(entry) {
  const pwd = createPasswordEntry(entry);
  const now = new Date().toISOString();
  return {
    id: String(entry?.id || pwd.id || generateId("PWD")),
    objectId: entry?.objectId ?? null,
    description: pwd.description,
    password: pwd.password,
    tag: pwd.tag,
    createdAt: entry?.createdAt || now,
    updatedAt: entry?.updatedAt || now,
  };
}

export const usePasswordTableStore = create(
  devtools(
    (set, get) => ({
      entries: readStoredEntries(),

      /** @param {PasswordTableStoredEntry[]} entries */
      replaceEntries: (entries) => {
        const normalized = (entries || []).map((entry) => normalizeStoredEntry(entry));
        persistEntries(normalized);
        set({ entries: normalized });
      },

      /**
       * @param {string} objectId
       * @param {import("../lib/vaultBlocks.js").PasswordEntry} entry
       * @returns {PasswordTableStoredEntry|null}
       */
      addEntry: (objectId, entry) => {
        if (!objectId || !entry) return null;
        const normalizedPwds = normalizePasswordEntries([entry]);
        if (!normalizedPwds.length) return null;

        const now = new Date().toISOString();
        const nextEntry = normalizeStoredEntry({
          ...normalizedPwds[0],
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
       * @param {import("../lib/vaultBlocks.js").PasswordEntry[]} nextEntries
       */
      replaceEntriesForObject: (objectId, nextEntries) => {
        if (!objectId) return;
        const now = new Date().toISOString();
        const existingById = new Map(
          get().entries
            .filter((entry) => entry.objectId === objectId)
            .map((entry) => [entry.id, entry]),
        );

        const normalized = normalizePasswordEntries(nextEntries || []).map((entry) => {
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
    { name: "PasswordTableStore" },
  ),
);
