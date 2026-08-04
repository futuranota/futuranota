import { describe, expect, it, beforeEach } from "vitest";
import {
  buildGinaDailyReport,
  buildDailyReportOfferText,
  buildDailyReportChips,
} from "./ginaDailyReport.js";
import {
  clearDailyReport,
  deferDailyReport,
  getPendingDailyReport,
  markDailyReportOpened,
  promoteDailyReportOnSessionEntry,
  queueDailyReportNudge,
  shouldShowDailyReportPopover,
} from "./ginaDailyReportStore.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { isGinaDailyReportUtterance, runGinaQueryFamily } from "./ginaQueryFamily.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

const now = new Date("2026-08-01T12:00:00");

const baseCtx = {
  objectId: "co1",
  userId: "u1",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "blogs", description: "" }],
    },
  ],
  docs: {
    f1: {
      id: "f1",
      title: "Snapchat",
      parentObjectId: "co1",
      departmentId: "dept_m",
      category: "blogs",
      scheduleStartAt: "2026-08-01",
      scheduleFinishAt: "2026-08-07",
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Early block",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T08:00:00",
      anchorFinishAt: "2026-08-01T10:00:00",
      status: "not_started",
    },
    n2: {
      id: "n2",
      title: "Overlap block",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T09:00:00",
      anchorFinishAt: "2026-08-01T11:00:00",
      status: "not_started",
    },
    n3: {
      id: "n3",
      title: "Free later",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T14:00:00",
      anchorFinishAt: "2026-08-01T15:00:00",
      status: "not_started",
    },
  },
};

describe("buildGinaDailyReport", () => {
  it("lists occupied hours and flags overlapping docs", () => {
    const report = buildGinaDailyReport(baseCtx);
    expect(report.occupiedCount).toBe(3);
    expect(report.hasConflicts).toBe(true);
    expect(report.conflictCount).toBeGreaterThanOrEqual(1);
    expect(report.isEmpty).toBe(false);
    expect(report.pendingCount).toBe(3);
    expect(report.folderProgress.some((f) => f.folder === "Snapchat")).toBe(true);
    const overlap = report.occupiedHours.find((r) => r.id === "n2");
    const free = report.occupiedHours.find((r) => r.id === "n3");
    expect(overlap?.hasConflict).toBe(true);
    expect(overlap?.conflictGroupId).toBeTruthy();
    expect(free?.hasConflict).toBe(false);
    expect(report.proposals.length).toBeGreaterThanOrEqual(1);
    expect(report.proposals[0].id).toBe("n2");
  });

  it("marks completed and past blocks as struck", () => {
    const ctx = {
      ...baseCtx,
      nodes: {
        ...baseCtx.nodes,
        n3: { ...baseCtx.nodes.n3, status: "completed" },
      },
    };
    const report = buildGinaDailyReport(ctx);
    expect(report.occupiedHours.find((r) => r.id === "n1")?.struck).toBe(true);
    expect(report.occupiedHours.find((r) => r.id === "n3")?.struck).toBe(true);
  });

  it("empty corpus isEmpty with no collision copy", () => {
    const emptyCtx = {
      ...baseCtx,
      nodes: {},
    };
    const report = buildGinaDailyReport(emptyCtx);
    expect(report.isEmpty).toBe(true);
    expect(report.occupiedCount).toBe(0);
    expect(report.hasConflicts).toBe(false);
    const text = buildDailyReportOfferText({
      isEmpty: true,
      conflictCount: 0,
      locale: "es",
    });
    expect(text).toContain("no hay movimiento");
    expect(text.toLowerCase()).not.toContain("colision");
    expect(text.toLowerCase()).not.toContain("chocan");
    expect(buildGinaVisualization("daily_report", { dailyReport: report }, { locale: "es", now })).toBeNull();
  });

  it("calm copy never mentions collisions", () => {
    const text = buildDailyReportOfferText({
      locale: "es",
      occupiedCount: 2,
      struckCount: 1,
      pendingCount: 1,
      folderProgress: [{ folder: "Snapchat", percent: 50 }],
      conflictCount: 0,
      hasDetails: true,
    });
    expect(text.toLowerCase()).not.toContain("chocan");
    expect(text.toLowerCase()).not.toContain("colision");
    expect(text).toContain("Resumen de hoy");
    expect(text).toContain("Snapchat");
    expect(text).toContain("50%");
    expect(text).toContain("Revisa los detalles");
  });

  it("groups folders that share the same percent", () => {
    const text = buildDailyReportOfferText({
      locale: "es",
      occupiedCount: 4,
      struckCount: 2,
      pendingCount: 2,
      folderProgress: [
        { folder: "Plan de negocio", percent: 0 },
        { folder: "Trends", percent: 0 },
        { folder: "Youtube", percent: 0 },
      ],
      hasRoomToday: true,
      lastFinishAt: "2026-08-01T18:00:00",
      conflictCount: 0,
      hasDetails: true,
    });
    expect(text).toContain("Los proyectos asociados (Plan de negocio, Trends, Youtube) registran 0% de avance");
    expect(text).toMatch(/después de las .*PM/i);
    expect(text).toContain("Revisa los detalles a continuación");
    expect(text.toLowerCase()).not.toContain("colision");
  });

  it("dayComplete when all today docs are closed", () => {
    const ctx = {
      ...baseCtx,
      nodes: {
        n1: { ...baseCtx.nodes.n1, status: "completed", anchorAt: "2026-08-01T08:00:00", anchorFinishAt: "2026-08-01T09:00:00" },
        n2: { ...baseCtx.nodes.n2, status: "completed", anchorAt: "2026-08-01T10:00:00", anchorFinishAt: "2026-08-01T11:00:00" },
      },
    };
    const report = buildGinaDailyReport(ctx);
    expect(report.dayComplete).toBe(true);
    expect(report.pendingCount).toBe(0);
    expect(report.hasConflicts).toBe(false);
    const text = buildDailyReportOfferText({
      locale: "es",
      dayComplete: true,
      conflictCount: 0,
      occupiedCount: 2,
    });
    expect(text.toLowerCase()).toMatch(/completaste|excelente/);
  });

  it("builds conflict offer when collisions exist", () => {
    const text = buildDailyReportOfferText({ conflictCount: 2, locale: "es" });
    expect(text.toLowerCase()).toContain("colision");
    expect(text.toLowerCase()).not.toContain("me di cuenta");
  });

  it("empty chips point to today funnel", () => {
    const chips = buildDailyReportChips({ isEmpty: true, locale: "es" });
    expect(chips[0]?.id).toBe("what_today");
  });
});

