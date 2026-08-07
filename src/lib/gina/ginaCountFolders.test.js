import { describe, expect, it, beforeEach } from "vitest";
import {
  runGinaQueryFamily,
  wantsCountFolders,
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
      title: "Trends",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Blogs",
    },
    f2: {
      id: "f2",
      title: "Campaign Q3",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "Blogs",
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

describe("Gina count_folders", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
  });

  it("detects cuantos folders intent", () => {
    expect(wantsCountFolders("Cuántos folders tenemos en Marketing?")).toBe(true);
    expect(wantsCountFolders("Cuántos departamentos tenemos")).toBe(false);
  });

  it("counts folders in Marketing", () => {
    const routed = runGinaQueryFamily("Cuántos folders tenemos en Marketing?", ctx);
    expect(routed.family).toBe("count_folders");
    expect(routed.toolContext.department).toBe("Marketing");
    expect(routed.toolContext.count).toBe(2);
    expect(routed.toolContext.empty).toBe(false);

    const viz = buildGinaVisualization("count_folders", routed.toolContext, { locale: "es" });
    expect(viz?.type).toBe("folder_list");
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Marketing/);
    expect(msg).toMatch(/2/);
    expect(msg).toMatch(/Trends/);
    expect(shouldUseGinaSearchSequence("count_folders")).toBe(true);
    expect(buildGinaSearchSequence("es", { salt: 3 }).preludeMessage).toMatch(/dame un momento/i);
  });

  it("Enfocarme hoy en Sales with zero folders guides to create a folder", () => {
    const routed = runGinaQueryFamily("Enfocarme hoy en Sales", ctx);
    expect(routed.family).toBe("count_folders");
    expect(routed.toolContext.department).toBe("Sales");
    expect(routed.toolContext.count).toBe(0);
    expect(routed.toolContext.empty).toBe(true);
    expect(routed.toolContext.fromFocus).toBe(true);

    const viz = buildGinaVisualization("count_folders", routed.toolContext, { locale: "es" });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Sales/);
    expect(msg).toMatch(/cero/i);
    expect(msg).toMatch(/folder/i);
    expect(msg).toMatch(/programar citas/i);

    const chips = buildGinaReplyChips({
      family: "count_folders",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => /Volver a departamentos/i.test(c.label))).toBe(true);
  });

  it("Enfocarme hoy en Marketing with folders stays on today scope", () => {
    const routed = runGinaQueryFamily("Enfocarme hoy en Marketing", ctx);
    expect(routed.family).toBe("today");
    expect(routed.toolContext.filters?.department).toBe("Marketing");
    expect(shouldUseGinaSearchSequence("today", routed.toolContext)).toBe(true);
  });
});
