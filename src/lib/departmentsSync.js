import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { useDepartmentsStore, normalizeDepartment } from "../stores/departmentsStore.js";
import { generateId } from "./ids.js";
import { resolveSyncUserId } from "./resolveSyncUserId.js";
import { normalizeDescription, normalizeSubcategories } from "./departments.js";

const SYNC_DEBOUNCE_MS = 1500;

/** @param {(...args: unknown[]) => void} fn @param {number} ms */
function debounce(fn, ms) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

/** @param {Record<string, unknown>} row */
function rowToDepartment(row) {
  return normalizeDepartment({
    id: String(row.id || generateId("DEPT")),
    objectId: row.object_id ?? null,
    category: String(row.category ?? ""),
    description: normalizeDescription(row.description),
    subcategories: normalizeSubcategories(row.subcategories),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  });
}

/**
 * @param {import("../stores/departmentsStore.js").DepartmentEntity} dept
 * @param {string} userId
 * @param {string} now
 */
function departmentToRow(dept, userId, now) {
  return {
    id: dept.id,
    user_id: userId,
    object_id: dept.objectId || null,
    category: dept.category ?? "",
    description: normalizeDescription(dept.description),
    subcategories: normalizeSubcategories(dept.subcategories),
    created_at: dept.createdAt || now,
    updated_at: now,
  };
}

let isHydrating = false;
let debouncedRemoteSync = null;

/** @param {import("../lib/departments.js").DepartmentEntity[]} departments */
async function syncDepartmentsToSupabase(departments) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[departments] Sync skipped: no authenticated user session");
    return false;
  }

  const now = new Date().toISOString();
  const rows = departments.map((dept) => departmentToRow(dept, userId, now));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("departments")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn(formatSupabaseError(error, "Upsert departments"));
      return false;
    }
  }

  const { data: remoteRows, error: selectErr } = await supabase
    .from("departments")
    .select("id")
    .eq("user_id", userId);

  if (selectErr) {
    console.warn(formatSupabaseError(selectErr, "Select departments"));
    return false;
  }

  const localIds = new Set(departments.map((d) => d.id));
  const orphanIds = (remoteRows || [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));

  if (orphanIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("departments")
      .delete()
      .eq("user_id", userId)
      .in("id", orphanIds);
    if (deleteErr) {
      console.warn(formatSupabaseError(deleteErr, "Delete departments"));
      return false;
    }
  }

  return true;
}

/** @returns {Promise<import("../lib/departments.js").DepartmentEntity[]|null>} */
export async function loadDepartmentsFromSupabase() {
  const userId = await resolveSyncUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(formatSupabaseError(error, "Load departments"));
    return null;
  }

  return (data || []).map(rowToDepartment);
}

export async function flushDepartmentsSync() {
  debouncedRemoteSync?.cancel();
  await syncDepartmentsToSupabase(useDepartmentsStore.getState().departments);
}

/**
 * @param {typeof import("../stores/departmentsStore.js").useDepartmentsStore} useDepartmentsStoreArg
 */
export function initDepartmentsSync(useDepartmentsStoreArg) {
  if (typeof window === "undefined") return;

  debouncedRemoteSync = debounce((departments) => {
    if (isHydrating) return;
    syncDepartmentsToSupabase(departments);
  }, SYNC_DEBOUNCE_MS);

  const hydrateFromRemote = async () => {
    const remote = await loadDepartmentsFromSupabase();
    if (remote === null) return;

    isHydrating = true;
    try {
      if (remote.length > 0) {
        useDepartmentsStoreArg.getState().replaceDepartments(remote);
      } else {
        const local = useDepartmentsStoreArg.getState().departments;
        if (local.length > 0) {
          await syncDepartmentsToSupabase(local);
        }
      }
    } finally {
      isHydrating = false;
    }
  };

  hydrateFromRemote();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      debouncedRemoteSync?.cancel();
      hydrateFromRemote();
    }
    if (event === "SIGNED_OUT") {
      debouncedRemoteSync?.cancel();
    }
  });

  useDepartmentsStoreArg.subscribe((state) => {
    debouncedRemoteSync?.(state.departments);
  });
}
