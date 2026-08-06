import { describe, expect, it } from "vitest";
import {
  isFindDocumentIntent,
  parseFindHints,
  searchDocumentsByHints,
  buildFindDocumentMessage,
  buildFindDocumentChips,
  extractTitlePrefix,
  editDistance,
} from "./ginaFindDocument.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { buildGinaFunnelHeadline, buildGinaReplyChips } from "./ginaReplyChips.js";

const now = new Date("2026-08-01T12:00:00");

const ctx = {
  objectId: "co1",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "blogs", description: "" }, { label: "Trends", description: "" }],
    },
    {
      id: "dept_yt",
      objectId: "co1",
      category: "Department",
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
    f2: {
      id: "f2",
      title: "Youtube",
      parentObjectId: "co1",
      departmentId: "dept_yt",
      category: "uncategorized",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Cómo iniciar un canal de YouTube",
      parentDocId: "f1",
      objectId: "co1",
      content: {
        blocks: [
          { type: "text", text: "Guía corta en español sobre canales." },
        ],
      },
      status: "in_progress",
    },
    n2: {
      id: "n2",
      title: "How to start a million subs channel",
      parentDocId: "f2",
      objectId: "co1",
      content: {
        blocks: [
          { type: "text", text: "English guide for growing a YouTube channel." },
        ],
      },
      status: "not_started",
    },
  },
};

describe("ginaFindDocument", () => {
  it("detects encuentrame / find intent", () => {
    expect(isFindDocumentIntent("encuentra un documento sobre horarios")).toBe(true);
    expect(isFindDocumentIntent("Encuentrame un documento que empiece How to start")).toBe(true);
    expect(isFindDocumentIntent("encuentramelo por favor")).toBe(true);
    expect(isFindDocumentIntent("horarios de hoy")).toBe(false);
  });

  it("extracts title prefix and fuzzy typo chanel→channel", () => {
    expect(extractTitlePrefix("Encuentrame un documento que empiece How to start a chanel o algo similar")).toBe(
      "How to start a chanel",
    );
    expect(editDistance("chanel", "channel")).toBe(1);
  });

  it("prefers English starts-with title over unrelated Spanish guide", () => {
    const text = "Encuentrame un documento que empiece How to start a chanel o algo similar Gina.";
    const routed = runGinaQueryFamily(text, ctx);
    expect(routed.family).toBe("find_document");
    expect(routed.toolContext.empty).toBe(false);
    expect(routed.toolContext.results[0].id).toBe("n2");
    expect(routed.toolContext.results[0].title).toMatch(/million subs channel/i);
    const viz = buildGinaVisualization("find_document", routed.toolContext, { locale: "es" });
    const msg = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(msg).toMatch(/Encontré/);
    expect(msg).not.toMatch(/Marketing/);
    expect(msg).toMatch(/How to start a million|Youtube|Department|uncategorized|sin categor/i);
  });

  it("returns honest empty when nothing matches", () => {
    const hints = parseFindHints(ctx, "Busca un documento sobre unicornios espaciales");
    const found = searchDocumentsByHints(ctx, hints);
    expect(found.empty).toBe(true);
    expect(buildFindDocumentMessage({ ...found, locale: "es" })).toMatch(/no encontré|No voy a inventar/i);
  });

  it("can scope uncategorized + Youtube folder", () => {
    const hints = parseFindHints(ctx, "Busca en Youtube uncategorized how to start channel");
    expect(hints.folderName).toBe("Youtube");
    const found = searchDocumentsByHints(ctx, hints);
    expect(found.results.some((r) => r.id === "n2")).toBe(true);
  });

  it("finds by topic in body within marketing department", () => {
    const routed = runGinaQueryFamily(
      "Encuentra un documento de Marketing que habla sobre canales",
      ctx,
    );
    expect(routed.family).toBe("find_document");
    expect(routed.toolContext.empty).toBe(false);
    expect(routed.toolContext.results[0].id).toBe("n1");
    expect(routed.toolContext.results[0].folderId || routed.toolContext.results[0].departmentId).toBeTruthy();
    const viz = buildGinaVisualization("find_document", routed.toolContext, { locale: "es" });
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.some((c) => c.id.startsWith("open_") || c.id.startsWith("reveal_"))).toBe(true);
  });

  it("find chips open/reveal by document id", () => {
    const chips = buildFindDocumentChips({
      locale: "es",
      results: [{
        id: "n2",
        title: "How to start a million subs channel",
        department: "Department",
        folder: "Youtube",
      }],
    });
    expect(chips.some((c) => c.text === "GinaRevealDocument:n2")).toBe(true);
    expect(chips.some((c) => c.text === "GinaOpenDocument:n2")).toBe(true);
    expect(chips.every((c) => !/^Abre /.test(c.text || ""))).toBe(true);
  });
});