describe("ginaDailyReportStore", () => {
  beforeEach(() => {
    memory.clear();
    clearDailyReport("u1");
  });

  it("queues nudge and shows after readyAt; no re-queue after done", () => {
    const t0 = new Date("2026-08-01T10:00:00");
    queueDailyReportNudge("u1", {
      conflictCount: 2,
      occupiedCount: 3,
      now: t0,
      delayMs: 30 * 60 * 1000,
    });
    let pending = getPendingDailyReport("u1", t0);
    expect(pending?.status).toBe("queued");
    expect(pending?.kind).toBe("conflict");
    expect(shouldShowDailyReportPopover("u1", { now: t0 })).toBe(false);

    const later = new Date(t0.getTime() + 31 * 60 * 1000);
    promoteDailyReportOnSessionEntry("u1", later);
    expect(shouldShowDailyReportPopover("u1", { now: later, sessionEntry: true })).toBe(true);

    markDailyReportOpened("u1", later);
    expect(getPendingDailyReport("u1", later)?.status).toBe("done");
    queueDailyReportNudge("u1", { conflictCount: 1, now: later });
    expect(getPendingDailyReport("u1", later)?.status).toBe("done");
  });

  it("queues celebrate kind immediately", () => {
    const t0 = new Date("2026-08-01T17:00:00");
    queueDailyReportNudge("u1", {
      kind: "celebrate",
      occupiedCount: 2,
      now: t0,
      delayMs: 0,
    });
    const pending = getPendingDailyReport("u1", t0);
    expect(pending?.kind).toBe("celebrate");
    expect(shouldShowDailyReportPopover("u1", { now: t0 })).toBe(true);
  });

  it("defer keeps recoverable status and hides popover", () => {
    const t0 = new Date("2026-08-01T10:00:00");
    queueDailyReportNudge("u1", { conflictCount: 1, now: t0, delayMs: 0 });
    promoteDailyReportOnSessionEntry("u1", t0);
    deferDailyReport("u1", t0);
    expect(getPendingDailyReport("u1", t0)?.status).toBe("deferred");
    expect(shouldShowDailyReportPopover("u1", { now: t0 })).toBe(false);
  });
});

describe("daily report routing + viz", () => {
  beforeEach(() => {
    memory.clear();
    clearDailyReport("u1");
  });

  it("routes reporte del día and pending phrases", () => {
    const a = runGinaQueryFamily("reporte del día", baseCtx);
    expect(a.family).toBe("daily_report");
    expect(a.toolContext?.dailyReport?.occupiedCount).toBe(3);

    clearDailyReport("u1");
    deferDailyReport("u1", now);
    const b = runGinaQueryFamily("qué querías decirme", baseCtx);
    expect(b.family).toBe("daily_report");

    clearDailyReport("u1");
    deferDailyReport("u1", now);
    const c = runGinaQueryFamily("hola", baseCtx);
    expect(c.family).toBe("daily_report");
  });

  it("matches broad daily-report triggers", () => {
    const samples = [
      "reporte",
      "Gina dame el reporte",
      "dame el reporte del día",
      "cómo vamos hoy",
      "resumen de hoy",
      "agenda de hoy",
      "mi día",
      "balance del día",
      "muéstrame el reporte de hoy",
      "daily report",
    ];
    for (const sample of samples) {
      expect(isGinaDailyReportUtterance(sample), sample).toBe(true);
      expect(runGinaQueryFamily(sample, baseCtx).family, sample).toBe("daily_report");
    }
  });

  it("routes move preview and confirm families", () => {
    const move = runGinaQueryFamily("Mover horarios en conflicto de hoy", baseCtx);
    expect(move.family).toBe("daily_report_move");
    expect(move.toolContext?.proposals?.length).toBeGreaterThanOrEqual(1);

    const confirm = runGinaQueryFamily("Confirmar mover horarios en conflicto", baseCtx);
    expect(confirm.family).toBe("daily_report_move_confirm");
  });

  it("viz includes conflict highlight flags and pending/progress", () => {
    const report = buildGinaDailyReport(baseCtx);
    const viz = buildGinaVisualization("daily_report", { dailyReport: report }, { locale: "es", now });
    expect(viz?.type).toBe("daily_report");
    expect(viz?.data?.hasConflictHighlight).toBe(true);
    expect(viz?.data?.occupiedHours?.some((r) => r.conflictGroupId)).toBe(true);
    expect(viz?.data?.pendingBrief?.length).toBeGreaterThan(0);
    expect(viz?.data?.folderProgress?.length).toBeGreaterThan(0);
  });
});
