import { describe, expect, it, beforeEach } from "vitest";
import {
  runGinaQueryFamily,
  wantsCountDepartments,
  recentWasFolderDocsOffer,
  isGinaAffirmationUtterance,
} from "./ginaQueryFamily.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import {
  buildGinaFunnelHeadline,
  buildGinaReplyChips,
} from "./ginaReplyChips.js";
import {
  clearPendingGinaOffer,
  getPendingGinaOffer,
  setPendingGinaOffer,
} from "./ginaPendingOffer.js";

const now = new Date("2026-08-01T12:00:00");

const ctx = {
  objectId: "co1",
  corpusName: "Futura Nota",
  now,
  departments: [
    {
      id: "dept_e",
      objectId: "co1",
      category: "Estrategias de negocios",
      subcategories: [{ label: "plan de negocio", description: "" }],
    },
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "Blogs", description: "" }],
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
      title: "Plan de Negocio",
      parentObjectId: "co1",
      departmentId: "dept_e",
      category: "plan de negocio",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Resumen ejecutivo",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
  },
};

describe("Gina count_departments", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
  });

  it("detects cuantos + typoed Departamenos + en General", () => {
    expect(
      wantsCountDepartments("Hola gina, Cuantos Departamenos tenemos en General ?"),
    ).toBe(true);
    expect(wantsCountDepartments("qué hay para hoy")).toBe(false);
  });

  it("routes typoed count to count_departments with live names", () => {
    const routed = runGinaQueryFamily(
      "Hola gina, Cuantos Departamenos tenemos en General ?",
      ctx,
    );
    expect(routed.family).toBe("count_departments");
    expect(routed.family).not.toBe("free_chat");
    expect(routed.toolContext.count).toBe(3);
    expect(routed.toolContext.corpusName).toBe("Futura Nota");
    expect(routed.toolContext.departments.map((d) => d.name)).toEqual(
      expect.arrayContaining(["Marketing", "Sales", "Estrategias de negocios"]),
    );
    expect(getPendingGinaOffer()).toBeNull();

    const viz = buildGinaVisualization("count_departments", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("department_list");
    expect(viz?.data?.count).toBe(3);

    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Futura Nota/);
    expect(msg).toMatch(/total de \*\*3\*\* departamentos/);
    expect(msg).toMatch(/Marketing/);
    expect(msg).toMatch(/enfocarte/);

    const chips = buildGinaReplyChips({
      family: "count_departments",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => /horarios de hoy/i.test(c.label))).toBe(true);
    expect(chips.some((c) => /Enfocarme en/i.test(c.label))).toBe(true);
  });

  it("empty corpus answers with zero departments", () => {
    const emptyCtx = {
      ...ctx,
      departments: [],
      docs: {},
      nodes: {},
    };
    const routed = runGinaQueryFamily("Cuántos departamentos en total?", emptyCtx);
    expect(routed.family).toBe("count_departments");
    expect(routed.toolContext.count).toBe(0);
    const viz = buildGinaVisualization("count_departments", routed.toolContext, {
      locale: "es",
    });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/0/);
  });

  it("clears stale list_folder pending when counting departments", () => {
    setPendingGinaOffer({ type: "list_folder", folderId: "f1" });
    const routed = runGinaQueryFamily(
      "Cuantos Departamenos tenemos en General ?",
      ctx,
    );
    expect(routed.family).toBe("count_departments");
    expect(getPendingGinaOffer()).toBeNull();
  });

  it("sí after count topic does not revive list_folder", () => {
    setPendingGinaOffer({ type: "list_folder", folderId: "f1" });
    expect(isGinaAffirmationUtterance("si")).toBe(true);
    expect(
      recentWasFolderDocsOffer({
        recentText: [
          "Hola gina, Cuantos Departamenos tenemos en General ?",
          "Para Futura Nota tenemos un total de 3 departamentos",
        ],
      }),
    ).toBe(false);

    const routed = runGinaQueryFamily("si", {
      ...ctx,
      recentText: [
        "Hola gina, Cuantos Departamenos tenemos en General ?",
        "Para Futura Nota tenemos un total de 3 departamentos",
      ],
    });
    expect(routed.family).not.toBe("folder_summary");
    expect(getPendingGinaOffer()).toBeNull();
  });

  it("sí still re-runs folder list when recent was folder offer", () => {
    setPendingGinaOffer({ type: "list_folder", folderId: "f1" });
    const routed = runGinaQueryFamily("si", {
      ...ctx,
      recentText: [
        "Dame todos los documentos del plan de negocio",
        "Aquí tienes los 2 documentos del folder Plan de Negocio",
      ],
    });
    expect(routed.family).toBe("folder_summary");
    expect(routed.toolContext.documents?.length).toBe(1);
  });
});
