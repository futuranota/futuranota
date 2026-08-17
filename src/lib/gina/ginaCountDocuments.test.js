import { describe, expect, it, beforeEach } from "vitest";
import {
  runGinaQueryFamily,
  wantsCountDocuments,
  wantsCorpusDocsListAll,
  wantsDocsByDepartmentBrowse,
  wantsDocsByCategoryBrowse,
  wantsFolderDocsList,
  sortDocsScheduledThenFlexible,
} from "./ginaQueryFamily.js";
import { parseWorkspaceQuery } from "./ginaWorkspaceQuery.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import {
  buildGinaFunnelHeadline,
  buildGinaReplyChips,
} from "./ginaReplyChips.js";
import { buildResaltarCategoryChipText } from "./ginaSyntaxDocsByCategory.js";
import { shouldUseGinaSearchSequence } from "./ginaSearchSequence.js";
import { clearPendingGinaOffer } from "./ginaPendingOffer.js";

const now = new Date("2026-08-01T12:00:00");

const ctx = {
  objectId: "co1",
  corpusName: "Futura Nota",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [
        { label: "Blogs", description: "" },
        { label: "Social", description: "" },
      ],
    },
    {
      id: "dept_s",
      objectId: "co1",
      category: "Ventas",
      subcategories: [
        { label: "Informes", description: "" },
      ],
    },
  ],
  docs: {
    f1: {
      id: "f1",
      title: "Trends",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Blogs",
    },
    f2: {
      id: "f2",
      title: "Clients",
      parentObjectId: "co1",
      departmentId: "dept_s",
      category: "Informes",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Scheduled A",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
      anchorAt: "2026-08-01T09:00:00",
      anchorFinishAt: "2026-08-01T10:00:00",
    },
    n2: {
      id: "n2",
      title: "Flexible B",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
    n3: {
      id: "n3",
      title: "Sales report",
      parentDocId: "f2",
      objectId: "co1",
      status: "in_progress",
      anchorAt: "2026-08-01T14:00:00",
      anchorFinishAt: "2026-08-01T15:00:00",
    },
  },
};

