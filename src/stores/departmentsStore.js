import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import { normalizeSubcategories } from "../lib/departments.js";

const STORAGE_KEY = "futuranota.departments.v1";

/**
 * @typedef {import("../lib/departments.js").DepartmentEntity} DepartmentEntity
 */

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {Partial<DepartmentEntity> & { id?: string }} dept
 * @returns {DepartmentEntity}
 */
export function normalizeDepartment(dept) {
  const createdAt = dept?.createdAt || nowIso();
  return {
    id: String(dept?.id || generateId("DEPT")),
    objectId: dept?.objectId ?? null,
    category: String(dept?.category ?? "").trim().slice(0, 80),
    subcategories: normalizeSubcategories(dept?.subcategories),
    createdAt,
    updatedAt: dept?.updatedAt || createdAt,
  };
}

function readStoredDepartments() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.id === "string")
      .map((row) => normalizeDepartment(row));
  } catch {
    return [];
  }
}

/** @param {DepartmentEntity[]} departments */
function persistDepartments(departments) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(departments));
  } catch {
    /* ignore quota */
  }
}

export const useDepartmentsStore = create(
  devtools(
    (set, get) => ({
      departments: readStoredDepartments(),

      /** @param {DepartmentEntity[]} departments */
      replaceDepartments: (departments) => {
        const normalized = (departments || []).map((d) => normalizeDepartment(d));
        persistDepartments(normalized);
        set({ departments: normalized });
      },

      /**
       * @param {{ objectId?: string|null, category?: string, subcategories?: string[], id?: string }} patch
       * @returns {DepartmentEntity}
       */
      createDepartment: ({ objectId = null, category = "", subcategories = [], id } = {}) => {
        const now = nowIso();
        const next = normalizeDepartment({
          id,
          objectId,
          category,
          subcategories,
          createdAt: now,
          updatedAt: now,
        });
        set((state) => {
          const departments = [...state.departments, next];
          persistDepartments(departments);
          return { departments };
        });
        return next;
      },

      /**
       * @param {string} id
       * @param {Partial<DepartmentEntity>} patch
       * @returns {DepartmentEntity|null}
       */
      updateDepartment: (id, patch) => {
        if (!id) return null;
        const now = nowIso();
        let updated = null;
        set((state) => {
          const departments = state.departments.map((dept) => {
            if (dept.id !== id) return dept;
            updated = normalizeDepartment({
              ...dept,
              ...patch,
              id: dept.id,
              createdAt: dept.createdAt,
              updatedAt: now,
            });
            return updated;
          });
          if (!updated) return state;
          persistDepartments(departments);
          return { departments };
        });
        return updated;
      },

      /**
       * @param {string} id
       * @param {string} subcategory
       * @returns {DepartmentEntity|null}
       */
      addSubcategory: (id, subcategory) => {
        const dept = get().departments.find((d) => d.id === id);
        if (!dept) return null;
        const label = String(subcategory || "").trim();
        if (!label) return dept;
        return get().updateDepartment(id, {
          subcategories: [...dept.subcategories, label],
        });
      },

      /**
       * @param {string} id
       * @param {string} subcategory
       * @returns {DepartmentEntity|null}
       */
      removeSubcategory: (id, subcategory) => {
        const dept = get().departments.find((d) => d.id === id);
        if (!dept) return null;
        const key = String(subcategory || "").trim().toLowerCase();
        return get().updateDepartment(id, {
          subcategories: dept.subcategories.filter(
            (s) => s.toLowerCase() !== key,
          ),
        });
      },

      /** @param {string} id */
      deleteDepartment: (id) => {
        if (!id) return;
        set((state) => {
          const departments = state.departments.filter((d) => d.id !== id);
          persistDepartments(departments);
          return { departments };
        });
      },
    }),
    { name: "DepartmentsStore" },
  ),
);
