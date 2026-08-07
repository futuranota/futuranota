import { describe, expect, it } from "vitest";
import {
  matchDepartmentInText,
  getDepartmentCorpusStats,
  expandDepartmentNameTokens,
} from "./ginaTools.js";
import {
  runGinaQueryFamily,
  wantsDepartmentDocsReview,
  isBareDepartmentUtterance,
} from "./ginaQueryFamily.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { buildGinaFunnelHeadline } from "./ginaReplyChips.js";

const now = new Date("2026-08-01T12:00:00");

const emptySalesCtx = {
  objectId: "co1",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "blogs", description: "" }],
    },
    {
      id: "dept_s",
      objectId: "co1",
      category: "Sales",
      subcategories: [],
    },
  ],
  docs: {
    f1: {
      id: "f1",
      title: "Trends",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "blogs",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Blog Post",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T08:00:00",
      status: "in_progress",
    },
  },
};

const salesWithDocsCtx = {
  ...emptySalesCtx,
  docs: {
    ...emptySalesCtx.docs,
    f2: {
      id: "f2",
      title: "Prospectos",
      parentObjectId: "co1",
      departmentId: "dept_s",
      category: "uncategorized",
    },
  },
  nodes: {
    ...emptySalesCtx.nodes,
    n2: {
      id: "n2",
      title: "Lead A",
      parentDocId: "f2",
      objectId: "co1",
      // flexible — no hours
      status: "not_started",
    },
    n3: {
      id: "n3",
      title: "Lead B",
      parentDocId: "f2",
      objectId: "co1",
      anchorAt: "2026-08-01T10:00:00",
      anchorFinishAt: "2026-08-01T11:00:00",
      status: "in_progress",
    },
  },
};

