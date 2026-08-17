import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateId } from "../lib/ids.js";
import {
  normalizeDescription,
  normalizeSubcategories,
} from "../lib/departments.js";
import { useDocsStore } from "./docsStore.js";

const STORAGE_KEY = "futuranota.departments.v1";

/**
 * @typedef {import("../lib/departments.js").DepartmentEntity} DepartmentEntity
 * @typedef {import("../lib/departments.js").DepartmentCategoryTag} DepartmentCategoryTag
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
    description: normalizeDescription(dept?.description),
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

/**
 * Folders in this department currently tagged with `label`.
 * @param {string} departmentId
 * @param {string} label
 * @returns {number}
 */
export function countFoldersWithDepartmentCategory(departmentId, label) {
  const key = String(label || "").trim().toLowerCase();
  if (!departmentId || !key) return 0;
  const docs = useDocsStore.getState().docs || {};
  let n = 0;
  for (const doc of Object.values(docs)) {
    if (!doc || String(doc.departmentId || "") !== String(departmentId)) continue;
    if (String(doc.category || "").trim().toLowerCase() !== key) continue;
    n += 1;
  }
  return n;
}

/**
 * Cascade clear folder.category when a department tag is deleted.
 * @param {string} departmentId
 * @param {string} label
 */
export function cascadeFolderCategoryClear(departmentId, label) {
  const key = String(label || "").trim().toLowerCase();
  if (!departmentId || !key) return;
  const docs = useDocsStore.getState().docs || {};
  const updateDoc = useDocsStore.getState().updateDoc;
  Object.values(docs).forEach((doc) => {
    if (!doc || String(doc.departmentId || "") !== String(departmentId)) return;
    if (String(doc.category || "").trim().toLowerCase() !== key) return;
    updateDoc(doc.id, { category: "" });
  });
}

/**
 * Cascade folder.category when a department tag label is renamed.
 * @param {string} departmentId
 * @param {string} oldLabel
 * @param {string} newLabel
 */
function cascadeFolderCategoryRename(departmentId, oldLabel, newLabel) {
  const oldKey = String(oldLabel || "").trim().toLowerCase();
  const next = String(newLabel || "").trim();
  if (!departmentId || !oldKey || !next || oldKey === next.toLowerCase()) return;
  const docs = useDocsStore.getState().docs || {};
  const updateDoc = useDocsStore.getState().updateDoc;
  Object.values(docs).forEach((doc) => {
    if (!doc || String(doc.departmentId || "") !== String(departmentId)) return;
    if (String(doc.category || "").trim().toLowerCase() !== oldKey) return;
    updateDoc(doc.id, { category: next });
  });
}

/**
 * @param {string|DepartmentCategoryTag|{ label?: string, description?: string }} input
 * @returns {DepartmentCategoryTag|null}
 */
function coerceTagInput(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const label = String(input.label ?? "").trim().slice(0, 50);
    if (!label) return null;
    return {
      label,
      description: normalizeDescription(input.description),
    };
  }
  const label = String(input ?? "").trim().slice(0, 50);
  if (!label) return null;
  return { label, description: "" };
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
       * @param {{ objectId?: string|null, category?: string, description?: string, subcategories?: unknown, id?: string }} patch
       * @returns {DepartmentEntity}
       */
      createDepartment: ({
        objectId = null,
        category = "",
        description = "",
        subcategories = [],
        id,
      } = {}) => {
        const now = nowIso();
        const next = normalizeDepartment({
          id,
          objectId,
          category,
          description,
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
       * @param {string|DepartmentCategoryTag|{ label?: string, description?: string }} subcategory
       * @returns {DepartmentEntity|null}
       */
      addSubcategory: (id, subcategory) => {
        const dept = get().departments.find((d) => d.id === id);
        if (!dept) return null;
        const tag = coerceTagInput(subcategory);
        if (!tag) return dept;
        const exists = dept.subcategories.some(
          (s) => s.label.toLowerCase() === tag.label.toLowerCase(),
        );
        if (exists) return dept;
        return get().updateDepartment(id, {
          subcategories: [...dept.subcategories, tag],
        });
      },

      /**
       * @param {string} id
       * @param {string} subcategory label
       * @returns {DepartmentEntity|null}
       */
      removeSubcategory: (id, subcategory) => {
        const dept = get().departments.find((d) => d.id === id);
        if (!dept) return null;
        const key = String(subcategory || "").trim().toLowerCase();
        const removed = dept.subcategories.find(
          (s) => s.label.toLowerCase() === key,
        );
        const updated = get().updateDepartment(id, {
          subcategories: dept.subcategories.filter(
            (s) => s.label.toLowerCase() !== key,
          ),
        });
        if (removed?.label) cascadeFolderCategoryClear(id, removed.label);
        return updated;
      },

      /**
       * Replace a tag (label and/or description). Cascades folder.category on label change.
       * @param {string} id
       * @param {string} oldLabel
       * @param {{ label?: string, description?: string }} patch
       * @returns {DepartmentEntity|null}
       */
      updateSubcategory: (id, oldLabel, patch = {}) => {
        const dept = get().departments.find((d) => d.id === id);
        if (!dept) return null;
        const oldKey = String(oldLabel || "").trim().toLowerCase();
        if (!oldKey) return dept;

        const idx = dept.subcategories.findIndex(
          (s) => s.label.toLowerCase() === oldKey,
        );
        if (idx < 0) return dept;

        const prev = dept.subcategories[idx];
        const nextLabel = String(patch.label ?? prev.label).trim().slice(0, 50);
        if (!nextLabel) return dept;
        const nextDescription =
          patch.description !== undefined
            ? normalizeDescription(patch.description)
            : prev.description;

        const duplicate = dept.subcategories.some(
          (s, i) =>
            i !== idx && s.label.toLowerCase() === nextLabel.toLowerCase(),
        );
        if (duplicate) return dept;

        const nextTags = dept.subcategories.map((s, i) =>
          i === idx ? { label: nextLabel, description: nextDescription } : s,
        );
        const updated = get().updateDepartment(id, { subcategories: nextTags });
        if (prev.label.toLowerCase() !== nextLabel.toLowerCase()) {
          cascadeFolderCategoryRename(id, prev.label, nextLabel);
        }
        return updated;
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
