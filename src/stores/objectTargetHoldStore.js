import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * "Import Object" hold — pins one company (object) as the Dashboard/Timeline
 * target so the user can browse other companies in the sidebar without losing
 * the pinned context. Indefinite: released only manually, on company deletion,
 * or on logout. Session-scoped (survives sidebar navigation + reloads within
 * the same tab, clears when the tab closes).
 */

const HOLD_KEY = "futura-object-target-hold-v1";

function readHold() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HOLD_KEY);
    return typeof raw === "string" && raw ? raw : null;
  } catch {
    return null;
  }
}

function writeHold(objectId) {
  if (typeof window === "undefined") return;
  try {
    if (objectId) sessionStorage.setItem(HOLD_KEY, objectId);
    else sessionStorage.removeItem(HOLD_KEY);
  } catch {
    // private mode / quota
  }
}

export const useObjectTargetHoldStore = create(
  devtools(
    (set, get) => ({
      /** Pinned object id, or null when free. */
      heldObjectId: readHold(),

      hold: (objectId) => {
        if (!objectId) return;
        writeHold(objectId);
        set({ heldObjectId: objectId });
      },

      release: () => {
        writeHold(null);
        set({ heldObjectId: null });
      },

      /** Toggle: releases when already held (same or any), otherwise pins. */
      toggle: (objectId) => {
        const current = get().heldObjectId;
        if (current && (!objectId || current === objectId)) {
          get().release();
          return;
        }
        get().hold(objectId);
      },

      /** Auto-release when the pinned company no longer exists. */
      reconcile: (objectsById = {}) => {
        const current = get().heldObjectId;
        if (current && !objectsById[current]) get().release();
      },
    }),
    { name: "ObjectTargetHoldStore" },
  ),
);
