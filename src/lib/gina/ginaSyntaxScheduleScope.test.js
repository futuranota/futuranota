import { describe, expect, it } from "vitest";
import {
  filterDocsByScheduleScope,
  parseGinaScheduleScope,
  wantsGinaScheduleScopeList,
  GINA_SCHEDULE_SCOPE_CHIPS_ES,
} from "./ginaSyntaxScheduleScope.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { buildGinaFunnelHeadline, buildGinaReplyChips } from "./ginaReplyChips.js";

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

  it("week table uses status rail (not department) + struck completed", () => {
    const routed = runGinaQueryFamily("visualizar todos los horarios de la semana", ctx);
    const viz = buildGinaVisualization("count_documents", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("table");
    expect(viz.data.railMode).toBe("status");
    expect(viz.data.groupBy).toBe("status");
    expect(Array.isArray(viz.data.rail)).toBe(true);
    expect(viz.data.statusRail).toEqual(viz.data.rail);
    expect(viz.data.departmentRail).toBeUndefined();

    const ids = viz.data.rail.map((s) => s.id);
    expect(ids).toContain("past_due");
    expect(ids).toContain("in_progress");
    expect(ids).toContain("completed");
    expect(ids.indexOf("past_due")).toBeLessThan(ids.indexOf("in_progress"));
    expect(ids.indexOf("in_progress")).toBeLessThan(ids.indexOf("completed"));

    const completed = viz.data.documents.find((d) => d.title === "Blog semana");
    expect(completed?.struck).toBe(true);
    expect(completed?.status).toBe("completed");

    // Contiguous order: all past_due before in_progress before completed
    const statuses = viz.data.documents.map((d) => d.status);
    const firstIp = statuses.indexOf("in_progress");
    const lastPast = statuses.lastIndexOf("past_due");
    const firstDone = statuses.indexOf("completed");
    expect(lastPast).toBeLessThan(firstIp);
    expect(firstIp).toBeLessThan(firstDone);

    const headline = buildGinaFunnelHeadline(viz, { locale: "es", salt: 1 });
    expect(headline).toMatch(/status/i);
    expect(headline).not.toMatch(/departamentos/i);
    expect(headline).toMatch(/semana|Filtros/i);
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
  it("horarios de hoy → only Volver chip", () => {
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
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe("nav_back_refine");
    expect(chips[0].kind).toBe("nav_back");
    expect(chips[0].label).toMatch(/Volver/i);
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
