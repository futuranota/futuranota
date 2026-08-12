/**
 * Tests: lastTurn store + follow-up syntax (modify / refine / open named).
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  clearGinaLastTurn,
  getGinaLastTurn,
  getGinaTurnHistory,
  setGinaLastTurn,
  stampGinaLastTurnFromRouted,
  isGinaLastTurnScheduleLike,
  resolveLastTurnAnchor,
} from "./ginaLastTurn.js";
import {
  parseLastTurnIntent,
  wantsGinaLastTurnFollowUp,
  extractLastTurnOpenTitle,
  extractLastTurnCategoryHint,
  buildLastTurnModifyMessage,
  buildLastTurnModifyChips,
  buildLastTurnRefineMessage,
  buildLastTurnCategoryRefineMessage,
} from "./ginaSyntaxLastTurn.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const now = new Date(2026, 7, 12, 12, 0, 0); // Wed Aug 12, 2026 local

const marketingCtx = {
  objectId: "co1",
  corpusName: "General",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [
        { label: "Script", description: "" },
        { label: "Blogs", description: "" },
      ],
    },
    {
      id: "dept_n",
      objectId: "co1",
      category: "Negocio",
      subcategories: [],
    },
    {
      id: "dept_s",
      objectId: "co1",
      category: "Sales",
      subcategories: [],
    },
  ],
  docs: {
    f_script: {
      id: "f_script",
      title: "Videoscripts",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Script",
    },
    f_blogs: {
      id: "f_blogs",
      title: "Horizon",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Blogs",
    },
    f_neg: {
      id: "f_neg",
      title: "Testing range",
      parentObjectId: "co1",
      departmentId: "dept_n",
      category: "uncategorized",
    },
    f_sales: {
      id: "f_sales",
      title: "Asistente test",
      parentObjectId: "co1",
      departmentId: "dept_s",
      category: "uncategorized",
    },
  },
  nodes: {
    guion: {
      id: "guion",
      title: "Guion de la Parte 01",
      parentDocId: "f_script",
      objectId: "co1",
      status: "flexible",
      // flexible — no anchorAt
    },
    today_mkt: {
      id: "today_mkt",
      title: "Blog slot hoy Marketing",
      parentDocId: "f_blogs",
      objectId: "co1",
      status: "not_started",
      anchorAt: "2026-08-12T15:00:00",
      anchorFinishAt: "2026-08-12T16:00:00",
    },
    past_mkt: {
      id: "past_mkt",
      title: "Blog slot pasado",
      parentDocId: "f_blogs",
      objectId: "co1",
      status: "past_due",
      anchorAt: "2026-08-09T13:30:00",
      anchorFinishAt: "2026-08-09T13:45:00",
    },
    blog_third: {
      id: "blog_third",
      title: "08-08 (7:30-11:45pm) Blogs",
      parentDocId: "f_blogs",
      objectId: "co1",
      status: "not_started",
      anchorAt: "2026-08-08T19:30:00",
      anchorFinishAt: "2026-08-08T23:45:00",
    },
    blogs_in_title_only: {
      id: "blogs_in_title_only",
      title: "Apify notes about Blogs pricing",
      parentDocId: "f_script",
      objectId: "co1",
      status: "flexible",
    },
    sales_doc: {
      id: "sales_doc",
      title: "Sales follow-up",
      parentDocId: "f_sales",
      objectId: "co1",
      status: "in_progress",
    },
    neg_today: {
      id: "neg_today",
      title: "PDN Negocio",
      parentDocId: "f_neg",
      objectId: "co1",
      status: "not_started",
      anchorAt: "2026-08-12T09:00:00",
      anchorFinishAt: "2026-08-12T10:00:00",
    },
  },
};

describe("ginaSyntaxLastTurn", () => {
  beforeEach(() => {
    clearGinaLastTurn();
  });

  it("matches modify / open follow-ups", () => {
    expect(parseLastTurnIntent("Quiero modificar este calendario")).toBe("modify_ref");
    expect(parseLastTurnIntent("no, quiero que me modiques este calendario")).toBe("modify_ref");
    expect(parseLastTurnIntent("ábrelo")).toBe("open_ref");
    expect(parseLastTurnIntent("abreme el documento")).toBe("open_ref");
    expect(parseLastTurnIntent("abre el primero")).toBe("open_first");
  });

  it("matches refine exclude flexible + today", () => {
    expect(parseLastTurnIntent(
      "QUIERO QUE ME EXCLUYAS LOS FLEXIBLES Y ME DEJES SOLAMENTE LOS QUE TIENEN HORARIOS PARA HOY",
    )).toBe("refine_exclude_flexible_today");
    expect(parseLastTurnIntent("excluir flexibles solo horarios de hoy")).toBe(
      "refine_exclude_flexible_today",
    );
  });

  it("matches open_named from previous table", () => {
    const phrase = "DE LA TABLA ANTERIOR QUIERO QUE ME ABRAS EL DOCUMENTO Guion de la Parte 01";
    expect(parseLastTurnIntent(phrase)).toBe("open_named");
    expect(extractLastTurnOpenTitle(phrase)).toMatch(/guion de la parte 01/i);
  });

  it("does not steal classic horarios de hoy", () => {
    expect(wantsGinaLastTurnFollowUp("Muéstrame los horarios de hoy")).toBe(false);
    expect(wantsGinaLastTurnFollowUp("Abrir Blog Post Trends")).toBe(false);
  });

  it("stamps schedule turn and answers modify with chips", () => {
    stampGinaLastTurnFromRouted({
      family: "today",
      toolContext: {
        documents: [
          { id: "n1", title: "Pitch A" },
          { id: "n2", title: "Pitch B" },
        ],
      },
    }, { objectId: "co1", userText: "Muéstrame los horarios de hoy" });

    const turn = getGinaLastTurn();
    expect(turn?.refKind).toBe("schedule");
    expect(isGinaLastTurnScheduleLike(turn)).toBe(true);

    const routed = runGinaQueryFamily("Quiero modificar este calendario", {
      docs: {},
      nodes: {},
      departments: [],
      lastTurn: turn,
    });
    expect(routed.family).toBe("last_turn_modify");
    expect(buildLastTurnModifyChips({
      locale: "es",
      documents: routed.toolContext.documents,
    }).some((c) => c.text === "GinaOpenDocument:n1")).toBe(true);
  });

  it("honest reply when modify without lastTurn", () => {
    const routed = runGinaQueryFamily("Quiero modificar este calendario", {
      docs: {},
      nodes: {},
      departments: [],
    });
    expect(routed.family).toBe("last_turn_missing");
    expect(buildLastTurnModifyMessage({ locale: "es", hasLastTurn: false })).toMatch(/departamento|horarios/i);
  });

  it("refines Marketing table: exclude flexible, only today — not Negocio sheet", () => {
    stampGinaLastTurnFromRouted({
      family: "department",
      toolContext: {
        department: "Marketing",
        documents: [
          { id: "guion", title: "Guion de la Parte 01" },
          { id: "today_mkt", title: "Blog slot hoy Marketing" },
          { id: "past_mkt", title: "Blog slot pasado" },
        ],
      },
    }, { userText: "gina quiero todos los docs del departamento de marketing" });

    expect(getGinaLastTurn()?.department).toBe("Marketing");

    const refined = runGinaQueryFamily(
      "QUIERO QUE ME EXCLUYAS LOS FLEXIBLES Y ME DEJES SOLAMENTE LOS QUE TIENEN HORARIOS PARA HOY",
      marketingCtx,
    );
    expect(refined.family).toBe("count_documents");
    expect(refined.toolContext?.fromLastTurnRefine).toBe(true);
    expect(refined.toolContext?.department).toBe("Marketing");
    expect(refined.toolContext?.view?.scheduleScope).toBe("today");
    expect(refined.toolContext?.view?.showSchedule).toBe(true);

    const ids = (refined.toolContext?.documents || []).map((d) => d.id);
    expect(ids).toContain("today_mkt");
    expect(ids).not.toContain("guion");
    expect(ids).not.toContain("past_mkt");
    expect(ids).not.toContain("neg_today");

    expect(buildLastTurnRefineMessage({
      locale: "es",
      department: "Marketing",
      count: ids.length,
    })).toMatch(/Marketing.*sin flexibles.*hoy/i);
  });

  it("open_named from anchored Marketing table → focus_open silent", () => {
    setGinaLastTurn({
      family: "department",
      refKind: "department",
      department: "Marketing",
      documents: [
        { id: "guion", title: "Guion de la Parte 01" },
        { id: "today_mkt", title: "Blog slot hoy Marketing" },
      ],
      ts: Date.now(),
    });

    const open = runGinaQueryFamily(
      "DE LA TABLA ANTERIOR QUIERO QUE ME ABRAS EL DOCUMENTO Guion de la Parte 01",
      marketingCtx,
    );
    expect(open.family).toBe("focus_open");
    expect(open.openDocumentId).toBe("guion");
    expect(open.toolContext?.openNamed).toBe(true);
  });

  it("matches refine filter category on previous table", () => {
    const phrase = "filtrame la tabla anterior por todos los blogs";
    expect(parseLastTurnIntent(phrase)).toBe("refine_filter_category");
    expect(extractLastTurnCategoryHint(phrase)).toMatch(/^blogs$/i);
  });

  it("refines Marketing table by Blogs category — strict metadata, Horizon folder", () => {
    stampGinaLastTurnFromRouted({
      family: "count_documents",
      toolContext: {
        department: "Marketing",
        documents: [
          { id: "guion", title: "Guion de la Parte 01" },
          { id: "today_mkt", title: "Blog slot hoy Marketing" },
          { id: "past_mkt", title: "Blog slot pasado" },
          { id: "blog_third", title: "08-08 Blogs" },
          { id: "blogs_in_title_only", title: "Apify notes about Blogs pricing" },
        ],
      },
    }, { userText: "gina quiero todos los docs del departamento de marketing" });

    const refined = runGinaQueryFamily(
      "filtrame la tabla anterior por todos los blogs",
      marketingCtx,
    );
    expect(refined.family).toBe("count_documents");
    expect(refined.toolContext?.fromLastTurnCategoryRefine).toBe(true);
    expect(refined.toolContext?.matchKind).toBe("category");
    expect(refined.toolContext?.singleFolderName).toBe("Horizon");

    const ids = (refined.toolContext?.documents || []).map((d) => d.id);
    expect(ids).toContain("today_mkt");
    expect(ids).toContain("past_mkt");
    expect(ids).toContain("blog_third");
    expect(ids).not.toContain("guion");
    expect(ids).not.toContain("blogs_in_title_only");
    expect(ids).not.toContain("neg_today");
    expect(ids.length).toBe(3);

    const msg = buildLastTurnCategoryRefineMessage({
      locale: "es",
      matchKind: "category",
      department: "Marketing",
      category: "Blogs",
      folderCount: 1,
      singleFolderName: "Horizon",
      count: 3,
    });
    expect(msg).toMatch(/un solo folder/i);
    expect(msg).toMatch(/Horizon/i);
    expect(msg).not.toMatch(/de las blogs/i);
  });

  it("anchors category refine to Marketing when Sales was the last table", () => {
    stampGinaLastTurnFromRouted({
      family: "count_documents",
      toolContext: {
        department: "Marketing",
        documents: [{ id: "today_mkt", title: "Blog slot hoy Marketing" }],
      },
    }, { userText: "docs marketing" });
    stampGinaLastTurnFromRouted({
      family: "count_documents",
      toolContext: {
        department: "Sales",
        documents: [{ id: "sales_doc", title: "Sales follow-up" }],
      },
    }, { userText: "docs sales" });

    expect(getGinaLastTurn()?.department).toBe("Sales");
    const { anchor, reason } = resolveLastTurnAnchor(
      "filtrame la tabla anterior por todos los blogs",
      { categoryNeedle: "blogs", ctx: marketingCtx },
    );
    expect(reason).toBe("category_department_match");
    expect(anchor?.department).toBe("Marketing");

    const refined = runGinaQueryFamily(
      "filtrame la tabla anterior por todos los blogs",
      marketingCtx,
    );
    expect(refined.toolContext?.department).toBe("Marketing");
    expect(refined.toolContext?.documents?.every((d) => d.category === "Blogs")).toBe(true);
  });

  it("returns natural empty when nothing matches keyword", () => {
    stampGinaLastTurnFromRouted({
      family: "count_documents",
      toolContext: {
        department: "Marketing",
        documents: [{ id: "guion", title: "Guion de la Parte 01" }],
      },
    }, { userText: "docs marketing" });

    const empty = runGinaQueryFamily(
      "filtrame la tabla anterior por xyzabc",
      marketingCtx,
    );
    expect(empty.family).toBe("last_turn_empty");
    expect(buildLastTurnCategoryRefineMessage({
      locale: "es",
      matchKind: "empty",
      needle: "xyzabc",
    })).toMatch(/no he encontrado absolutamente nada/i);
  });

  it("title tier copy when no live category matches", () => {
    const msg = buildLastTurnCategoryRefineMessage({
      locale: "es",
      matchKind: "title",
      needle: "blogs",
      count: 2,
    });
    expect(msg).toMatch(/contiene la palabra/i);
    expect(msg).not.toMatch(/folder/i);
  });

  it("explicit offset: anterior a la anterior skips immediate table", () => {
    stampGinaLastTurnFromRouted({
      family: "count_documents",
      toolContext: {
        department: null,
        documents: [
          { id: "guion", title: "Guion" },
          { id: "today_mkt", title: "Blog slot hoy Marketing" },
        ],
      },
    }, { userText: "listado completo" });
    stampGinaLastTurnFromRouted({
      family: "count_documents",
      toolContext: {
        department: "Sales",
        documents: [{ id: "sales_doc", title: "Sales follow-up" }],
      },
    }, { userText: "docs sales" });

    const { anchor, reason } = resolveLastTurnAnchor(
      "filtrame la anterior a la anterior por horarios",
    );
    expect(reason).toBe("explicit_offset");
    expect(anchor?.department).toBeNull();
    expect(getGinaTurnHistory().length).toBe(2);
  });

  it("routes live wording: modiques + ábreme el documento", () => {
    stampGinaLastTurnFromRouted({
      family: "today",
      toolContext: {
        documents: [{ id: "pdn1", title: "PDN" }],
      },
    }, { userText: "gina hola, me puedes dar los horarios de hoy" });

    const modify = runGinaQueryFamily(
      "no, quiero que me modiques este calendario",
      { docs: {}, nodes: {}, departments: [] },
    );
    expect(modify.family).toBe("last_turn_modify");

    const open = runGinaQueryFamily("abreme el documento", {
      docs: {},
      nodes: { pdn1: { id: "pdn1", title: "PDN" } },
      departments: [],
    });
    expect(open.family).toBe("focus_open");
    expect(open.openDocumentId).toBe("pdn1");
  });
});
