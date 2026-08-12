/**
 * Word-scope: scan depto → categoría → folder → documento, ask when many layers hit.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  wantsWordScopeScan,
  extractWordScopeNeedle,
  parseWordScopeLayerReply,
  buildWordScopeAskMessage,
} from "./ginaSyntaxWordScope.js";
import { scanGinaWordScope, wordScopeNameHits } from "./ginaTools.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { clearPendingGinaOffer, getPendingGinaOffer } from "./ginaPendingOffer.js";
import { clearGinaLastTurn } from "./ginaLastTurn.js";

const now = new Date(2026, 7, 12, 12, 0, 0);

const ctx = {
  objectId: "co1",
  corpusName: "General",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "Blogs", description: "" }],
    },
    {
      id: "dept_e",
      objectId: "co1",
      category: "Estrategias de negocios",
      subcategories: [{ label: "plan de negocio", description: "" }],
    },
  ],
  docs: {
    f_blogs: {
      id: "f_blogs",
      title: "Horizon",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Blogs",
    },
    f_pdn: {
      id: "f_pdn",
      title: "Plan de Negocio",
      parentObjectId: "co1",
      departmentId: "dept_e",
      category: "plan de negocio",
    },
    f_loose: {
      id: "f_loose",
      title: "Estrategia suelta",
      parentObjectId: "co1",
      departmentId: "dept_e",
      category: "uncategorized",
    },
  },
  nodes: {
    blog_a: {
      id: "blog_a",
      title: "08-09 Blogs Horizon",
      parentDocId: "f_blogs",
      objectId: "co1",
      status: "not_started",
    },
    pdn_doc: {
      id: "pdn_doc",
      title: "Canvas PDN",
      parentDocId: "f_pdn",
      objectId: "co1",
      status: "flexible",
    },
    loose_doc: {
      id: "loose_doc",
      title: "Notas sueltas",
      parentDocId: "f_loose",
      objectId: "co1",
      status: "flexible",
    },
  },
};

describe("ginaSyntaxWordScope", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
    clearGinaLastTurn();
  });

  it("detects dame todo lo de / entregame todos sobre", () => {
    expect(wantsWordScopeScan("dame todo lo de plan de negocio")).toBe(true);
    expect(wantsWordScopeScan("entregame todos sobre estrategias")).toBe(true);
    expect(wantsWordScopeScan("entrégame todo sobre blogs")).toBe(true);
    expect(wantsWordScopeScan("Dame todos los documentos del plan de negocio")).toBe(false);
    expect(wantsWordScopeScan("gina quiero todos los docs del departamento de marketing")).toBe(false);
    expect(extractWordScopeNeedle("dame todo lo de plan de negocio")).toMatch(/plan de negocio/i);
    expect(extractWordScopeNeedle("entregame todos sobre estrategias")).toMatch(/estrategias/i);
  });

  it("plan de negocio hits category + folder, not the Estrategias department", () => {
    expect(wordScopeNameHits("Estrategias de negocios", "plan de negocio")).toBe(false);
    expect(wordScopeNameHits("plan de negocio", "plan de negocio")).toBe(true);
    expect(wordScopeNameHits("Plan de Negocio", "plan de negocio")).toBe(true);
    const scan = scanGinaWordScope(ctx, "plan de negocio");
    expect(scan.departments.map((d) => d.name)).not.toContain("Estrategias de negocios");
    expect(scan.categories.some((c) => /plan de negocio/i.test(c.name))).toBe(true);
    expect(scan.folders.some((f) => /plan de negocio/i.test(f.name))).toBe(true);
  });

  it("dame todo lo de plan de negocio asks instead of inventing Planificación", () => {
    const routed = runGinaQueryFamily("dame todo lo de plan de negocio", ctx);
    expect(routed.family).toBe("word_scope");
    expect(routed.family).not.toBe("free_chat");
    expect(routed.toolContext?.needsClarify).toBe(true);
    expect(getPendingGinaOffer()?.type).toBe("word_scope");
    const msg = buildWordScopeAskMessage(routed.toolContext.scan, { locale: "es" });
    expect(msg).toMatch(/categor[ií]a/i);
    expect(msg).toMatch(/folder/i);
    expect(msg).not.toMatch(/Planificaci[oó]n/i);
  });

  it("follow-up el folder + name lists that folder (layer + name)", () => {
    runGinaQueryFamily("dame todo lo de plan de negocio", ctx);
    const follow = runGinaQueryFamily("el folder Plan de Negocio", ctx);
    expect(follow.family).toBe("folder_summary");
    expect(follow.toolContext?.folderName).toMatch(/plan de negocio/i);
    const ids = (follow.toolContext?.documents || []).map((d) => d.id);
    expect(ids).toContain("pdn_doc");
    expect(ids).not.toContain("blog_a");
  });

  it("entregame todos sobre estrategias asks with live department, does not invent", () => {
    const routed = runGinaQueryFamily("entregame todos sobre estrategias", ctx);
    expect(routed.family).not.toBe("free_chat");
    const scan = routed.toolContext?.scan || {
      departments: routed.toolContext?.department
        ? [{ name: routed.toolContext.department }]
        : [],
    };
    if (routed.family === "word_scope") {
      expect(routed.toolContext?.needsClarify).toBe(true);
      expect(scan.departments.some((d) => /estrategias/i.test(d.name))).toBe(true);
      const msg = buildWordScopeAskMessage(routed.toolContext.scan, { locale: "es" });
      expect(msg).toMatch(/departamento/i);
      expect(msg).not.toMatch(/Planificaci[oó]n/i);
    } else {
      expect(routed.family).toBe("department");
      expect(routed.toolContext?.department).toBe("Estrategias de negocios");
    }
  });

  it("sí-style layer pick: el departamento after estrategias ask", () => {
    const first = runGinaQueryFamily("entregame todos sobre estrategias", ctx);
    if (first.family !== "word_scope") return;
    const follow = runGinaQueryFamily("el departamento de Estrategias de negocios", ctx);
    expect(follow.family).toBe("department");
    expect(follow.toolContext?.department).toBe("Estrategias de negocios");
  });

  it("todo sobre blogs unique category lists only Blogs docs", () => {
    const routed = runGinaQueryFamily("entrégame todo sobre blogs", ctx);
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext?.mode).toBe("list_by_category");
    const ids = (routed.toolContext?.documents || []).map((d) => d.id);
    expect(ids).toContain("blog_a");
    expect(ids).not.toContain("pdn_doc");
    expect(ids).not.toContain("loose_doc");
  });

  it("empty needle is honest — no invented department", () => {
    const routed = runGinaQueryFamily("dame todo lo de unicornios espaciales", ctx);
    expect(routed.family).toBe("word_scope");
    expect(routed.toolContext?.empty).toBe(true);
    expect(routed.family).not.toBe("free_chat");
  });

  it("parseWordScopeLayerReply needs both variables when several layers match the same phrase", () => {
    const scan = scanGinaWordScope(ctx, "plan de negocio");
    expect(parseWordScopeLayerReply("plan de negocios", scan)).toBe(null);
    const picked = parseWordScopeLayerReply("la categoría plan de negocio", scan);
    expect(picked?.layer).toBe("category");
    expect(picked?.name).toMatch(/plan de negocio/i);
  });
});
