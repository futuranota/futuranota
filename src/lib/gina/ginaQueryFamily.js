/**
 * Map user utterances to Gina tool families (1–2 tools).
 * Live corpus only — time scope + name ambiguity.
 */

import { parseGinaTimeScope, foldGinaText } from "./ginaTimeScope.js";
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
  get_workspace_inventory,
  resolveNameAmbiguity,
  matchDepartmentInText,
  extractScopedName,
} from "./ginaTools.js";

function fold(s) {
  return foldGinaText(s);
}

/**
 * Apply live name scope (dept / category / folder) with ambiguity gate.
 */
function resolveScopeFilters(ctx, remainder, toolsCalled) {
  const deptHit = matchDepartmentInText(ctx, remainder);
  if (deptHit) {
    return {
      filters: { department: deptHit.name, category: null, folder: null },
      ambiguity: null,
    };
  }

  const scoped = extractScopedName(remainder);
  if (!scoped) return { filters: {}, ambiguity: null };

  const amb = resolveNameAmbiguity(ctx, scoped);
  toolsCalled.push("resolve_name_ambiguity");
  if (amb.ambiguous) {
    return {
      filters: {},
      ambiguity: {
        intro: fold(scoped)
          ? `"${scoped}" aparece en más de un sitio (si hay categoría, hay departamento).`
          : "Ese nombre aparece en más de un sitio.",
        needle: amb.needle,
        options: amb.options.slice(0, 3),
      },
    };
  }
  if (amb.options.length === 1) {
    const o = amb.options[0];
    return {
      filters: {
        department: o.department || null,
        category: o.kind === "category" ? o.category : null,
        folder: o.kind === "category" ? null : (o.folderName || amb.needle),
        folderId: o.folderId || null,
      },
      ambiguity: null,
    };
  }
  return { filters: {}, ambiguity: null };
}

/**
 * @param {string} text
 * @param {import("./ginaTools.js").GinaToolsContext} ctx
 */