describe("Gina count_documents browse + list", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
  });

  it("counts docs across all departments (does not reject 'departamentos')", () => {
    expect(
      wantsCountDocuments(
        "Gina cuantos documentos en total tenemos en todos los departamentos?",
      ),
    ).toBe(true);
    const routed = runGinaQueryFamily(
      "Gina cuantos documentos en total tenemos en todos los departamentos?",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.mode).toBe("count");
    expect(routed.toolContext.department).toBeNull();
    expect(routed.toolContext.count).toBe(3);

    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("document_count");
    expect(viz.data.documents).toEqual([]);
    expect(viz.data.count).toBe(3);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/3/);
    expect(msg).toMatch(/listado completo|departamentos|categorías/i);

    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => /Listado completo/i.test(c.label))).toBe(true);
    expect(chips.some((c) => /Por departamento/i.test(c.label))).toBe(true);
    expect(chips.some((c) => /Por categoría/i.test(c.label))).toBe(true);
  });

  it("total por el momento → count summary without document blocks", () => {
    const routed = runGinaQueryFamily(
      "hola gina como estas, me puedes dar el total de documentos que tenemos por el momento?",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.mode).toBe("count");
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("document_count");
    expect(Array.isArray(viz.data.documents) ? viz.data.documents.length : 0).toBe(0);
    expect(viz.data.count).toBe(3);
  });

  it("does not count folderless independent docs as a # Department bucket", () => {
    const withIndependent = {
      ...ctx,
      nodes: {
        ...ctx.nodes,
        n_ind: {
          id: "n_ind",
          title: "Inbox draft",
          parentDocId: null,
          objectId: "co1",
          status: "not_started",
        },
      },
    };
    const routed = runGinaQueryFamily(
      "Cuántos documentos en total tenemos en todos los departamentos?",
      withIndependent,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.count).toBe(3);
    const list = runGinaQueryFamily("entregame todos los documentos", withIndependent);
    expect(list.toolContext.mode).toBe("list_all");
    expect(list.toolContext.documents.some((d) => d.title === "Inbox draft")).toBe(false);
  });

  it("listado completo → all_docs Doc|Cat|Status|Time + dept rail (incluye Flexible)", () => {
    expect(wantsCorpusDocsListAll("Quiero el listado completo")).toBe(true);
    expect(wantsFolderDocsList("Quiero el listado de todos los documentos")).toBe(false);
    expect(wantsCorpusDocsListAll("Gina quiero el listado de todos los documentos")).toBe(true);

    const routed = runGinaQueryFamily(
      "Gina quiero el listado de todos los documentos",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.mode).toBe("list_all");
    expect(routed.toolContext.count).toBe(3);
    expect(routed.toolContext.view.layout).toBe("all_docs");
    expect(routed.toolContext.view.showSchedule).toBe(true);
    expect(routed.toolContext.view.showStatus).toBe(true);
    expect(routed.toolContext.view.timedOnly).toBe(false);
    expect(routed.toolContext.documents.some((d) => d.title === "Flexible B")).toBe(true);
    expect(routed.toolContext.groups?.length).toBeGreaterThan(0);

    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.fromCountDocuments).toBe(true);
    expect(viz.data.view.showSchedule).toBe(true);
    expect(viz.data.view.showStatus).toBe(true);
    expect(viz.data.columns).toEqual(["document", "category", "status", "time"]);
    expect(viz.data.railMode).toBe("department");
    expect(viz.data.departmentRail?.length).toBeGreaterThan(0);
    expect(viz.data.departmentRail.every((s) => s.color && s.count > 0)).toBe(true);
    expect(viz.data.documents.every((d) => d.department)).toBe(true);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/por departamento/i);
    expect(shouldUseGinaSearchSequence("count_documents")).toBe(true);

    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
      salt: 0,
    });
    expect(chips.some((c) => c.group === "list_refine")).toBe(true);
    expect(chips.some((c) => c.kind === "prompt")).toBe(true);
    expect(chips.some((c) => c.kind === "category" && c.label === "Blogs")).toBe(true);
    expect(chips.some((c) => /^Resaltar\s+/i.test(c.label))).toBe(false);
    expect(chips.some((c) => c.kind === "schedule_scope")).toBe(true);
    expect(chips.some((c) => /semana/i.test(c.label))).toBe(true);
    expect(chips.filter((c) => c.kind === "category").length).toBeLessThanOrEqual(8);
  });

  it("Resaltar categoría → solo lista filtrada + deferred highlight + copy", () => {
    const routed = runGinaQueryFamily(
      "Filtrar y resaltar: Blogs",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.mode).toBe("list_all");
    expect(routed.toolContext.view.highlightCategories.map((c) => c.toLowerCase())).toContain("blogs");
    expect(routed.toolContext.documents.length).toBe(2);
    expect(
      routed.toolContext.documents.every((d) => /blogs/i.test(d.category || "")),
    ).toBe(true);
    expect(routed.toolContext.deferredCategoryHighlight).toBe(true);
    expect(routed.toolContext.highlightDelayMs).toBe(2000);

    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.documents.length).toBe(2);
    expect(viz.data.deferredCategoryHighlight).toBe(true);
    expect(viz.data.highlightDelayMs).toBe(2000);
    expect(viz.data.view.highlightCategories.map((c) => c.toLowerCase())).toContain("blogs");
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/se filtraron\s+\*\*2\*\*/i);
    expect(msg).toMatch(/categor[ií]a\s+\*\*blogs\*\*/i);
    expect(msg).not.toMatch(/subrayar el área/i);

    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips).toHaveLength(1);
    expect(chips[0].kind).toBe("nav_back");
    expect(chips[0].label).toMatch(/Volver/i);
    expect(chips.some((c) => /Resaltar Blogs/i.test(c.label))).toBe(false);
  });

  it("NL docs que sean de / Resaltar / comando / slash → filtered sheet", () => {
    for (const phrase of [
      "entregame todos los docs que sean de Blogs",
      "Resaltar Blogs",
      "Filtrar y resaltar: Blogs",
      '/buscar --categoria "Blogs" --resaltar',
      buildResaltarCategoryChipText("Blogs", { locale: "es" }),
    ]) {
      const routed = runGinaQueryFamily(phrase, ctx);
      expect(routed.family).toBe("count_documents");
      expect(routed.toolContext.mode).toBe("list_all");
      expect(routed.toolContext.view.highlightCategories.map((c) => c.toLowerCase())).toContain(
        "blogs",
      );
      expect(routed.toolContext.documents.length).toBe(2);
      expect(routed.toolContext.deferredCategoryHighlight).toBe(true);
    }
  });

  it("entregame / tráeme todos los docs → list_all (not unclear)", () => {
    expect(wantsCorpusDocsListAll("entregame todos los documentos")).toBe(true);
    expect(wantsCorpusDocsListAll("tráeme todos los docs")).toBe(true);
    expect(wantsCorpusDocsListAll("quiero ver todos los documentos")).toBe(true);

    const parsed = parseWorkspaceQuery("entregame todos los documentos");
    expect(parsed.action).toBe("FETCH");
    expect(parsed.target).toBe("documents");

    for (const phrase of [
      "entregame todos los documentos",
      "tráeme todos los docs",
      "quiero ver todos los documentos",
    ]) {
      const routed = runGinaQueryFamily(phrase, ctx);
      expect(routed.family).toBe("count_documents");
      expect(routed.toolContext.mode).toBe("list_all");
      expect(routed.toolContext.count).toBe(3);
    }
  });

  it("listado completo con horarios → timed only (excluye flexible) + Time + Status", () => {
    const routed = runGinaQueryFamily(
      "Listado completo con horarios",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.view.showSchedule).toBe(true);
    expect(routed.toolContext.documents.every((d) => Boolean(d.anchorAt))).toBe(true);
    expect(routed.toolContext.documents.some((d) => d.title === "Flexible B")).toBe(false);
    expect(routed.toolContext.documents[0].title).toBe("Scheduled A");
    expect(routed.toolContext.count).toBe(2);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.view.showSchedule).toBe(true);
    expect(viz.data.columns).toContain("time");
    expect(viz.data.columns).toContain("status");
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/horarios/i);
  });

  it("+horarios con categoría filtrada también excluye flexible", () => {
    const routed = runGinaQueryFamily(
      "Filtrar y resaltar: Blogs · con horarios",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.view.showSchedule).toBe(true);
    expect(routed.toolContext.documents.map((d) => d.title)).toEqual(["Scheduled A"]);
    expect(routed.toolContext.documents.every((d) => Boolean(d.anchorAt))).toBe(true);
  });

  it("listado completo categorías multi → unión filtrada", () => {
    const routed = runGinaQueryFamily(
      "Listado completo categorías: Blogs, Informes",
      ctx,
    );
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.mode).toBe("list_all");
    expect(routed.toolContext.view.categories.map((c) => c.toLowerCase())).toEqual(
      expect.arrayContaining(["blogs", "informes"]),
    );
    expect(routed.toolContext.count).toBe(3);
    expect(routed.toolContext.documents.length).toBe(3);
    expect(routed.toolContext.deferredCategoryHighlight).toBe(true);
  });

  it("por departamento → pick menu then columnar table", () => {
    expect(wantsDocsByDepartmentBrowse("Ver documentos por departamento")).toBe(true);
    const menu = runGinaQueryFamily("Ver documentos por departamento", ctx);
    expect(menu.family).toBe("count_documents");
    expect(menu.toolContext.mode).toBe("pick_department");
    expect(menu.toolContext.departments.map((d) => d.name)).toEqual(
      expect.arrayContaining(["Marketing", "Ventas"]),
    );

    const menuViz = buildGinaVisualization("count_documents", menu.toolContext, {
      locale: "es",
    });
    expect(menuViz?.type).toBe("department_list");
    expect(menuViz.data.fromCountDocuments).toBe(true);

    const filtered = runGinaQueryFamily(
      "Documentos del departamento Marketing",
      ctx,
    );
    expect(filtered.family).toBe("count_documents");
    expect(filtered.toolContext.mode).toBe("list_by_department");
    expect(filtered.toolContext.department).toBe("Marketing");
    expect(filtered.toolContext.count).toBe(2);
    expect(filtered.toolContext.documents.every((d) => d.departmentName === "Marketing")).toBe(true);

    const tableViz = buildGinaVisualization("count_documents", filtered.toolContext, {
      locale: "es",
      now,
    });
    expect(tableViz?.type).toBe("table");
    expect(tableViz.data.scope).toBe("department");
    // Same all_docs contract as corpus list (Doc|Cat|Status|Time + dept rail)
    expect(filtered.toolContext.view?.layout).toBe("all_docs");
    expect(tableViz.data.columns).toEqual(["document", "category", "status", "time"]);
    expect(tableViz.data.railMode).toBe("department");
    expect(tableViz.data.departmentRail?.length).toBe(1);
    expect(tableViz.data.departmentRail[0].name).toBe("Marketing");
  });

  it("por categoría → pick menu then filtered list", () => {
    expect(wantsDocsByCategoryBrowse("Ver documentos por categoría")).toBe(true);
    const menu = runGinaQueryFamily("Ver documentos por categoría", ctx);
    expect(menu.family).toBe("count_documents");
    expect(menu.toolContext.mode).toBe("pick_category");
    expect(menu.toolContext.categories.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Blogs", "Informes"]),
    );

    const filtered = runGinaQueryFamily(
      "Documentos de la categoría Blogs",
      ctx,
    );
    expect(filtered.family).toBe("count_documents");
    expect(filtered.toolContext.mode).toBe("list_by_category");
    expect(filtered.toolContext.category).toBe("Blogs");
    expect(filtered.toolContext.count).toBe(2);
  });

  it("sortDocsScheduledThenFlexible puts timed first", () => {
    const sorted = sortDocsScheduledThenFlexible([
      { title: "Flex", anchorAt: null },
      { title: "Late", anchorAt: "2026-08-01T16:00:00" },
      { title: "Early", anchorAt: "2026-08-01T08:00:00" },
    ]);
    expect(sorted.map((d) => d.title)).toEqual(["Early", "Late", "Flex"]);
  });
});
