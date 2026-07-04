import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createTodoItem } from "../lib/docBlocks.js";
import { generateId } from "../lib/ids.js";
import { lazyTodoHasContent } from "../lib/lazyTodoItemKeyDown.js";

const STORAGE_KEY = "futuranota.lazyTodos.v3";

/** @typedef {'queued' | 'active'} LazyTodoStatus */

/**
 * @typedef {Object} LazyTodoItem
 * @property {string} id
 * @property {string|null} objectId
 * @property {string} reminder
 * @property {string} listTitle
 * @property {{ id: string, text: string, checked: boolean }[]} items
 * @property {string} createdAt
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
  return {
    id: String(item?.id || generateId("LAZY")),
    objectId: item?.objectId ?? null,
    reminder: String(item?.reminder ?? ""),
    listTitle: String(item?.listTitle ?? "To do").trim() || "To do",
    items,
    createdAt: item?.createdAt || new Date().toISOString(),
    status: item?.status === "active" ? "active" : "queued",
  };
}

export const useLazyTodosStore = create(
  devtools(
    (set, get) => ({
      items: readStoredItems(),

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

        const nextItem = normalizeItem({
          id: generateId("LAZY"),
          objectId: objectId || null,
          ...payload,
          createdAt: new Date().toISOString(),
          status,
        });

        set((state) => {
          const next = [...state.items, nextItem];
          persistItems(next);
          return { items: next };
        });

        return nextItem;
      },

      removeItem: (id) => {
        if (!id) return;
        set((state) => {
          const items = state.items.filter((item) => item.id !== id);
          persistItems(items);
          return { items };
        });
      },

      updateItem: (id, patch) => {
        if (!id) return;
        set((state) => {
          const items = state.items.map((item) => {
            if (item.id !== id) return item;
            return normalizeItem({
              ...item,
              ...patch,
              id: item.id,
              createdAt: item.createdAt,
              items: patch.items != null
                ? normalizeTodoItems(patch.items)
                : item.items,
            });
          });
          persistItems(items);
          return { items };
        });
      },

      parkItem: (item) => {
        const normalized = normalizeItem({ ...item, status: "queued" });
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
