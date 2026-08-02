/**
 * Map user utterances to Gina tool families (1–2 tools).
 */

import {
  filterDocumentsByDepartmentAndCategory,
  findFolderIdByName,
  get_documents_by_date_range,
  get_documents_by_status,
  get_document_detail,
  get_folder_children_summary,
  get_gina_scope,
  get_incomplete_documents,
  get_past_due_documents,
  get_schedule_conflicts,
  get_today_scope,
  get_week_scope,
  get_all_company_documents,
  get_all_company_folders,
} from "./ginaTools.js";

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * @param {string} text
 * @param {import("./ginaTools.js").GinaToolsContext} ctx
 * @returns {{ family: string, toolsCalled: string[], toolContext: object, openDocumentId?: string | null, openFolderId?: string | null }}
 */
export function runGinaQueryFamily(text, ctx = {}) {
  const q = fold(text);
  const toolsCalled = [];

  const call = (name, fn) => {
    toolsCalled.push(name);
    return fn();
  };

  // Focus / open
  if (
    /\b(abre|abrir|open|enfoca|enfocarme|trabajar en|focus)\b/.test(q)
  ) {
    const docs = get_all_company_documents(ctx);
    const folders = get_all_company_folders(ctx);
    let openDocumentId = null;
    let openFolderId = null;
    for (const d of docs) {
      if (d.title && q.includes(fold(d.title))) {
        openDocumentId = d.id;
        break;
      }
    }
    if (!openDocumentId) {
      for (const f of folders) {
        if (f.name && q.includes(fold(f.name))) {
          openFolderId = f.id;
          break;
        }
      }
    }
    toolsCalled.push("resolve_focus");
    return {
      family: "focus_open",
      toolsCalled,
      toolContext: { openDocumentId, openFolderId, hint: "User wants to focus/open one item" },
      openDocumentId,
      openFolderId,
    };
  }

  if (/\b(conflicto|conflictos|solape|overlap|chocan)\b/.test(q)) {
    const toolContext = call("get_schedule_conflicts", () => get_schedule_conflicts(ctx));
    return { family: "conflicts", toolsCalled, toolContext };
  }

  if (/\b(vencid\w*|past\s*due|atrasad\w*|se paso|se paso)\b/.test(q)) {
    const toolContext = call("get_past_due_documents", () => get_past_due_documents(ctx));
    return { family: "past_due", toolsCalled, toolContext };
  }

  if (/\b(no complete|no complet|incomplet|sin completar|que no termine)\b/.test(q)) {
    const toolContext = call("get_incomplete_documents", () => get_incomplete_documents(ctx));
    return { family: "incomplete", toolsCalled, toolContext };
  }

  if (/\b(esta semana|this week|semana)\b/.test(q) && !/\bproxima|next\b/.test(q)) {
    const toolContext = call("get_week_scope", () => get_week_scope(ctx, 0));
    return { family: "this_week", toolsCalled, toolContext };
  }

  if (/\b(proxima semana|próxima semana|next week)\b/.test(q)) {
    const toolContext = call("get_week_scope", () => get_week_scope(ctx, 1));
    return { family: "next_week", toolsCalled, toolContext };
  }

  if (/\b(manana|mañana|tomorrow)\b/.test(q)) {
    const now = ctx.now ? new Date(ctx.now) : new Date();
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const key = t.toISOString().slice(0, 10);
    const toolContext = call("get_documents_by_date_range", () => get_documents_by_date_range(ctx, key, key));
    return { family: "tomorrow", toolsCalled, toolContext };
  }

  const inDays = q.match(/\b(?:en|within)\s+(\d+)\s+d[ií]as?\b/) || q.match(/\b(\d+)\s+days?\b/);
  if (inDays) {
    const n = Number(inDays[1]);
    const now = ctx.now ? new Date(ctx.now) : new Date();
    const start = now.toISOString().slice(0, 10);
    const endD = new Date(now);
    endD.setDate(endD.getDate() + n);
    const end = endD.toISOString().slice(0, 10);
    const toolContext = call("get_documents_by_date_range", () => get_documents_by_date_range(ctx, start, end));
    return { family: "date_range", toolsCalled, toolContext };
  }

  if (/\b(hoy|today|para hoy)\b/.test(q)) {
    const toolContext = call("get_today_scope", () => get_today_scope(ctx));
    return { family: "today", toolsCalled, toolContext };
  }

  if (/\b(in[_ ]?progress|en progreso|en curso)\b/.test(q)) {
    const toolContext = call("get_documents_by_status", () => get_documents_by_status(ctx, "in_progress"));
    return { family: "status", toolsCalled, toolContext };
  }

  if (/\b(blog|blogs)\b/.test(q)) {
    const deptMatch = q.match(/\b(marketing|sales|product|design|ventas)\b/);
    const dept = deptMatch ? deptMatch[1] : "";
    const docs = call("filter_dept_category", () => filterDocumentsByDepartmentAndCategory(ctx, dept, "blog"));
    return {
      family: "blogs",
      toolsCalled,
      toolContext: { department: dept || null, category: "blogs", documents: docs },
    };
  }

  // Folder / department summary: "como esta Marketing"
  const howMatch = q.match(/\b(?:como esta|cómo está|how is|status de|del departamento de|departamento de)\s+([a-z0-9áéíóúüñ\s_-]{2,40})/);
  if (howMatch || (/\b(marketing|design|sales|product)\b/.test(q) && /\b(como|cómo|how|esta|está|proyecto|folder|departamento)\b/.test(q))) {
    const name = howMatch
      ? howMatch[1].replace(/\?+$/, "").trim()
      : (q.match(/\b(marketing|design|sales|product|ventas)\b/) || [])[1];
    const folderId = findFolderIdByName(ctx, name);
    if (folderId) {
      const toolContext = call("get_folder_children_summary", () => get_folder_children_summary(ctx, folderId));
      return { family: "folder_summary", toolsCalled, toolContext };
    }
    const docs = filterDocumentsByDepartmentAndCategory(ctx, name, "");
    toolsCalled.push("filter_department");
    return {
      family: "department",
      toolsCalled,
      toolContext: { department: name, documents: docs },
    };
  }

  if (/\b(scope|panorama|puesta al dia|puesta al día|analisis general|análisis general|que tengo)\b/.test(q)) {
    const toolContext = call("get_gina_scope", () => get_gina_scope(ctx, "all"));
    return { family: "gina_scope", toolsCalled, toolContext };
  }

  if (/\b(todos los (folders|proyectos)|all (folders|projects)|muéstrame todo|muestrame todo)\b/.test(q)) {
    const toolContext = {
      folders: call("get_all_company_folders", () => get_all_company_folders(ctx)),
      documents: call("get_all_company_documents", () => get_all_company_documents(ctx)),
    };
    return { family: "inventory", toolsCalled, toolContext };
  }

  // detail: "cuentame del X"
  const about = q.match(/\b(?:cu[eé]ntame (?:del|de|sobre)|tell me about|sobre el|sobre la)\s+(.+)$/);
  if (about) {
    const needle = fold(about[1]);
    const docs = get_all_company_documents(ctx);
    const hit = docs.find((d) => fold(d.title).includes(needle) || needle.includes(fold(d.title)));
    if (hit) {
      const toolContext = call("get_document_detail", () => get_document_detail(ctx, hit.id));
      return { family: "document_detail", toolsCalled, toolContext };
    }
  }

  // Default: light today + incomplete
  const toolContext = {
    today: call("get_today_scope", () => get_today_scope(ctx)),
    incomplete: call("get_incomplete_documents", () => get_incomplete_documents(ctx)),
  };
  return { family: "default_overview", toolsCalled, toolContext };
}
