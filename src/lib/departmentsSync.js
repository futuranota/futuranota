import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { useDepartmentsStore, normalizeDepartment } from "../stores/departmentsStore.js";
import { generateId } from "./ids.js";
import { resolveSyncUserId } from "./resolveSyncUserId.js";
import {
  mergeDepartmentRecords,
  normalizeDescription,
  normalizeSubcategories,
} from "./departments.js";

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

const DEPT_TOMBSTONE_KEY = "futuranota.departments.deleted-ids.v1";
const TAG_TOMBSTONE_KEY = "futuranota.departments.deleted-tags.v1";

/** @type {Set<string>} */
const pendingDeletedDeptIds = new Set();
/** @type {Set<string>} `${deptId}::${labelLower}` */
const pendingDeletedTagKeys = new Set();

function readJsonArray(key) {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistTombstones() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DEPT_TOMBSTONE_KEY, JSON.stringify([...pendingDeletedDeptIds]));
    localStorage.setItem(TAG_TOMBSTONE_KEY, JSON.stringify([...pendingDeletedTagKeys]));
  } catch {
    /* quota */
  }
}

function loadTombstonesFromDisk() {
  for (const id of readJsonArray(DEPT_TOMBSTONE_KEY)) pendingDeletedDeptIds.add(id);
  for (const key of readJsonArray(TAG_TOMBSTONE_KEY)) pendingDeletedTagKeys.add(key);
}

if (typeof window !== "undefined") loadTombstonesFromDisk();

function tagTombstoneKey(departmentId, label) {
  return `${departmentId}::${String(label || "").trim().toLowerCase()}`;
}

/** @param {string|string[]} ids */
export function markDepartmentDeleted(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  let changed = false;
  for (const id of list) {
    if (!id || pendingDeletedDeptIds.has(id)) continue;
    pendingDeletedDeptIds.add(String(id));
    changed = true;
  }
  if (changed) persistTombstones();
}

/**
 * @param {string} departmentId
 * @param {string|string[]} labels
 */
export function markDepartmentTagsDeleted(departmentId, labels) {
  if (!departmentId) return;
  const list = Array.isArray(labels) ? labels : [labels];
  let changed = false;
  for (const label of list) {
    const key = tagTombstoneKey(departmentId, label);
    if (key.endsWith("::") || pendingDeletedTagKeys.has(key)) continue;
    pendingDeletedTagKeys.add(key);
    changed = true;
  }
  if (changed) persistTombstones();
}

/**
 * @param {import("../lib/departments.js").DepartmentEntity[]} departments
 * @returns {import("../lib/departments.js").DepartmentEntity[]}
 */
export function applyDepartmentTombstones(departments) {
  return (departments || [])
    .filter((dept) => dept?.id && !pendingDeletedDeptIds.has(dept.id))
    .map((dept) => ({
      ...dept,
      subcategories: (dept.subcategories || []).filter(
        (tag) => !pendingDeletedTagKeys.has(tagTombstoneKey(dept.id, tag.label)),
      ),
    }));
}

/** @param {import("../lib/departments.js").DepartmentEntity[]} departments */
async function syncDepartmentsToSupabase(departments) {
  const userId = await resolveSyncUserId();
  if (!userId) {
    console.warn("[departments] Sync skipped: no authenticated user session");
    return false;
  }

  const now = new Date().toISOString();
  const live = applyDepartmentTombstones(departments);
  const rows = live.map((dept) => departmentToRow(dept, userId, now));

  if (rows.length > 0) {
    let { error } = await supabase
      .from("departments")
      .upsert(rows, { onConflict: "id" });

    // Older PostgREST caches may reject `description`. Retry without it so
    // tags still land — local description is preserved on the next hydrate merge.
    if (error && /description/i.test(String(error.message || error.code || ""))) {
      const rowsWithoutDescription = rows.map(({ description: _d, ...rest }) => rest);
      ({ error } = await supabase
        .from("departments")
        .upsert(rowsWithoutDescription, { onConflict: "id" }));
    }

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

  const localIds = new Set(live.map((dept) => dept.id));
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

  pendingDeletedDeptIds.clear();
  pendingDeletedTagKeys.clear();
  persistTombstones();
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
      loadTombstonesFromDisk();
      const local = useDepartmentsStoreArg.getState().departments;
      if (remote.length > 0 || pendingDeletedDeptIds.size > 0 || pendingDeletedTagKeys.size > 0) {
        const localById = new Map(local.map((dept) => [dept.id, dept]));

        // Merge so a newer remote row that dropped `description` (schema cache)
        // cannot wipe local department / tag metadata. Tombstones block ghosts.
        const merged = [];
        const seen = new Set();

        for (const remoteDept of remote) {
          if (pendingDeletedDeptIds.has(remoteDept.id)) continue;
          seen.add(remoteDept.id);
          const localDept = localById.get(remoteDept.id);
          if (!localDept) {
            merged.push(remoteDept);
            continue;
          }
          merged.push(mergeDepartmentRecords(localDept, remoteDept));
        }

        for (const localDept of local) {
          if (pendingDeletedDeptIds.has(localDept.id)) continue;
          if (seen.has(localDept.id)) continue;
          merged.push(localDept);
        }

        const stripped = applyDepartmentTombstones(merged);
        useDepartmentsStoreArg.getState().replaceDepartments(stripped);
        queueMicrotask(() => {
          syncDepartmentsToSupabase(
            useDepartmentsStoreArg.getState().departments,
          );
        });
      } else if (local.length > 0) {
        await syncDepartmentsToSupabase(local);
      }
    } finally {
      isHydrating = false;
    }
  };

  hydrateFromRemote();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
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
