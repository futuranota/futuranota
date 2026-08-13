/**
 * Ask-then-filter categories on last Gina table (live cats only).
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  liveCategoriesFromTableDocs,
  parseTableCategoryAskIntent,
  parseLiveCategoriesFromReply,
  filterDocsByLiveCategories,
  buildTableCategoryAskMessage,
} from "./ginaTableCategoryAsk.js";
import { clearGinaLastTurn, setGinaLastTurn } from "./ginaLastTurn.js";
import { clearPendingGinaOffer, getPendingGinaOffer } from "./ginaPendingOffer.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { buildCountDocumentsChips } from "./ginaReplyChips.js";
import { buildGinaTableSchemaFromVisualization } from "./ginaTableColumnRefine.js";

const NOW = new Date(2026, 7, 12, 12, 0, 0);

describe("ginaTableCategoryAsk helpers", () => {
  it("liveCategoriesFromTableDocs skips empty / uncategorized", () => {
    expect(liveCategoriesFromTableDocs([
      { category: "Birthday" },
      { category: "Wedding" },
      { category: "Birthday" },
      { category: "" },
      { category: "uncategorized" },
      { category: "—" },
    ])).toEqual(["Birthday", "Wedding"]);
  });

  it("parse intents", () => {
    expect(parseTableCategoryAskIntent("filtramelo por categorias")).toBe("include");
    expect(parseTableCategoryAskIntent("excluyeme las categorias")).toBe("exclude");
    expect(parseTableCategoryAskIntent("hola")).toBe(null);
  });

  it("parse multi live categories from reply", () => {
    const live = ["Birthday", "Wedding", "Q3 Kickoff"];
    expect(parseLiveCategoriesFromReply("Birthday y Wedding", live)).toEqual(
      expect.arrayContaining(["Birthday", "Wedding"]),
    );
    expect(parseLiveCategoriesFromReply("Birthday, Wedding", live)).toHaveLength(2);
    expect(parseLiveCategoriesFromReply("Blogs", live)).toEqual([]);
  });

  it("include / exclude filters", () => {
    const docs = [
      { id: "1", category: "Birthday" },
      { id: "2", category: "Wedding" },
      { id: "3", category: "Birthday" },
    ];
    expect(filterDocsByLiveCategories(docs, ["Birthday"], "include").map((d) => d.id))
      .toEqual(["1", "3"]);
    expect(filterDocsByLiveCategories(docs, ["Birthday"], "exclude").map((d) => d.id))
      .toEqual(["2"]);
  });

  it("ask message uses user name", () => {
    expect(buildTableCategoryAskMessage({
      locale: "es",
      userName: "Ross Garcia",
      mode: "include",
    })).toBe("Ok Ross, ¿qué categoría te gustaría filtrar?");
    expect(buildTableCategoryAskMessage({
      locale: "es",
      userName: "Ross",
      mode: "exclude",
    })).toMatch(/excluir/);
  });
});

describe("chips + router ask flow", () => {
  beforeEach(() => {
    clearGinaLastTurn();
    clearPendingGinaOffer();
  });

  it("chips show filter/exclude only when table docs have categories", () => {
    const withCats = buildCountDocumentsChips({
      mode: "list_all",
      locale: "es",
      fromCountDocuments: true,
      view: { showSchedule: true, showStatus: true, scheduleScope: "all", layout: "schedules_all" },
      documents: [
        { id: "a", title: "A", category: "Birthday" },
        { id: "b", title: "B", category: "Wedding" },
      ],
    });
    expect(withCats.some((c) => c.id === "ask_filter_categories")).toBe(true);
    expect(withCats.some((c) => c.id === "ask_exclude_categories")).toBe(true);

    const noCats = buildCountDocumentsChips({
      mode: "list_all",
      locale: "es",
      fromCountDocuments: true,
      view: { showSchedule: true, showStatus: true, scheduleScope: "all", layout: "schedules_all" },
      documents: [
        { id: "a", title: "A", category: "" },
        { id: "b", title: "B", category: "uncategorized" },
      ],
    });
    expect(noCats.some((c) => c.id === "ask_filter_categories")).toBe(false);
    expect(noCats.some((c) => c.id === "ask_exclude_categories")).toBe(false);
  });

  it("filtramelo por categorias → ask pending; Birthday → filtered rows", () => {
    const schema = buildGinaTableSchemaFromVisualization({
      type: "table",
      data: {
        fromCountDocuments: true,
        columns: ["document", "category", "time", "status"],
        documents: [
          { id: "b1", title: "Cake", category: "Birthday" },
          { id: "w1", title: "Venue", category: "Wedding" },
        ],
        view: { showSchedule: true, showStatus: true },
      },
    });
    setGinaLastTurn({
      family: "count_documents",
      refKind: "list",
      documents: [{ id: "b1", title: "Cake" }, { id: "w1", title: "Venue" }],
      tableSchema: schema,
      ts: Date.now(),
    });

    const ctx = {
      objectId: "co1",
      corpusName: "Any",
      now: NOW,
      departments: [
        {
          id: "d1",
          objectId: "co1",
          category: "Personal",
          subcategories: [
            { label: "Birthday", description: "" },
            { label: "Wedding", description: "" },
          ],
        },
      ],
      docs: {
        f1: { id: "f1", title: "P1", parentObjectId: "co1", departmentId: "d1", category: "Birthday" },
        f2: { id: "f2", title: "P2", parentObjectId: "co1", departmentId: "d1", category: "Wedding" },
      },
      nodes: {
        b1: {
          id: "b1",
          title: "Cake",
          parentDocId: "f1",
          objectId: "co1",
          status: "not_started",
          anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
        },
        w1: {
          id: "w1",
          title: "Venue",
          parentDocId: "f2",
          objectId: "co1",
          status: "completed",
          anchorAt: new Date(2026, 7, 14, 11, 0, 0).toISOString(),
        },
      },
    };

    const ask = runGinaQueryFamily("filtramelo por categorias", ctx);
    expect(ask.family).toBe("table_category_ask");
    expect(ask.toolContext.mode).toBe("include");
    expect(ask.toolContext.liveCategories).toEqual(
      expect.arrayContaining(["Birthday", "Wedding"]),
    );
    expect(getPendingGinaOffer()?.type).toBe("ask_table_category_filter");

    const filtered = runGinaQueryFamily("Birthday", ctx);
    expect(filtered.family).toBe("count_documents");
    expect(filtered.toolContext.fromLastTurnTableRefine).toBe(true);
    expect(filtered.toolContext.tableCategoryFilter?.mode).toBe("include");
    expect(filtered.toolContext.documents.map((d) => d.id)).toEqual(["b1"]);
    expect(getPendingGinaOffer()).toBe(null);
  });

  it("excluyeme → Birthday leaves Wedding", () => {
    const schema = buildGinaTableSchemaFromVisualization({
      type: "table",
      data: {
        fromCountDocuments: true,
        columns: ["document", "category", "time", "status"],
        documents: [
          { id: "b1", title: "Cake", category: "Birthday" },
          { id: "w1", title: "Venue", category: "Wedding" },
        ],
        view: { showSchedule: true, showStatus: true },
      },
    });
    setGinaLastTurn({
      family: "count_documents",
      refKind: "list",
      documents: [{ id: "b1", title: "Cake" }, { id: "w1", title: "Venue" }],
      tableSchema: schema,
      ts: Date.now(),
    });

    const ctx = {
      objectId: "co1",
      corpusName: "Any",
      now: NOW,
      departments: [
        {
          id: "d1",
          objectId: "co1",
          category: "Personal",
          subcategories: [
            { label: "Birthday", description: "" },
            { label: "Wedding", description: "" },
          ],
        },
      ],
      docs: {
        f1: { id: "f1", title: "P1", parentObjectId: "co1", departmentId: "d1", category: "Birthday" },
        f2: { id: "f2", title: "P2", parentObjectId: "co1", departmentId: "d1", category: "Wedding" },
      },
      nodes: {
        b1: {
          id: "b1",
          title: "Cake",
          parentDocId: "f1",
          objectId: "co1",
          status: "not_started",
          anchorAt: new Date(2026, 7, 12, 9, 0, 0).toISOString(),
        },
        w1: {
          id: "w1",
          title: "Venue",
          parentDocId: "f2",
          objectId: "co1",
          status: "completed",
          anchorAt: new Date(2026, 7, 14, 11, 0, 0).toISOString(),
        },
      },
    };

    expect(runGinaQueryFamily("excluyeme las categorias", ctx).family).toBe("table_category_ask");
    const out = runGinaQueryFamily("Birthday", ctx);
    expect(out.toolContext.tableCategoryFilter?.mode).toBe("exclude");
    expect(out.toolContext.documents.map((d) => d.id)).toEqual(["w1"]);
  });
});
