/**
 * Folder status from linked documents' completed flags (same basis as schedule pie).
 * @param {Record<string, { parentDocId?: string | null, completed?: boolean }> | Array<{ parentDocId?: string | null, completed?: boolean }> | null | undefined} nodes
 * @param {string | null | undefined} folderDocId
 * @returns {{ status: "not_started" | "pending" | "completed", total: number, done: number, percent: number }}
 */
export function resolveFolderStatus(nodes, folderDocId) {
  const id = typeof folderDocId === "string" ? folderDocId.trim() : "";
  if (!id || !nodes) {
    return { status: "not_started", total: 0, done: 0, percent: 0 };
  }

  const list = Array.isArray(nodes) ? nodes : Object.values(nodes);
  let total = 0;
  let done = 0;
  for (const node of list) {
    if (node?.parentDocId !== id) continue;
    total += 1;
    if (node?.completed) done += 1;
  }

  if (total <= 0 || done <= 0) {
    return { status: "not_started", total, done, percent: 0 };
  }

  const percent = Math.min(100, Math.round((done / total) * 100));
  if (percent >= 100) {
    return { status: "completed", total, done, percent: 100 };
  }
  return { status: "pending", total, done, percent };
}