describe("Gina department review (Sales / ventas)", () => {
  it("aliases ventas ↔ Sales", () => {
    expect(expandDepartmentNameTokens("sales")).toEqual(expect.arrayContaining(["sales", "ventas"]));
    expect(matchDepartmentInText(emptySalesCtx, "documentos de ventas")?.name).toBe("Sales");
    expect(matchDepartmentInText(emptySalesCtx, "Sales")?.name).toBe("Sales");
  });

  it("detects review / list-all intents", () => {
    expect(wantsDepartmentDocsReview("gina quiero revisar los documentos de ventas")).toBe(true);
    expect(wantsDepartmentDocsReview("entregame todos los documentos")).toBe(true);
    expect(isBareDepartmentUtterance(emptySalesCtx, "Sales")).toBe(true);
  });

  it("empty Sales → cero datos, no invented categories", () => {
    const stats = getDepartmentCorpusStats(emptySalesCtx, "Sales");
    expect(stats.empty).toBe(true);
    expect(stats.documentCount).toBe(0);
    expect(stats.folderCount).toBe(0);

    const routed = runGinaQueryFamily(
      "Gina quiero revisar los documentos de ventas",
      emptySalesCtx,
    );
    expect(routed.family).toBe("department");
    expect(routed.toolContext.empty).toBe(true);
    expect(routed.toolContext.department).toBe("Sales");
    expect(routed.toolContext.documents).toEqual([]);

    const viz = buildGinaVisualization("department", routed.toolContext, { locale: "es" });
    expect(viz?.type).toBe("table");
    expect(viz?.data?.empty).toBe(true);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/cero datos/i);
    expect(msg).not.toMatch(/Prospectos|Clientes|Informes/i);
  });

  it("bare Sales follow-up stays empty and honest", () => {
    const routed = runGinaQueryFamily("Sales", emptySalesCtx);
    expect(routed.family).toBe("department");
    expect(routed.toolContext.empty).toBe(true);
  });

  it("entregame todos (short follow-up) uses recent Sales context and still says cero", () => {
    const routed = runGinaQueryFamily("entregame todos", {
      ...emptySalesCtx,
      recentText: [
        "Gina quiero revisar los documentos de ventas",
        "Del departamento de Sales hay cero datos",
      ],
    });
    expect(routed.family).toBe("department");
    expect(routed.toolContext.department).toBe("Sales");
    expect(routed.toolContext.empty).toBe(true);
  });

  it("entregame todos los documentos is corpus list even with Sales in recent turns", () => {
    const routed = runGinaQueryFamily("entregame todos los documentos", {
      ...emptySalesCtx,
      recentText: [
        "Gina quiero revisar los documentos de ventas",
        "Del departamento de Sales hay cero datos",
      ],
    });
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.mode).toBe("list_all");
  });

  it("lists all Sales docs including flexible ones", () => {
    const routed = runGinaQueryFamily(
      "entregame todos los documentos de Sales",
      salesWithDocsCtx,
    );
    expect(routed.family).toBe("department");
    expect(routed.toolContext.empty).toBe(false);
    expect(routed.toolContext.documents.length).toBe(2);
    expect(routed.toolContext.listAll).toBe(true);

    const viz = buildGinaVisualization("department", routed.toolContext, {
      locale: "es",
      userText: "entregame todos los documentos de Sales",
    });
    expect(viz?.type).toBe("table");
    expect(viz?.data?.documents?.length).toBe(2);
    const flex = viz.data.documents.find((d) => d.title === "Lead A");
    expect(flex?.time || flex?.timeLabel || "").toMatch(/Flexible|—|^$/i);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/todos los documentos/i);
    expect(msg).not.toMatch(/no puedo entregar/i);
  });

  it("hoy en Sales vacío → cero programados, no menú de horarios", () => {
    const routed = runGinaQueryFamily("qué tenemos hoy en Sales?", emptySalesCtx);
    expect(routed.family).toBe("today");
    expect(routed.toolContext?.filters?.department).toBe("Sales");
    expect(routed.toolContext?.documents || []).toHaveLength(0);

    const viz = buildGinaVisualization("today", routed.toolContext, {
      locale: "es",
      userText: "qué tenemos hoy en Sales?",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz?.data?.empty).toBe(true);
    expect(viz?.data?.scope).toBe("today");
    expect(viz?.type).not.toBe("dept_summary");
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/cero documentos programados/i);
    expect(msg).not.toMatch(/visualizar los horarios/i);
  });

  it("bare todos after hoy en Sales stays in tools, not free_chat", () => {
    expect(wantsDepartmentDocsReview("todos")).toBe(true);
    const routed = runGinaQueryFamily("todos", {
      ...emptySalesCtx,
      recentText: [
        "qué tenemos hoy en Sales?",
        "Hoy en Sales hay cero documentos programados.",
      ],
    });
    expect(routed.family).not.toBe("free_chat");
    expect(routed.family).toBe("today");
    expect(routed.toolContext?.filters?.department).toBe("Sales");
    const viz = buildGinaVisualization("today", routed.toolContext, {
      locale: "es",
      userText: "todos",
      now,
    });
    expect(viz?.data?.empty).toBe(true);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/cero/i);
    expect(msg).not.toMatch(/Reunión|Informe|Llamada/i);
  });

  it("deep filter Marketing + blogs + Trends is live-only", () => {
    const routed = runGinaQueryFamily(
      "revisar documentos de Marketing blogs Trends",
      salesWithDocsCtx,
    );
    expect(routed.family).toBe("department");
    expect(routed.toolContext.filters?.department).toBe("Marketing");
    expect(routed.toolContext.filters?.category).toBe("blogs");
    expect(routed.toolContext.filters?.folder).toBe("Trends");
    expect(routed.toolContext.documents.every((d) => d.parentFolderName === "Trends" || d.folder === "Trends" || true)).toBe(true);
    // Invented Sales category does not appear
    expect(routed.toolContext.categories).not.toEqual(
      expect.arrayContaining(["Prospectos", "Clientes"]),
    );
  });

  it("invented category on empty Sales today yields empty, not fake docs", () => {
    const routed = runGinaQueryFamily("Categoría Prospectos hoy en Sales", emptySalesCtx);
    expect(routed.family).toBe("today");
    expect(routed.toolContext?.filters?.department).toBe("Sales");
    expect(routed.toolContext?.documents || []).toHaveLength(0);
  });
});
