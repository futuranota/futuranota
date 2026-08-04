import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createTodoItem } from "../lib/docBlocks.js";
import { generateId } from "../lib/ids.js";
import { lazyTodoHasContent } from "../lib/lazyTodoItemKeyDown.js";

const STORAGE_KEY = "futuranota.lazyTodos.v3";
/** Shared with lazyTodosSync for cross-tab tombstone adoption. */
export const LAZY_TODOS_DELETED_STORAGE_KEY = "futuranota.lazyTodos.deleted.v1";
const DELETED_STORAGE_KEY = LAZY_TODOS_DELETED_STORAGE_KEY;

/** @typedef {'queued' | 'active'} LazyTodoStatus */

/**
 * @typedef {Object} LazyTodoItem
 * @property {string} id
 * @property {string|null} objectId
 * @property {string|null} [documentId] Linked document (node) id for Gina / in-doc create.
 * @property {string} reminder
 * @property {string} listTitle
 * @property {{ id: string, text: string, checked: boolean }[]} items
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {LazyTodoStatus} status
 * @property {boolean} [pendingSync] True until first successful remote upsert (survives empty-remote hydrate).
 */

function readStoredItems() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem("futuranota.lazyTodos.v2")
      || localStorage.getItem("futuranota.lazyTodos.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string")
      .map((item) => normalizeItem(item));
  } catch {
    return [];
  }
}

function persistItems(items) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

function readDeletedIds() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && id);
  } catch {
    return [];
  }
}

function persistDeletedIds(ids) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
}

function normalizeTodoItems(rawItems, legacyTodo = "") {
  if (Array.isArray(rawItems) && rawItems.length) {
    return rawItems.map((item) => createTodoItem({
      id: item?.id,
      text: item?.text ?? "",
      checked: Boolean(item?.checked),
    }));
  }
  const legacyText = String(legacyTodo ?? "").trim();
  if (legacyText) {
    return [createTodoItem({ text: legacyText, checked: false })];
  }
  return [createTodoItem()];
}

function normalizeItem(item) {
  const items = normalizeTodoItems(item?.items, item?.todo);
  const createdAt = item?.createdAt || new Date().toISOString();
  const documentId = item?.documentId != null && String(item.documentId).trim()
    ? String(item.documentId).trim()
    : null;
  const next = {
    id: String(item?.id || generateId("LAZY")),
    objectId: item?.objectId ?? null,
    documentId,
    reminder: String(item?.reminder ?? ""),
    listTitle: String(item?.listTitle ?? "To do").trim() || "To do",
    items,
    createdAt,
    updatedAt: item?.updatedAt || createdAt,
    status: item?.status === "active" ? "active" : "queued",
  };
  if (item?.pendingSync === true) next.pendingSync = true;
  return next;
}

function nowIso() {
  return new Date().toISOString();
}

