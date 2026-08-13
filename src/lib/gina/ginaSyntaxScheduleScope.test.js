import { describe, expect, it } from "vitest";
import {
  filterDocsByScheduleScope,
  parseGinaScheduleScope,
  parseGinaWeekViewMode,
  wantsGinaScheduleScopeList,
  buildGinaWeekFolderOpenAction,
  GINA_SCHEDULE_SCOPE_CHIPS_ES,
} from "./ginaSyntaxScheduleScope.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { buildGinaFunnelHeadline, buildGinaReplyChips } from "./ginaReplyChips.js";
import { clearGinaLastTurn, setGinaLastTurn } from "./ginaLastTurn.js";

const now = new Date("2026-08-07T15:00:00"); // Friday

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
      title: "Calls",
      parentObjectId: "co1",
      departmentId: "dept_s",
      category: null,
    },
  },
  nodes: {
    n1: {
      id: "n1",
      title: "Blog hoy",
      parentDocId: "f1",
      objectId: "co1",
      status: "in_progress",
      anchorAt: "2026-08-07T09:00:00",
      anchorFinishAt: "2026-08-07T10:00:00",
    },
    n2: {
      id: "n2",
      title: "Sales hoy sin cat",
      parentDocId: "f2",
      objectId: "co1",
      status: "not_started",
      anchorAt: "2026-08-07T11:00:00",
      anchorFinishAt: "2026-08-07T12:00:00",
    },
    n3: {
      id: "n3",
      title: "Blog semana",
      parentDocId: "f1",
      objectId: "co1",
      status: "completed",
      completed: true,
      anchorAt: "2026-08-05T09:00:00",
      anchorFinishAt: "2026-08-05T10:00:00",
    },
    n4: {
      id: "n4",
      title: "Viejo",
      parentDocId: "f1",
      objectId: "co1",
      status: "past_due",
      anchorAt: "2026-07-01T09:00:00",
      anchorFinishAt: "2026-07-01T10:00:00",
    },
    n6: {
      id: "n6",
      title: "Past due semana",
      parentDocId: "f1",
      objectId: "co1",
      status: "past_due",
      anchorAt: "2026-08-04T14:00:00",
      anchorFinishAt: "2026-08-04T15:00:00",
    },
    n5: {
      id: "n5",
      title: "Flexible",
      parentDocId: "f1",
      objectId: "co1",
      status: "not_started",
    },
  },
};

describe("ginaSyntaxScheduleScope", () => {
  it("parses the three chip phrases", () => {
    expect(parseGinaScheduleScope("visualizar todos los horarios creados")).toBe("all");
    expect(parseGinaScheduleScope("visualizar todos los horarios de la semana")).toBe("week");
    expect(parseGinaScheduleScope("visualizar todos los horarios de hoy")).toBe("today");
    expect(wantsGinaScheduleScopeList("visualizar todos los horarios de hoy")).toBe(true);
  });

  it("parses tabla / revisar la semana as week scope", () => {
    expect(parseGinaScheduleScope("tabla de la semana")).toBe("week");
    expect(parseGinaScheduleScope("dame la tabla de la semana")).toBe("week");
    expect(parseGinaScheduleScope("Revisar la semana")).toBe("week");
    expect(parseGinaScheduleScope("review the week")).toBe("week");
  });

  it("parses week view modes without stealing week list", () => {
    expect(parseGinaWeekViewMode("visualizar por % completado")).toBe("folder_pct");
    expect(parseGinaWeekViewMode("horarios vencidos de la semana")).toBe("overdue");
    expect(parseGinaWeekViewMode("volver a horarios de la semana")).toBe("schedule");
    expect(wantsGinaScheduleScopeList("visualizar por % completado")).toBe(false);
    expect(wantsGinaScheduleScopeList("horarios vencidos de la semana")).toBe(false);
  });

  it("does not steal classic muéstrame los horarios de hoy", () => {
    expect(parseGinaScheduleScope("Muéstrame los horarios de hoy")).toBe(null);
  });

  it("filterDocsByScheduleScope today / week / all", () => {
    const docs = [
      { title: "hoy", anchorAt: "2026-08-07T09:00:00" },
      { title: "semana", anchorAt: "2026-08-05T09:00:00" },
      { title: "viejo", anchorAt: "2026-07-01T09:00:00" },
    ];
    expect(filterDocsByScheduleScope(docs, "today", now).map((d) => d.title)).toEqual(["hoy"]);
    expect(filterDocsByScheduleScope(docs, "week", now).map((d) => d.title).sort())
      .toEqual(["hoy", "semana"].sort());
    expect(filterDocsByScheduleScope(docs, "all", now)).toHaveLength(3);
  });
});

