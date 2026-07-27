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
 * @property {string} reminder
 * @property {string} listTitle
 * @property {{ id: string, text: string, checked: boolean }[]} items
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {LazyTodoStatus} status
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
  return {
    id: String(item?.id || generateId("LAZY")),
    objectId: item?.objectId ?? null,
    reminder: String(item?.reminder ?? ""),
    listTitle: String(item?.listTitle ?? "To do").trim() || "To do",
    items,
    createdAt,
    updatedAt: item?.updatedAt || createdAt,
    status: item?.status === "active" ? "active" : "queued",
  };
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
        // #region agent log
        fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5c112'},body:JSON.stringify({sessionId:'b5c112',runId:'run1',hypothesisId:'H-D',location:'lazyTodosStore.js:clearDeletedIds',message:'tombstones cleared',data:{cleared:ids,remaining:list},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        persistDeletedIds(list);
        set({ deletedIds: list });
      },

      createDraftItem: (objectId = null) => {
        const stamp = nowIso();
        const nextItem = normalizeItem({
          id: generateId("LAZY"),
          objectId: objectId || null,
          reminder: "",
          listTitle: "To do",
          items: [createTodoItem()],
          createdAt: stamp,
          updatedAt: stamp,
          status: "active",
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
          ...payload,
          createdAt: stamp,
          updatedAt: stamp,
          status,
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
          // #region agent log
          fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5c112'},body:JSON.stringify({sessionId:'b5c112',runId:'run1',hypothesisId:'H-A',location:'lazyTodosStore.js:removeItem',message:'tombstone + remove local',data:{id,itemsLeft:items.length,deletedIds},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
              items: patch.items != null
                ? normalizeTodoItems(patch.items)
                : item.items,
            });
            // #region agent log
            if (patch.items != null) {
              fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b5c112'},body:JSON.stringify({sessionId:'b5c112',runId:'run1',hypothesisId:'H-E',location:'lazyTodosStore.js:updateItem',message:'checklist patch',data:{id,checkedBefore:(item.items||[]).filter((i)=>i.checked).length,checkedAfter:(next.items||[]).filter((i)=>i.checked).length,updatedAt:next.updatedAt},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
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
