/**
 * Department taxonomy helpers.
 * Corpus (hive) → Department (room) → Folder (Documents) with category tag.
 * Folder.departmentId = parent room; Folder.category = tag from that room.
 */

/**
 * @typedef {Object} DepartmentEntity
 * @property {string} id
 * @property {string|null} objectId
 * @property {string} category
 * @property {string[]} subcategories
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @param {unknown} value @returns {string[]} */
export function normalizeSubcategories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const label = String(raw ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label.slice(0, 50));
  }
  return out;
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
 * Categories (tags) available inside one department room.
 * @param {DepartmentEntity|null|undefined} department
 * @returns {string[]}
 */
export function listCategoriesForDepartment(department) {
  return normalizeSubcategories(department?.subcategories);
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

/**
 * @param {{ departmentId?: string|null, category?: string|null }|null|undefined} folder
 * @param {string|null|undefined} filterDepartmentId
 * @returns {boolean}
 */
export function folderMatchesDepartmentFilter(folder, filterDepartmentId) {
  if (!filterDepartmentId) return true;
  return String(folder?.departmentId || "") === String(filterDepartmentId);
}
