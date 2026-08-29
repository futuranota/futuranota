/**
 * Department taxonomy helpers.
 * Corpus (hive) → Department (room) → Folder (Documents) with category tag.
 * Folder.departmentId = parent room; Folder.category = tag from that room.
 */

/**
 * @typedef {Object} DepartmentCategoryTag
 * @property {string} label
 * @property {string} description
 */

/**
 * @typedef {Object} DepartmentEntity
 * @property {string} id
 * @property {string|null} objectId
 * @property {string} category
 * @property {string} description
 * @property {DepartmentCategoryTag[]} subcategories
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const DESCRIPTION_MAX = 500;
const LABEL_MAX = 50;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDescription(value) {
  return String(value ?? "").trim().slice(0, DESCRIPTION_MAX);
}

/**
 * Normalize legacy string[] or object[] into { label, description }[].
 * @param {unknown} value
 * @returns {DepartmentCategoryTag[]}
 */
export function normalizeSubcategories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    let label = "";
    let description = "";
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      label = String(raw.label ?? raw.name ?? "").trim();
      description = normalizeDescription(raw.description);
    } else {
      label = String(raw ?? "").trim();
    }
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label: label.slice(0, LABEL_MAX),
      description,
    });
  }
  return out;
}

/**
 * Labels only (for pickers / folder.category match).
 * @param {DepartmentEntity|null|undefined} department
 * @returns {string[]}
 */
export function listCategoriesForDepartment(department) {
  return normalizeSubcategories(department?.subcategories).map((s) => s.label);
}

/**
 * @param {DepartmentEntity|null|undefined} department
 * @param {string|null|undefined} label
 * @returns {string}
 */
export function getCategoryDescription(department, label) {
  const key = String(label ?? "").trim().toLowerCase();
  if (!key) return "";
  const tag = normalizeSubcategories(department?.subcategories).find(
    (s) => s.label.toLowerCase() === key,
  );
  return tag?.description || "";
}

/**
 * @param {DepartmentEntity[]} departments
 * @param {string|null|undefined} objectId
 * @returns {DepartmentEntity[]}
 */
