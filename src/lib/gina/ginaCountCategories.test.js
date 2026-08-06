import { describe, expect, it, beforeEach } from "vitest";
import {
  runGinaQueryFamily,
  wantsCountCategories,
  wantsCountFolders,
  wantsCountDepartments,
} from "./ginaQueryFamily.js";
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
      ],
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
      category: "Blogs",
    },
    f2: {
      id: "f2",
      title: "Reels",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Social",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Post 1",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
  },
};

describe("Gina count_categories", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
  });

  it("detects cuantas categorias (typo-tolerant entity)", () => {
    expect(wantsCountCategories("Cuántas categorias tenemos en Marketing?")).toBe(true);
    expect(wantsCountCategories("Cuántos folders tenemos en Marketing?")).toBe(false);
    expect(wantsCountFolders("Cuántos folders tenemos en Marketing?")).toBe(true);
    expect(wantsCountDepartments("Cuántas categorias tenemos")).toBe(false);
  });

  it("counts categories in Marketing", () => {
    const routed = runGinaQueryFamily(
      "Cuántas categorias tenemos en Marketing?",
      ctx,
    );
    expect(routed.family).toBe("count_categories");
    expect(routed.toolContext.department).toBe("Marketing");
    expect(routed.toolContext.count).toBe(2);
    expect(routed.toolContext.categories.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Blogs", "Social"]),
    );

    const viz = buildGinaVisualization("count_categories", routed.toolContext, {
      locale: "es",
    });
    expect(viz?.type).toBe("category_list");
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Marketing/);
    expect(msg).toMatch(/2/);
    expect(msg).toMatch(/Blogs/);
    expect(shouldUseGinaSearchSequence("count_categories")).toBe(true);
    expect(buildGinaSearchSequence("es").preludeMessage).toMatch(/dame un momento/i);

    const chips = buildGinaReplyChips({
      family: "count_categories",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => /Categoría Blogs/i.test(c.label))).toBe(true);
    expect(chips.some((c) => /Folders en Marketing/i.test(c.label))).toBe(true);
  });

  it("empty categories in Sales is honest", () => {
    const routed = runGinaQueryFamily(
      "Cuántas categorías tenemos en Sales?",
      ctx,
    );
    expect(routed.family).toBe("count_categories");
    expect(routed.toolContext.count).toBe(0);
    expect(routed.toolContext.empty).toBe(true);
    const viz = buildGinaVisualization("count_categories", routed.toolContext, {
      locale: "es",
    });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Sales/);
    expect(msg).toMatch(/cero/i);
  });
});
