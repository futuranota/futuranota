import { describe, expect, it, beforeEach } from "vitest";
import {
  runGinaQueryFamily,
  wantsFolderDocsList,
  isGinaAffirmationUtterance,
} from "./ginaQueryFamily.js";
import { matchLiveFoldersByNeedle } from "./ginaTools.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { buildGinaFunnelHeadline } from "./ginaReplyChips.js";
import {
  clearPendingGinaOffer,
  getPendingGinaOffer,
  setPendingGinaOffer,
} from "./ginaPendingOffer.js";

const now = new Date("2026-08-01T12:00:00");

const ctx = {
  objectId: "co1",
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
    n2: {
      id: "n2",
      title: "Proyección financiera",
      parentDocId: "f1",
      objectId: "co1",
      status: "in_progress",
    },
  },
};

describe("Gina folder-first docs list", () => {
  beforeEach(() => {
    clearPendingGinaOffer();
  });

  it("detects folder docs list intent", () => {
    expect(wantsFolderDocsList("Dame todos los documentos del plan de negocio")).toBe(true);
    expect(wantsFolderDocsList("qué tenemos para hoy")).toBe(false);
  });

  it("fuzzy matches plan de negocio folder", () => {
    const hits = matchLiveFoldersByNeedle(ctx, "plann d negocio", { limit: 3 });
    expect(hits[0]?.name).toMatch(/plan de negocio/i);
  });

  it("lists docs of Plan de Negocio without inventing Planificación", () => {
    const routed = runGinaQueryFamily(
      "Dame todos los documentos del plan de negocio?",
      ctx,
    );
    expect(routed.family).toBe("folder_summary");
    expect(routed.family).not.toBe("free_chat");
    expect(routed.toolContext.folderName).toMatch(/plan de negocio/i);
    expect(routed.toolContext.departmentName).toBe("Estrategias de negocios");
    expect(routed.toolContext.departmentName).not.toMatch(/planific/i);
    expect(routed.toolContext.documents?.length).toBe(2);
    expect(getPendingGinaOffer()?.type).toBe("list_folder");

    const viz = buildGinaVisualization("folder_summary", routed.toolContext, {
      locale: "es",
      userText: "Dame todos los documentos del plan de negocio?",
    });
    expect(viz?.type).toBe("table");
    expect(viz?.data?.empty).toBe(false);
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Estrategias de negocios|plan de negocio/i);
    expect(msg).not.toMatch(/Planificaci[oó]n/i);
    expect(msg).not.toMatch(/quieres que te muestre/i);
  });

  it("sí with pending list_folder re-runs the folder list", () => {
    setPendingGinaOffer({ type: "list_folder", folderId: "f1" });
    expect(isGinaAffirmationUtterance("si")).toBe(true);
    const routed = runGinaQueryFamily("si", ctx);
    expect(routed.family).toBe("folder_summary");
    expect(routed.toolContext.documents?.length).toBe(2);
    expect(getPendingGinaOffer()).toBeNull();
  });

  it("unknown folder stays honest empty", () => {
    const routed = runGinaQueryFamily(
      "Dame todos los documentos del unicornio espacial",
      ctx,
    );
    expect(routed.family).toBe("folder_summary");
    expect(routed.toolContext.empty || routed.toolContext.notFound).toBe(true);
    const viz = buildGinaVisualization("folder_summary", routed.toolContext, {
      locale: "es",
      userText: "Dame todos los documentos del unicornio espacial",
    });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/no encontré|won't invent|no voy a inventar/i);
  });
});