export function runGinaQueryFamily(text, ctx = {}) {
  const q = fold(text);
  const toolsCalled = [];
  const locale = "es";

  const call = (name, fn) => {
    toolsCalled.push(name);
    return fn();
  };

  // Always attach inventory for grounding (caller may also inject)
  const inventory = call("get_workspace_inventory", () => get_workspace_inventory(ctx));

  // Focus / open
  if (/\b(abre|abrir|open|enfoca|enfocarme|trabajar en|focus)\b/.test(q)) {
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
      workspaceInventory: inventory,
    };
  }

  if (/\b(conflicto|conflictos|solape|overlap|chocan)\b/.test(q)) {
    const toolContext = call("get_schedule_conflicts", () => get_schedule_conflicts(ctx));
    return { family: "conflicts", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  if (/\b(vencid\w*|past\s*due|atrasad\w*|se paso|se paso)\b/.test(q)) {
    const toolContext = call("get_past_due_documents", () => get_past_due_documents(ctx));
    return { family: "past_due", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  if (/\b(no complete|no complet|incomplet|sin completar|que no termine)\b/.test(q)) {
    const toolContext = call("get_incomplete_documents", () => get_incomplete_documents(ctx));
    return { family: "incomplete", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  // Time scopes (hasta mañana / dentro de N / para mañana / semana / hoy)
  const time = parseGinaTimeScope(text, ctx.now || new Date(), { locale });
  if (time) {
    const { filters, ambiguity } = resolveScopeFilters(ctx, time.remainder, toolsCalled);
    if (ambiguity) {
      return {
        family: "name_ambiguity",
        toolsCalled,
        toolContext: { ambiguity, time, needsConfirm: false },
        workspaceInventory: inventory,
      };
    }

    if (time.needsConfirm && time.kind === "day_offset") {
      return {
        family: "confirm_date",
        toolsCalled,
        toolContext: {
          needsConfirm: true,
          confirmDateKey: time.confirmDateKey,
          confirmDateLabel: time.confirmDateLabel,
          dayOffset: time.dayOffset,
          filters,
          hint: "Confirm the target date before detailing documents",
        },
        workspaceInventory: inventory,
      };
    }

    if (time.kind === "this_week") {
      const toolContext = call("get_week_scope", () => get_week_scope(ctx, 0));
      return {
        family: "this_week",
        toolsCalled,
        toolContext: { ...toolContext, overviewOnly: true, filters },
        workspaceInventory: inventory,
      };
    }

    if (time.kind === "next_week") {
      const toolContext = call("get_week_scope", () => get_week_scope(ctx, 1));
      return {
        family: "next_week",
        toolsCalled,
        toolContext: { ...toolContext, overviewOnly: true, filters },
        workspaceInventory: inventory,
      };
    }

    if (time.kind === "today") {
      const toolContext = call("get_today_scope", () => get_today_scope(ctx, filters));
      return { family: "today", toolsCalled, toolContext, workspaceInventory: inventory };
    }

    if (time.kind === "tomorrow_only" || time.kind === "through_tomorrow" || time.kind === "day_offset") {
      const toolContext = call("get_documents_by_date_range", () => get_documents_by_date_range(
        ctx,
        time.startKey,
        time.endKey,
        { ...filters, excludeCompleted: true },
      ));
      const family = time.kind === "tomorrow_only"
        ? "tomorrow"
        : time.kind === "through_tomorrow"
          ? "through_tomorrow"
          : "date_range";
      return { family, toolsCalled, toolContext, workspaceInventory: inventory };
    }
  }

  if (/\b(in[_ ]?progress|en progreso|en curso)\b/.test(q)) {
    const toolContext = call("get_documents_by_status", () => get_documents_by_status(ctx, "in_progress"));
    return { family: "status", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  // Category blogs — only if inventory has that category (no hardcoded Marketing)
  if (/\b(blog|blogs)\b/.test(q)) {
    const deptHit = matchDepartmentInText(ctx, q);
    const docs = call("filter_dept_category", () => filterDocumentsByDepartmentAndCategory(
      ctx,
      deptHit?.name || "",
      "blog",
    ));
    return {
      family: "blogs",
      toolsCalled,
      toolContext: {
        department: deptHit?.name || null,
        category: "blogs",
        documents: docs,
      },
      workspaceInventory: inventory,
    };
  }

  // Folder / department summary — match live inventory names only
  const howMatch = q.match(/\b(?:como esta|cómo está|how is|status de|del departamento de|departamento de)\s+([a-z0-9áéíóúüñ\s_-]{2,40})/);
  if (howMatch) {
    const name = howMatch[1].replace(/\?+$/, "").trim();
    const amb = resolveNameAmbiguity(ctx, name);
    toolsCalled.push("resolve_name_ambiguity");
    if (amb.ambiguous) {
      return {
        family: "name_ambiguity",
        toolsCalled,
        toolContext: {
          ambiguity: {
            intro: `"${name}" aparece en más de un sitio.`,
            needle: name,
            options: amb.options.slice(0, 3),
          },
        },
        workspaceInventory: inventory,
      };
    }
    const deptHit = matchDepartmentInText(ctx, name) || matchDepartmentInText(ctx, q);
    if (deptHit && fold(deptHit.name) === fold(name)) {
      const docs = filterDocumentsByDepartmentAndCategory(ctx, deptHit.name, "");
      toolsCalled.push("filter_department");
      return {
        family: "department",
        toolsCalled,
        toolContext: { department: deptHit.name, documents: docs },
        workspaceInventory: inventory,
      };
    }
    const folderId = amb.options[0]?.folderId || findFolderIdByName(ctx, name);
    if (folderId) {
      const toolContext = call("get_folder_children_summary", () => get_folder_children_summary(ctx, folderId));
      return { family: "folder_summary", toolsCalled, toolContext, workspaceInventory: inventory };
    }
  } else {
    const deptHit = matchDepartmentInText(ctx, q);
    if (deptHit && /\b(como|cómo|how|esta|está|proyecto|folder|departamento|status)\b/.test(q)) {
      const docs = filterDocumentsByDepartmentAndCategory(ctx, deptHit.name, "");
      toolsCalled.push("filter_department");
      return {
        family: "department",
        toolsCalled,
        toolContext: { department: deptHit.name, documents: docs },
        workspaceInventory: inventory,
      };
    }
  }

  if (/\b(scope|panorama|puesta al dia|puesta al día|analisis general|análisis general)\b/.test(q)) {
    const toolContext = call("get_gina_scope", () => get_gina_scope(ctx, "all"));
    return { family: "gina_scope", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  if (/\b(todos los (folders|proyectos)|all (folders|projects)|muéstrame todo|muestrame todo)\b/.test(q)) {
    const toolContext = {
      folders: call("get_all_company_folders", () => get_all_company_folders(ctx)),
      documents: call("get_all_company_documents", () => get_all_company_documents(ctx)),
      inventory,
    };
    return { family: "inventory", toolsCalled, toolContext, workspaceInventory: inventory };
  }

  // Bare name that is ambiguous (e.g. "qué hay en Trends")
  if (/\b(que|qué)\b/.test(q) && /\b(hay|esta|está|en)\b/.test(q)) {
    const scoped = extractScopedName(q) || extractScopedName(q.replace(/\b(que|qué)\s+(hay|tengo)\s*/g, ""));
    if (scoped) {
      const amb = resolveNameAmbiguity(ctx, scoped);
      toolsCalled.push("resolve_name_ambiguity");
      if (amb.ambiguous) {
        return {
          family: "name_ambiguity",
          toolsCalled,
          toolContext: {
            ambiguity: {
              intro: `"${scoped}" lo tienes en más de un sitio.`,
              needle: scoped,
              options: amb.options.slice(0, 3),
            },
          },
          workspaceInventory: inventory,
        };
      }
    }
  }

  const about = q.match(/\b(?:cu[eé]ntame (?:del|de|sobre)|tell me about|sobre el|sobre la)\s+(.+)$/);
  if (about) {
    const needle = fold(about[1]);
    const docs = get_all_company_documents(ctx);
    const hit = docs.find((d) => fold(d.title).includes(needle) || needle.includes(fold(d.title)));
    if (hit) {
      const toolContext = call("get_document_detail", () => get_document_detail(ctx, hit.id));
      return { family: "document_detail", toolsCalled, toolContext, workspaceInventory: inventory };
    }
  }

  // Default: light today + incomplete
  const toolContext = {
    today: call("get_today_scope", () => get_today_scope(ctx)),
    incomplete: call("get_incomplete_documents", () => get_incomplete_documents(ctx)),
  };
  return { family: "default_overview", toolsCalled, toolContext, workspaceInventory: inventory };
}