describe("schedule scope routing → list_all table", () => {
  it.each(GINA_SCHEDULE_SCOPE_CHIPS_ES.map((c) => [c.scope, c.text]))(
    "%s → showSchedule + scheduleScope",
    (scope, text) => {
      const routed = runGinaQueryFamily(text, ctx);
      expect(routed.family).toBe("count_documents");
      expect(routed.toolContext.mode).toBe("list_all");
      expect(routed.toolContext.view.showSchedule).toBe(true);
      expect(routed.toolContext.view.scheduleScope).toBe(scope);
      expect(routed.toolContext.documents.length).toBeGreaterThan(0);
      expect(routed.toolContext.documents.every((d) => d.anchorAt)).toBe(true);

      const viz = buildGinaVisualization("count_documents", routed.toolContext, {
        locale: "es",
        now,
      });
      expect(viz?.type).toBe("table");
      expect(viz.data.view.showSchedule).toBe(true);
      expect(viz.data.columns).toContain("time");
    },
  );

  it("hoy includes docs without category", () => {
    const routed = runGinaQueryFamily("visualizar todos los horarios de hoy", ctx);
    const titles = routed.toolContext.documents.map((d) => d.title);
    expect(titles).toContain("Blog hoy");
    expect(titles).toContain("Sales hoy sin cat");
    expect(titles).not.toContain("Flexible");
    expect(titles).not.toContain("Viejo");
  });

  it("creados includes any timed doc", () => {
    const routed = runGinaQueryFamily("visualizar todos los horarios creados", ctx);
    const titles = routed.toolContext.documents.map((d) => d.title);
    expect(titles).toContain("Viejo");
    expect(titles).toContain("Blog hoy");
    expect(titles).not.toContain("Flexible");
  });

  it("Entregame todos los horarios → Status column + dept rail", () => {
    expect(parseGinaScheduleScope("Entregame todos los horarios")).toBe("all");
    const routed = runGinaQueryFamily("Entregame todos los horarios", ctx);
    expect(routed.toolContext.view.layout).toBe("schedules_all");
    expect(routed.toolContext.view.showStatus).toBe(true);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.columns).toEqual(["document", "category", "time", "status"]);
    expect(viz.data.railMode).toBe("department");
    expect(viz.data.departmentRail?.length).toBeGreaterThan(0);
  });

  it("Entregame todos los horarios → silent headline (table only)", () => {
    const routed = runGinaQueryFamily("Entregame todos los horarios", ctx);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.view.scheduleScope).toBe("all");
    expect(buildGinaFunnelHeadline(viz, { locale: "es", salt: 0 })).toBe("");
  });

  it("week table uses weekday rail (not status) + Status column + struck completed", () => {
    const routed = runGinaQueryFamily("visualizar todos los horarios de la semana", ctx);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.railMode).toBe("weekday");
    expect(viz.data.groupBy).toBe("weekday");
    expect(viz.data.columns).toEqual(["document", "category", "time", "status"]);
    expect(viz.data.columns).not.toContain("weekday");
    expect(Array.isArray(viz.data.rail)).toBe(true);
    expect(viz.data.weekdayRail).toEqual(viz.data.rail);
    expect(viz.data.statusRail).toBeUndefined();
    expect(viz.data.departmentRail).toBeUndefined();
    expect(viz.data.rail.every((s) => s.letter && s.dayIndex != null)).toBe(true);

    const completed = viz.data.documents.find((d) => d.title === "Blog semana");
    expect(completed?.struck).toBe(true);
    expect(completed?.status).toBe("completed");
    // Passed morning slots are not on the main vigentes table
    const titles = (viz.data.documents || []).map((d) => d.title);
    expect(titles).not.toContain("Blog hoy");
    expect(titles).not.toContain("Sales hoy sin cat");
    expect(titles).not.toContain("Past due semana");
    expect(titles).not.toContain("Viejo");

    const headline = buildGinaFunnelHeadline(viz, { locale: "es", salt: 1 });
    expect(headline).toMatch(/esta semana|vigentes|por d[ií]a/i);
    expect(headline).not.toMatch(/por departamento/i);
    expect(headline).not.toMatch(/esa tabla/i);
    expect(viz.data.title).toMatch(/^Esta semana$/i);
    expect(viz.data.rail.every((s) => (s.abbr || s.letter) && s.dayIndex != null)).toBe(true);
    expect(viz.data.weekProgress?.total).toBeGreaterThan(0);
  });

  it("week folder % mode attaches folderProgress chart", () => {
    const routed = runGinaQueryFamily("visualizar por % completado", ctx);
    expect(routed.family).toBe("count_documents");
    expect(routed.toolContext.view.scheduleScope).toBe("week");
    expect(routed.toolContext.weekDisplayMode).toBe("folder_pct");
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz.data.weekDisplayMode).toBe("folder_pct");
    expect(viz.data.title).toMatch(/esta semana.*folder|folder.*esta semana/i);
    // % uses vigentes only — passed morning docs excluded from progress source
    const pctTitles = (viz.data.documents || []).map((d) => d.title);
    expect(pctTitles).not.toContain("Blog hoy");
    expect(pctTitles).toContain("Blog semana");
    expect(Array.isArray(viz.data.folderProgress)).toBe(true);
    expect(viz.data.folderProgress.length).toBeGreaterThan(0);
    expect(Array.isArray(viz.data.folderPctChart)).toBe(true);
    for (const row of viz.data.folderProgress) {
      const action = buildGinaWeekFolderOpenAction(row);
      expect(action).toBeTruthy();
      expect(action.text).toBe(`GinaOpenDocument:${row.folderId}`);
      expect(action.displayText).toBeTruthy();
    }
    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => c.id === "week_back_schedule")).toBe(true);
    expect(chips.find((c) => c.id === "week_back_schedule")?.label).toMatch(/^atrás$/i);
    expect(chips.some((c) => c.id === "week_overdue")).toBe(false);
    expect(chips.some((c) => c.id === "week_pct")).toBe(false);
  });

  it("buildGinaWeekFolderOpenAction requires folderId", () => {
    expect(buildGinaWeekFolderOpenAction({ folder: "Solo nombre" })).toBeNull();
    expect(buildGinaWeekFolderOpenAction({ folderId: "f1", folder: "Trends" })).toEqual({
      text: "GinaOpenDocument:f1",
      displayText: "Trends",
    });
  });

  it("week overdue mode keeps only markable passed slots", () => {
    const routed = runGinaQueryFamily("horarios vencidos de la semana", ctx);
    expect(routed.toolContext.weekDisplayMode).toBe("overdue");
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz.data.weekDisplayMode).toBe("overdue");
    // n6 is already past_due → not markable; n3 completed Wed morning is not markable
    const titles = (viz.data.documents || []).map((d) => d.title);
    expect(titles).toContain("Blog hoy");
    expect(titles).toContain("Sales hoy sin cat");
    expect(titles).not.toContain("Past due semana");
    expect(titles).not.toContain("Viejo");
    expect(titles).not.toContain("Blog semana");
    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => c.id === "week_back_schedule")).toBe(true);
    expect(chips.find((c) => c.id === "week_back_schedule")?.label).toMatch(/^atrás$/i);
    expect(chips.some((c) => c.id === "week_pct")).toBe(false);
  });

  it("week chips include % and overdue from schedules_week", () => {
    const routed = runGinaQueryFamily("tabla de la semana", ctx);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => c.id === "week_pct")).toBe(true);
    expect(chips.some((c) => c.id === "week_overdue")).toBe(true);
    expect(chips.some((c) => c.id === "week_back_schedule")).toBe(false);
    expect(chips.some((c) => c.id === "ask_filter_categories")).toBe(false);
  });

  it("week scope wins over last-table horario refine", () => {
    clearGinaLastTurn();
    setGinaLastTurn({
      family: "count_documents",
      documents: [
        { id: "n4", title: "Viejo", anchorAt: "2026-07-01T09:00:00" },
        { id: "n1", title: "Blog hoy", anchorAt: "2026-08-07T09:00:00" },
      ],
      tableSchema: {
        columns: [{ key: "document" }, { key: "time" }],
        valuesByKey: { document: ["Viejo", "Blog hoy"] },
      },
    });
    try {
      const routed = runGinaQueryFamily("visualizar todos los horarios de la semana", ctx);
      expect(routed.toolContext.view.layout).toBe("schedules_week");
      const titles = routed.toolContext.documents.map((d) => d.title);
      expect(titles).not.toContain("Viejo");
      expect(titles).toContain("Blog hoy");
    } finally {
      clearGinaLastTurn();
    }
  });

  it("today schedule scope keeps department rail", () => {
    const routed = runGinaQueryFamily("visualizar todos los horarios de hoy", ctx);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.railMode).toBe("department");
    expect(viz.data.groupBy).toBe("department");
    expect(Array.isArray(viz.data.departmentRail)).toBe(true);
    expect(viz.data.departmentRail.length).toBeGreaterThan(0);
  });
});

