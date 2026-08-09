/**
 * Resolve Documents navigation + open target for a Gina open/reveal protocol id.
 * Timeline units are nodes; folder ids remain supported as a fallback.
 *
 * @param {string} id
 * @param {{
 *   nodesMap?: Record<string, object>,
 *   docsMap?: Record<string, object>,
 *   departments?: object[],
 *   unassignedDepartmentId?: string,
 *   findDepartmentById?: (list: object[], id: string) => object | null | undefined,
 * }} ctx
 * @returns {{
 *   kind: "node" | "folder",
 *   targetId: string,
 *   title: string,
 *   path: string,
 *   navigate: {
 *     panel: "Documents",
 *     clickFolderView: "subgroups",
 *     departmentId: string,
 *     category: string,
 *     folderId: string,
 *     highlightNodeId: string | null,
 *   } | null,
 * } | null}
 */
export function buildGinaDocumentOpenPlan(id, ctx = {}) {
  const targetId = String(id || "").trim();
  if (!targetId) return null;

  const nodesMap = ctx.nodesMap || {};
  const docsMap = ctx.docsMap || {};
  const departments = Array.isArray(ctx.departments) ? ctx.departments : [];
  const unassignedDepartmentId = ctx.unassignedDepartmentId || "unassigned";
  const findDepartmentById = typeof ctx.findDepartmentById === "function"
    ? ctx.findDepartmentById
    : () => null;

  const node = nodesMap[targetId] || null;
  if (node) {
    const folder = node.parentDocId ? docsMap[node.parentDocId] : null;
    const deptLabel = folder?.departmentId
      ? (findDepartmentById(departments, folder.departmentId)?.category || null)
      : null;
    const title = String(node.title || node.name || "").trim() || targetId;
    const path = [
      deptLabel,
      folder?.category || null,
      folder?.title || folder?.name || null,
      title,
    ].filter(Boolean).join(" / ");

    return {
      kind: "node",
      targetId,
      title,
      path,
      navigate: folder
        ? {
          panel: "Documents",
          clickFolderView: "subgroups",
          departmentId: folder.departmentId ?? unassignedDepartmentId,
          category: folder.category || "",
          folderId: folder.id,
          highlightNodeId: node.id,
        }
        : null,
    };
  }

  const folder = docsMap[targetId] || null;
  if (folder) {
    const deptLabel = folder.departmentId
      ? (findDepartmentById(departments, folder.departmentId)?.category || null)
      : null;
    const title = String(folder.title || folder.name || "").trim() || targetId;
    const path = [
      deptLabel,
      folder.category || null,
      title,
    ].filter(Boolean).join(" / ");

    return {
      kind: "folder",
      targetId,
      title,
      path,
      navigate: {
        panel: "Documents",
        clickFolderView: "subgroups",
        departmentId: folder.departmentId ?? unassignedDepartmentId,
        category: folder.category || "",
        folderId: folder.id,
        highlightNodeId: null,
      },
    };
  }

  return null;
}
