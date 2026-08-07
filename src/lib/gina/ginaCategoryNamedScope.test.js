import { describe, expect, it, beforeEach } from "vitest";
import {
  runGinaQueryFamily,
  wantsNamedCategoryCountDocs,
  wantsNamedCategoryListFolders,
  wantsCountCategories,
} from "./ginaQueryFamily.js";
import { matchNamedCategoryInText } from "./ginaTools.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import {
  buildGinaFunnelHeadline,
  buildGinaReplyChips,
} from "./ginaReplyChips.js";
import {
  buildGinaSearchSequence,
  shouldUseGinaSearchSequence,
} from "./ginaSearchSequence.js";
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
        { label: "Email", description: "" },
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
      title: "Twitter",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Social",
    },
    f3: {
      id: "f3",
      title: "Instagram",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Social",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Post A",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
    n2: {
      id: "n2",
      title: "Post B",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
    n3: {
      id: "n3",
      title: "Tweet 1",
      parentDocId: "f2",
      objectId: "co1",
      status: "not_started",
    },
  },
};

const ctxSingular = {
  ...ctx,
  nodes: {
    n1: {
      id: "n1",
      title: "Only post",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
  },
};

describe("Gina named category scope", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
  });

  it("matches blogs / social media / redes sociales aliases to live categories", () => {
    expect(matchNamedCategoryInText(ctx, "cuantos blogs en marketing", "Marketing")?.name).toBe("Blogs");
    expect(matchNamedCategoryInText(ctx, "social media creadas", "Marketing")?.name).toBe("Social");
    expect(matchNamedCategoryInText(ctx, "redes sociales que tenemos", null)?.name).toBe("Social");
    expect(matchNamedCategoryInText(ctx, "cuantos podcasts en marketing", "Marketing")).toBeNull();
  });

  it("detects count_docs vs list_folders intents", () => {
    expect(wantsNamedCategoryCountDocs("Cuantos blogs tenemos en marketing")).toBe(true);
    expect(wantsNamedCategoryListFolders("Cuantos blogs tenemos en marketing")).toBe(false);
    expect(wantsNamedCategoryListFolders("Cuales son los redes sociales que tenemos creadas?")).toBe(true);
    expect(wantsNamedCategoryCountDocs("Cuales son los redes sociales que tenemos creadas?")).toBe(false);
    expect(wantsCountCategories("Cuantos blogs tenemos en marketing")).toBe(false);
  });

  it("blogs + Marketing → count_docs + plural copy", () => {
    const routed = runGinaQueryFamily(
      "Cuantos blogs tenemos en marketing gina?",
      ctx,
    );
    expect(routed.family).toBe("category_scope");
    expect(routed.toolContext.mode).toBe("count_docs");
    expect(routed.toolContext.category).toBe("Blogs");
    expect(routed.toolContext.department).toBe("Marketing");
    expect(routed.toolContext.documentCount).toBe(2);

    const viz = buildGinaVisualization("category_scope", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("category_scope");
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/creados\s+\*\*2\*\*\s+documentos de \*\*Blogs\*\*/i);
    expect(msg).toMatch(/por sección primero/i);
    expect(shouldUseGinaSearchSequence("category_scope")).toBe(true);
    expect(buildGinaSearchSequence("es").preludeMessage).toMatch(/dame un momento/i);

    const chips = buildGinaReplyChips({
      family: "category_scope",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => /Por sección/i.test(c.label))).toBe(true);
    expect(chips.some((c) => /Listado completo/i.test(c.label))).toBe(true);
  });

  it("1 documento → singular copy + sección/caja/cajón", () => {
    const routed = runGinaQueryFamily(
      "Cuantos blogs tenemos en marketing?",
      ctxSingular,
    );
    expect(routed.family).toBe("category_scope");
    expect(routed.toolContext.documentCount).toBe(1);
    const viz = buildGinaVisualization("category_scope", routed.toolContext, {
      locale: "es",
    });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/creado\s+\*\*1\*\*\s+documento/i);
    expect(msg).toMatch(/caja\s*\/\s*cajón|cajón/i);
  });

  it("social media / redes sociales → list_folders with bullets", () => {
    const routed = runGinaQueryFamily(
      "Cuales son los redes sociales que tenemos creadas?",
      ctx,
    );
    expect(routed.family).toBe("category_scope");
    expect(routed.toolContext.mode).toBe("list_folders");
    expect(routed.toolContext.category).toBe("Social");
    expect(routed.toolContext.folderCount).toBe(2);
    expect(routed.toolContext.folders.map((f) => f.name)).toEqual(
      expect.arrayContaining(["Twitter", "Instagram"]),
    );

    const viz = buildGinaVisualization("category_scope", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("folder_list");
    expect(viz.data.fromCategoryScope).toBe(true);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Social/);
    expect(msg).toMatch(/Twitter/);
    expect(msg).toMatch(/Instagram/);
  });

  it("categoría live con 0 folders → empty honesto", () => {
    const routed = runGinaQueryFamily(
      "Por sección primero en Email de Marketing",
      ctx,
    );
    expect(routed.family).toBe("category_scope");
    expect(routed.toolContext.mode).toBe("list_folders");
    expect(routed.toolContext.category).toBe("Email");
    expect(routed.toolContext.folderCount).toBe(0);
    expect(routed.toolContext.empty).toBe(true);

    const viz = buildGinaVisualization("category_scope", routed.toolContext, {
      locale: "es",
    });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/No tienes folders creados en \*\*Email\*\*/i);
  });

  it("no inventa categoría inexistente", () => {
    const routed = runGinaQueryFamily(
      "Cuantos podcasts tenemos en marketing?",
      ctx,
    );
    expect(routed.family).not.toBe("category_scope");
  });

  it("chip Por sección re-queries list_folders", () => {
    const routed = runGinaQueryFamily(
      "Por sección primero en Blogs de Marketing",
      ctx,
    );
    expect(routed.family).toBe("category_scope");
    expect(routed.toolContext.mode).toBe("list_folders");
    expect(routed.toolContext.category).toBe("Blogs");
    expect(routed.toolContext.folders.map((f) => f.name)).toContain("Trends");
  });

  it("chip Listado completo lists live documents", () => {
    const routed = runGinaQueryFamily(
      "Listado completo de Blogs en Marketing",
      ctx,
    );
    expect(routed.family).toBe("category_scope");
    expect(routed.toolContext.mode).toBe("list_docs");
    expect(routed.toolContext.documents.map((d) => d.id)).toEqual(
      expect.arrayContaining(["n1", "n2"]),
    );
    const viz = buildGinaVisualization("category_scope", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("table");
  });
});
