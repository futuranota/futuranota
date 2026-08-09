import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearDaySheet,
  getDaySheet,
  hasDaySheet,
  writeDaySheet,
} from "./ginaDaySheetStore.js";
import {
  matchDocInDaySheet,
  orderDocsByDaySheetIds,
  pickNextDaySheetDoc,
  summarizeDaySheetProgress,
} from "./ginaDaySheet.js";
import {
  isDaySheetReopenIntent,
  isDaySheetSaveIntent,
  isDaySheetNextIntent,
  isDaySheetCompleteConfirmIntent,
  parseDaySheetCompleteIntent,
} from "./ginaSyntaxDaySheet.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("ginaDaySheetStore", () => {
  const uid = "test-day-sheet-user";
  const now = new Date("2026-08-07T15:00:00");

  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("anchors doc ids for the calendar day", () => {
    const sheet = writeDaySheet(uid, {
      docIds: ["a", "b", "a", ""],
      now,
      source: "schedule_sheet",
    });
    expect(sheet?.docIds).toEqual(["a", "b"]);
    expect(hasDaySheet(uid, now)).toBe(true);
    expect(getDaySheet(uid, now)?.docIds).toEqual(["a", "b"]);
  });

  it("expires on another calendar day", () => {
    writeDaySheet(uid, { docIds: ["a"], now });
    expect(getDaySheet(uid, new Date("2026-08-08T10:00:00"))).toBeNull();
  });
});

describe("ginaDaySheet helpers", () => {
  it("orders live docs by anchored ids and skips missing", () => {
    const ordered = orderDocsByDaySheetIds(
      [
        { id: "b", title: "B", status: "completed" },
        { id: "a", title: "A", status: "not_started" },
        { id: "c", title: "C" },
      ],
      ["a", "missing", "b"],
    );
    expect(ordered.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("picks next non-completed and summarizes progress", () => {
    const docs = [
      { id: "1", title: "One", status: "completed" },
      { id: "2", title: "Two", status: "in_progress" },
      { id: "3", title: "Three", status: "not_started" },
    ];
    expect(pickNextDaySheetDoc(docs)?.id).toBe("2");
    expect(summarizeDaySheetProgress(docs)).toEqual({
      total: 3,
      completed: 1,
      remaining: 2,
    });
  });

  it("matches title within sheet", () => {
    const docs = [
      { id: "1", title: "Investigacion negocios", status: "not_started" },
      { id: "2", title: "Blog trends", status: "not_started" },
    ];
    expect(matchDocInDaySheet(docs, "negocios").doc?.id).toBe("1");
    expect(matchDocInDaySheet(docs, null).ambiguous.length).toBe(2);
  });
});

describe("ginaSyntaxDaySheet", () => {
  it("matches reopen / save / next / complete variants", () => {
    expect(isDaySheetReopenIntent("Sheet del día")).toBe(true);
    expect(isDaySheetReopenIntent("Horario del día")).toBe(true);
    expect(isDaySheetReopenIntent("abre el sheet del dia")).toBe(true);
    expect(isDaySheetReopenIntent("tabla de referencia del día")).toBe(true);
    expect(isDaySheetSaveIntent("Guardar esta tabla de referencia del día")).toBe(true);
    expect(isDaySheetSaveIntent("save this day reference sheet")).toBe(true);
    expect(isDaySheetNextIntent("qué sigue")).toBe(true);
    expect(isDaySheetNextIntent("quiero ir al siguiente")).toBe(true);
    expect(isDaySheetCompleteConfirmIntent("Confirmar marcar como completed")).toBe(true);
    expect(parseDaySheetCompleteIntent("Ya terminé").match).toBe(true);
    expect(parseDaySheetCompleteIntent("Ya terminé Investigacion").titleHint).toMatch(/Investigacion/i);
  });
});

describe("day sheet visualization + family", () => {
  const now = new Date("2026-08-07T15:00:00");
  const uid = "test-day-sheet-route";

  beforeEach(() => {
    clearDaySheet(uid);
  });

  afterEach(() => {
    clearDaySheet(uid);
  });

  it("builds schedule_sheet with struck completed rows", () => {
    const viz = buildGinaVisualization("day_sheet", {
      date: "2026-08-07",
      isDaySheet: true,
      documents: [
        {
          id: "1",
          title: "Done doc",
          status: "completed",
          department: "Marketing",
          folder: "Blogs",
          anchorAt: "2026-08-07T10:00:00",
        },
        {
          id: "2",
          title: "Pending doc",
          status: "not_started",
          department: "Marketing",
          folder: "Blogs",
          anchorAt: "2026-08-07T14:00:00",
        },
      ],
      progress: { total: 2, completed: 1, remaining: 1 },
    }, { locale: "es", now, userText: "Sheet del día" });

    expect(viz?.type).toBe("schedule_sheet");
    expect(viz?.data?.isDaySheet).toBe(true);
    const rows = viz.data.documents;
    expect(rows.find((r) => r.id === "1")?.struck).toBe(true);
    expect(rows.find((r) => r.id === "2")?.struck).toBeFalsy();
  });

  it("routes reopen when anchored", () => {
    writeDaySheet(uid, {
      docIds: ["n1"],
      now,
    });
    const routed = runGinaQueryFamily("Sheet del día", {
      userId: uid,
      now,
      objectId: "co1",
      docs: {
        f1: {
          id: "f1",
          title: "Folder",
          parentObjectId: "co1",
          departmentId: "d1",
          category: "blogs",
        },
      },
      nodes: {
        n1: {
          id: "n1",
          title: "Doc A",
          parentDocId: "f1",
          anchorAt: "2026-08-07T12:00:00",
          anchorFinishAt: "2026-08-07T13:00:00",
          status: "not_started",
        },
      },
      departments: [{ id: "d1", objectId: "co1", category: "Marketing" }],
    });
    expect(routed.family).toBe("day_sheet");
    expect(routed.toolContext?.isDaySheet).toBe(true);
    expect(routed.toolContext?.documents?.some((d) => d.id === "n1")).toBe(true);
  });

  it("routes missing anchor", () => {
    const routed = runGinaQueryFamily("Sheet del día", {
      userId: uid,
      now,
      docs: {},
      nodes: {},
      departments: [],
    });
    expect(routed.family).toBe("day_sheet");
    expect(routed.toolContext?.missingAnchor).toBe(true);
  });
});