describe("nav_back after schedule scope / filtered list", () => {
  it("horarios de hoy → category ask chips when table has cats + Volver", () => {
    const routed = runGinaQueryFamily("visualizar todos los horarios de hoy", ctx);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips.some((c) => c.id === "ask_filter_categories")).toBe(true);
    expect(chips.some((c) => c.id === "ask_exclude_categories")).toBe(true);
    expect(chips.some((c) => c.id === "nav_back_refine")).toBe(true);
    expect(chips.some((c) => c.kind === "category")).toBe(false);
    expect(chips.some((c) => /status/i.test(c.label))).toBe(false);
  });

  it("listado completo still offers schedule_scope chips", () => {
    const list = runGinaQueryFamily("Listado completo", ctx);
    const viz = buildGinaVisualization("count_documents", list.toolContext, {
      locale: "es",
      now,
    });
    const chips = buildGinaReplyChips({
      family: "count_documents",
      visualization: viz,
      locale: "es",
    });
    expect(chips.filter((c) => c.kind === "schedule_scope")).toHaveLength(3);
    expect(chips.some((c) => c.kind === "nav_back")).toBe(false);
  });

  it("classic muéstrame los horarios de hoy stays schedule_sheet (not nav_back table)", () => {
    const routed = runGinaQueryFamily("Muéstrame los horarios de hoy", ctx);
    expect(routed.family).toBe("today");
    const viz = buildGinaVisualization("today", routed.toolContext, {
      locale: "es",
      userText: "Muéstrame los horarios de hoy",
      now,
    });
    expect(viz?.type).toBe("schedule_sheet");
  });
});