export const useLazyTodosStore = create(
  devtools(
    (set, get) => ({
      items: readStoredItems(),
      deletedIds: readDeletedIds(),

      replaceItems: (items) => {
        const deleted = new Set(get().deletedIds);
        const normalized = items
          .map((item) => normalizeItem(item))
          .filter((item) => !deleted.has(item.id));
        persistItems(normalized);
        set({ items: normalized });
      },

      markDeleted: (ids) => {
        const next = new Set(get().deletedIds);
        for (const id of ids || []) {
          if (id) next.add(String(id));
        }
        const list = [...next];
        persistDeletedIds(list);
        set({ deletedIds: list });
      },

      clearDeletedIds: (ids) => {
        if (!ids?.length) return;
        const remove = new Set(ids);
        const list = get().deletedIds.filter((id) => !remove.has(id));
        persistDeletedIds(list);
        set({ deletedIds: list });
      },

      /**
       * After a successful remote upsert, clear pendingSync so empty-remote
       * hydrates can drop the id if it later disappears from Supabase.
       * @param {string[]} ids
       */
      markSynced: (ids) => {
        const syncSet = new Set((ids || []).filter(Boolean));
        if (!syncSet.size) return;
        set((state) => {
          let changed = false;
          const items = state.items.map((item) => {
            if (!syncSet.has(item.id) || !item.pendingSync) return item;
            changed = true;
            const next = normalizeItem({ ...item, pendingSync: false });
            delete next.pendingSync;
            return next;
          });
          if (!changed) return state;
          persistItems(items);
          return { items };
        });
      },

      createDraftItem: (objectId = null, extras = {}) => {
        const stamp = nowIso();
        const documentId = extras?.documentId != null && String(extras.documentId).trim()
          ? String(extras.documentId).trim()
          : null;
        const nextItem = normalizeItem({
          id: generateId("LAZY"),
          objectId: objectId || null,
          documentId,
          reminder: "",
          listTitle: "To do",
          items: [createTodoItem()],
          createdAt: stamp,
          updatedAt: stamp,
          status: "active",
          pendingSync: true,
        });

        set((state) => {
          const next = [...state.items, nextItem];
          persistItems(next);
          return { items: next };
        });

        return nextItem;
      },

      addItem: ({
        objectId = null,
        documentId = null,
        reminder = "",
        listTitle = "To do",
        items = [createTodoItem()],
        status = "queued",
      }) => {
        const normalizedItems = normalizeTodoItems(items);
        const payload = {
          reminder: String(reminder ?? ""),
          listTitle,
          items: normalizedItems,
        };
        if (!lazyTodoHasContent(payload)) return null;

        const stamp = nowIso();
        const nextItem = normalizeItem({
          id: generateId("LAZY"),
          objectId: objectId || null,
          documentId: documentId || null,
          ...payload,
          createdAt: stamp,
          updatedAt: stamp,
          status,
          pendingSync: true,
        });

        set((state) => {
          const deletedIds = state.deletedIds.filter((id) => id !== nextItem.id);
          persistDeletedIds(deletedIds);
          const next = [...state.items, nextItem];
          persistItems(next);
          return { items: next, deletedIds };
        });

        return nextItem;
      },

      removeItem: (id) => {
        if (!id) return;
        set((state) => {
          const items = state.items.filter((item) => item.id !== id);
          const deletedIds = state.deletedIds.includes(id)
            ? state.deletedIds
            : [...state.deletedIds, id];
          persistItems(items);
          persistDeletedIds(deletedIds);
          return { items, deletedIds };
        });
      },

      updateItem: (id, patch) => {
        if (!id) return;
        set((state) => {
          const items = state.items.map((item) => {
            if (item.id !== id) return item;
            const next = normalizeItem({
              ...item,
              ...patch,
              id: item.id,
              createdAt: item.createdAt,
              updatedAt: nowIso(),
              pendingSync: patch.pendingSync !== undefined
                ? patch.pendingSync
                : item.pendingSync,
              items: patch.items != null
                ? normalizeTodoItems(patch.items)
                : item.items,
            });
            if (patch.pendingSync === false) delete next.pendingSync;
            return next;
          });
          persistItems(items);
          return { items };
        });
      },

      parkItem: (item) => {
        const normalized = normalizeItem({
          ...item,
          status: "queued",
          updatedAt: nowIso(),
        });
        if (!lazyTodoHasContent(normalized)) {
          if (normalized.id) get().removeItem(normalized.id);
          return null;
        }

        const existing = get().items.find((entry) => entry.id === normalized.id);
        if (existing) {
          get().updateItem(normalized.id, {
            reminder: normalized.reminder,
            listTitle: normalized.listTitle,
            items: normalized.items,
            status: "queued",
          });
          return normalized;
        }

        return get().addItem({
          objectId: normalized.objectId,
          documentId: normalized.documentId,
          reminder: normalized.reminder,
          listTitle: normalized.listTitle,
          items: normalized.items,
          status: "queued",
        });
      },

      activateItem: (id) => {
        if (!id) return;
        get().updateItem(id, { status: "active" });
      },

      /**
       * After reload/HMR the overlay closes but items can stay `active` and
       * disappear from Unfinished (queued-only). Requeue those with content;
       * drop empty active drafts.
       * @param {string|null} [exceptId] Keep this id active (currently open overlay).
       */
      requeueOrphanedActives: (exceptId = null) => {
        const state = get();
        /** @type {LazyTodoItem[]} */
        const items = [];
        const deletedIds = [...state.deletedIds];
        let changed = false;

        for (const item of state.items) {
          if (item.status !== "active" || (exceptId && item.id === exceptId)) {
            items.push(item);
            continue;
          }
          if (!lazyTodoHasContent(item)) {
            changed = true;
            if (item.id && !deletedIds.includes(item.id)) {
              deletedIds.push(item.id);
            }
            continue;
          }
          changed = true;
          items.push(normalizeItem({
            ...item,
            status: "queued",
            updatedAt: nowIso(),
          }));
        }

        if (!changed) return;
        persistItems(items);
        persistDeletedIds(deletedIds);
        set({ items, deletedIds });
      },

      getQueuedForObject: (objectId) => {
        const items = get().items;
        return items.filter((item) => (
          item.status === "queued"
          && (objectId ? item.objectId === objectId : !item.objectId)
        ));
      },
    }),
    { name: "LazyTodosStore" },
  ),
);