export function listDepartmentsForObject(departments, objectId) {
  const oid = objectId || null;
  return (departments || [])
    .filter((d) => (d.objectId || null) === oid)
    .slice()
    .sort((a, b) => {
      const an = String(a.category || "").toLowerCase();
      const bn = String(b.category || "").toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

/**
 * @param {DepartmentEntity[]|Record<string, DepartmentEntity>} departments
 * @param {string|null|undefined} departmentId
 * @returns {DepartmentEntity|null}
 */
export function findDepartmentById(departments, departmentId) {
  if (!departmentId) return null;
  if (Array.isArray(departments)) {
    return departments.find((d) => d.id === departmentId) || null;
  }
  return departments?.[departmentId] || null;
}

/**
 * @param {DepartmentEntity|null|undefined} department
 * @returns {string}
 */
export function formatDepartmentOfLabel(department) {
  const name = String(department?.category || "").trim();
  if (!name) return "";
  return `Department of ${name}`;
}

/** Sentinel filter id: Uncategorized (folders with no department). */
export const UNASSIGNED_DEPARTMENT_FILTER_ID = "";

/**
 * True when folder has no departmentId — same bucket as sidebar Uncategorized.
 * @param {{ departmentId?: string|null }|null|undefined} folder
 */
export function isUnassignedDepartmentFolder(folder) {
  if (!folder) return false;
  return !String(folder.departmentId || "").trim();
}

/**
 * Match a folder against the sidebar department filter.
 * Empty / Uncategorized → folders with no departmentId (virtual department).
 * Concrete id → folders assigned to that department (category tag optional).
 *
 * @param {{ departmentId?: string|null, category?: string|null }|null|undefined} folder
 * @param {string|null|undefined} filterDepartmentId
 * @returns {boolean}
 */
export function folderMatchesDepartmentFilter(folder, filterDepartmentId) {
  const folderDept = String(folder?.departmentId || "").trim();
  if (!filterDepartmentId) return !folderDept;
  return folderDept === String(filterDepartmentId);
}

/**
 * @typedef {'department'|'uncategorized'} FolderDeptGroupKind
 * @typedef {{ id: string, label: string, kind: FolderDeptGroupKind, folders: object[] }} FolderDeptGroup
 */

/**
 * Group workspace folders under department headers (uncategorized last).
 *
 * @param {object[]} folders
 * @param {DepartmentEntity[]|Record<string, DepartmentEntity>} departments
 * @param {{ objectId?: string|null, uncategorizedLabel?: string, formatDeptLabel?: (dept: DepartmentEntity) => string }} [options]
 * @returns {FolderDeptGroup[]}
 */
export function groupFoldersByDepartment(folders = [], departments = [], options = {}) {
  const uncategorizedLabel = String(options.uncategorizedLabel || "Uncategorized").trim()
    || "Uncategorized";
  const formatDeptLabel = options.formatDeptLabel
    || ((dept) => String(dept?.category || "").trim() || "Department");
  const deptList = listDepartmentsForObject(
    Array.isArray(departments) ? departments : Object.values(departments || {}),
    options.objectId ?? null,
  );

  /** @type {Map<string, object[]>} */
  const buckets = new Map();
  /** @type {object[]} */
  const uncategorized = [];

  for (const folder of folders) {
    if (!folder?.id) continue;
    const deptId = String(folder.departmentId || "").trim();
    if (!deptId) {
      uncategorized.push(folder);
      continue;
    }
    if (!buckets.has(deptId)) buckets.set(deptId, []);
    buckets.get(deptId).push(folder);
  }

  /** @type {FolderDeptGroup[]} */
  const groups = [];

  for (const dept of deptList) {
    const deptFolders = buckets.get(dept.id);
    if (!deptFolders?.length) continue;
    groups.push({
      id: dept.id,
      label: formatDeptLabel(dept),
      kind: "department",
      folders: deptFolders,
    });
    buckets.delete(dept.id);
  }

  for (const [deptId, deptFolders] of buckets) {
    if (!deptFolders?.length) continue;
    const dept = findDepartmentById(deptList, deptId);
    groups.push({
      id: deptId,
      label: dept ? formatDeptLabel(dept) : deptId,
      kind: "department",
      folders: deptFolders,
    });
  }

  if (uncategorized.length) {
    groups.push({
      id: UNASSIGNED_DEPARTMENT_FILTER_ID,
      label: uncategorizedLabel,
      kind: "uncategorized",
      folders: uncategorized,
    });
  }

  return groups;
}

/**
 * Keep the newer list as authority. Fill empty descriptions from the older
 * side for the same label — never re-add tags the newer list already dropped.
 * @param {unknown} primary newer subcategory list
 * @param {unknown} secondary older subcategory list
 * @returns {DepartmentCategoryTag[]}
 */
export function mergeSubcategoryLists(primary, secondary) {
  const newer = normalizeSubcategories(primary);
  const older = normalizeSubcategories(secondary);
  const olderByKey = new Map(
    older.map((tag) => [tag.label.toLowerCase(), tag]),
  );
  return newer.map((tag) => {
    const prev = olderByKey.get(tag.label.toLowerCase());
    return {
      label: tag.label,
      description: tag.description || prev?.description || "",
    };
  });
}

/**
 * Prefer the newer row, but never drop department / tag descriptions the
 * other side still has (older DBs and PostgREST cache can upsert tags while
 * stripping `description`).
 * @param {DepartmentEntity} local
 * @param {DepartmentEntity} remote
 * @returns {DepartmentEntity}
 */
export function mergeDepartmentRecords(local, remote) {
  const remoteTs = Date.parse(remote?.updatedAt || "") || 0;
  const localTs = Date.parse(local?.updatedAt || "") || 0;
  const newer = localTs > remoteTs ? local : remote;
  const older = newer === local ? remote : local;
  return {
    ...newer,
    category: String(newer?.category || older?.category || "").trim(),
    description: normalizeDescription(newer?.description || older?.description),
    subcategories: mergeSubcategoryLists(newer?.subcategories, older?.subcategories),
  };
}
