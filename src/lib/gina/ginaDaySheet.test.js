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
  patchDaySheetVisualizationCompletion,
  pickNextDaySheetDoc,
  summarizeDaySheetProgress,
  togglePendingDaySheetSelection,
  clearPendingDaySheetSelection,
  applyDaySheetCompletionBatch,
  buildDaySheetBatchCompleteAck,
  buildDaySheetPendingActionChips,
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

  it("patches day sheet viz completion and recounts progress", () => {
    const viz = {
      type: "schedule_sheet",
      data: {
        isDaySheet: true,
        compact: true,
        documents: [
          { id: "1", title: "One", status: "not_started", completed: false },
          { id: "2", title: "Two", status: "in_progress", completed: false },
        ],
        groups: [
          {
            department: "Marketing",
            folders: [
              {
                folder: "Blogs",
                documents: [
                  { id: "1", title: "One", status: "not_started" },
                  { id: "2", title: "Two", status: "in_progress" },
                ],
              },
            ],
          },
        ],
        progress: { total: 2, completed: 0, remaining: 2 },
        nextDocumentId: "1",
      },
    };
    const done = patchDaySheetVisualizationCompletion(viz, "1", true);
    expect(done.data.documents[0].status).toBe("completed");
    expect(done.data.documents[0].struck).toBe(true);
    expect(done.data.groups[0].folders[0].documents[0].status).toBe("completed");
    expect(done.data.progress).toEqual({ total: 2, completed: 1, remaining: 1 });
    expect(done.data.nextDocumentId).toBe("2");

    const undone = patchDaySheetVisualizationCompletion(done, "1", false);
    expect(undone.data.documents[0].status).toBe("not_started");
    expect(undone.data.documents[0].struck).toBe(false);
    expect(undone.data.progress).toEqual({ total: 2, completed: 0, remaining: 2 });
    expect(undone.data.nextDocumentId).toBe("1");
  });

  it("toggles pending selection without mutating status", () => {
    const viz = {
      type: "schedule_sheet",
      data: {
        isDaySheet: true,
        documents: [
          { id: "1", title: "One", status: "not_started" },
          { id: "2", title: "Two", status: "in_progress" },
          { id: "3", title: "Done", status: "completed", completed: true },
        ],
        pendingSelectedIds: [],
      },
    };
    const selected = togglePendingDaySheetSelection(viz, "1", true);
    expect(selected.data.pendingSelectedIds).toEqual(["1"]);
    expect(selected.data.documents[0].status).toBe("not_started");

    const both = togglePendingDaySheetSelection(selected, "2", true);
    expect(both.data.pendingSelectedIds).toEqual(["1", "2"]);

    const locked = togglePendingDaySheetSelection(both, "3", true);
    expect(locked.data.pendingSelectedIds).toEqual(["1", "2"]);

    const cleared = clearPendingDaySheetSelection(both);
    expect(cleared.data.pendingSelectedIds).toEqual([]);
    expect(cleared.data.documents[0].status).toBe("not_started");
  });

  it("applies batch completion and builds ack with next pending", () => {
    const viz = {
      type: "schedule_sheet",
      data: {
        isDaySheet: true,
        documents: [
          { id: "1", title: "One", status: "not_started" },
          { id: "2", title: "Two", status: "in_progress" },
          { id: "3", title: "Three", status: "not_started" },
        ],
        pendingSelectedIds: ["1", "2"],
        progress: { total: 3, completed: 0, remaining: 3 },
      },
    };
    const applied = applyDaySheetCompletionBatch(viz, ["1", "2"]);
    expect(applied.data.documents[0].status).toBe("completed");
    expect(applied.data.documents[1].status).toBe("completed");
    expect(applied.data.documents[2].status).toBe("not_started");
    expect(applied.data.pendingSelectedIds).toEqual([]);
    expect(applied.data.progress).toEqual({ total: 3, completed: 2, remaining: 1 });
    expect(applied.data.nextDocumentId).toBe("3");

    const ack = buildDaySheetBatchCompleteAck({
      count: 2,
      nextTitle: "Three",
      locale: "es",
    });
    expect(ack).toMatch(/¡Listo! Tachamos \*\*2\*\* Documentos/);
    expect(ack).toMatch(/Aún tienes pendiente \*\*Three\*\*/);
    expect(ack).toMatch(/seguir avanzando/);

    const singular = buildDaySheetBatchCompleteAck({
      count: 1,
      nextTitle: "Three",
      locale: "es",
    });
    expect(singular).toMatch(/Tachamos \*\*1\*\* Documento\./);

    const empty = buildDaySheetBatchCompleteAck({ count: 2, nextTitle: "", locale: "es" });
    expect(empty).toMatch(/No queda nada pendiente/);

    const chips = buildDaySheetPendingActionChips({ locale: "es" });
    expect(chips.map((c) => c.id)).toEqual([
      "day_sheet_apply_complete",
      "day_sheet_discard_selection",
    ]);
    expect(chips[0].label).toBe("Marcar como completado");
    expect(chips[1].label).toBe("Descartar");
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

  it("justSaved returns day_sheet_saved viz without table rows", () => {
    const viz = buildGinaVisualization("day_sheet", {
      date: "2026-08-07",
      isDaySheet: true,
      justSaved: true,
      nextDocument: { id: "2", title: "Pending doc" },
      documents: [
        {
          id: "2",
          title: "Pending doc",
          status: "not_started",
          department: "Marketing",
          folder: "Blogs",
          anchorAt: "2026-08-07T14:00:00",
        },
      ],
      progress: { total: 1, completed: 0, remaining: 1 },
    }, { locale: "es", now, userText: "Guardar horario del día" });

    expect(viz?.type).toBe("day_sheet_saved");
    expect(viz?.data?.justSaved).toBe(true);
    expect(viz?.data?.nextDocumentId).toBe("2");
    expect(viz?.data?.documents).toEqual([]);
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
