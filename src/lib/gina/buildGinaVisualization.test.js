import { describe, expect, it } from "vitest";
import { buildGinaVisualization, formatHierarchyPath } from "./buildGinaVisualization.js";

describe("buildGinaVisualization", () => {
  it("formats hierarchy path", () => {
    expect(formatHierarchyPath({
      department: "Marketing",
      category: "Blogs",
      folder: "Trends",
    })).toBe("Marketing / Blogs / Trends");
  });

  it("builds schedule_sheet overview for qué tenemos para hoy (not department cards)", () => {
    const now = new Date("2026-08-01T07:00:00");
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      totalDocumentsToday: 2,
      breakdown: { notStarted: 1, inProgress: 1, pastDue: 0 },
      byDepartment: [
        { name: "Marketing", documents: 2, pastDue: 0, folders: 1 },
      ],
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
          anchorFinishAt: "2026-08-01T09:15:00",
        },
        {
          id: "n2",
          title: "Plan A",
          status: "not_started",
          parentFolderName: "Plan",
          departmentName: "Estrategias de negocios",
          category: "Plan de negocio",
          anchorAt: "2026-08-01T10:00:00",
          anchorFinishAt: "2026-08-01T11:00:00",
        },
      ],
      filters: {},
    }, { userText: "qué tenemos para hoy?", now });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz?.data.todayOverview).toBe(true);
    expect(viz?.data.totalMinutes).toBe(135);
    expect(viz?.data.totalHoursLabel).toMatch(/2 hora/);
    expect(viz?.data.totalHoursLabel).toMatch(/con 15/);
    expect(viz?.data.hoursChart?.length).toBe(2);
    expect(viz?.data.hoursChart.every((s) => s.minutes > 0 && s.fill)).toBe(true);
    expect(viz?.data.overviewByDepartment?.map((d) => d.name)).toEqual([
      "Marketing",
      "Estrategias de negocios",
    ]);
    expect(viz?.data.overviewByDepartment[0].minutes).toBe(75);
    expect(viz?.data.documents?.map((d) => d.id)).toEqual(["n1", "n2"]);
    expect(viz?.data.quickSheet?.pending?.map((d) => d.id)).toEqual(["n1", "n2"]);
    expect(viz?.data.quickSheet?.isCleanDay).toBe(true);
  });

  it("today overview keeps completed only in quickSheet, not dept table", () => {
    const now = new Date("2026-08-01T12:00:00");
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "done",
          title: "Finished",
          status: "completed",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
          anchorFinishAt: "2026-08-01T09:00:00",
        },
        {
          id: "open",
          title: "Open",
          status: "not_started",
          departmentName: "Sales",
          category: "Calls",
          anchorAt: "2026-08-01T15:00:00",
          anchorFinishAt: "2026-08-01T16:00:00",
        },
        {
          id: "late",
          title: "Late",
          status: null,
          departmentName: "Sales",
          category: "Calls",
          anchorAt: "2026-08-01T09:00:00",
          anchorFinishAt: "2026-08-01T10:00:00",
        },
      ],
      filters: {},
    }, { userText: "qué tenemos para hoy?", now });
    expect(viz?.data.documents?.map((d) => d.id)).toEqual(["late", "open"]);
    expect(viz?.data.overviewByDepartment?.map((d) => d.name)).toEqual(["Sales"]);
    expect(viz?.data.quickSheet?.completed?.map((d) => d.id)).toEqual(["done"]);
    expect(viz?.data.quickSheet?.urgency?.map((d) => d.id)).toEqual(["late"]);
    expect(viz?.data.quickSheet?.urgency?.[0]?.urgencyChip).toBe("status_unassigned");
    expect(viz?.data.quickSheet?.pending?.map((d) => d.id)).toEqual(["open"]);
    expect(viz?.data.quickSheet?.isCleanDay).toBe(false);
    expect(viz?.data.hasRecoveryOffer).toBe(true);
    expect(viz?.data.quickSheet?.clockLabel).toBeTruthy();
    expect(viz?.data.quickSheet?.totalDocuments).toBe(3);
  });

  it("omits zero-minute departments from hours pie", () => {
    const now = new Date("2026-08-01T07:00:00");
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Timed",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
          anchorFinishAt: "2026-08-01T09:00:00",
        },
        {
          id: "n2",
          title: "No finish",
          departmentName: "Sales",
          category: "Calls",
          anchorAt: "2026-08-01T10:00:00",
        },
      ],
      filters: {},
    }, { userText: "qué tenemos para hoy?", now });
    expect(viz?.data.hoursChart?.map((s) => s.name)).toEqual(["Marketing"]);
    expect(viz?.data.overviewByDepartment?.length).toBe(2);
  });

  it("builds schedule_sheet for horarios de hoy", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
          anchorFinishAt: "2026-08-01T15:00:00",
        },
      ],
      filters: {},
    }, { userText: "muéstrame los horarios de hoy" });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz?.data.groups[0].department).toBe("Marketing");
  });

  it("builds dept_summary when department filter is set", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
        },
      ],
      byHierarchy: [{ department: "Marketing", category: "Blogs", folder: "Trends", documents: 1 }],
      byStatusCounts: [{ key: "in_progress", count: 1 }],
      byCategory: [{ name: "Blogs", documents: 1, folders: 1 }],
      byFolder: [{ name: "Trends", documents: 1, category: "Blogs" }],
      filters: { department: "Marketing" },
    }, { userText: "Enfocarme hoy en Marketing" });
    expect(viz?.type).toBe("dept_summary");
    expect(viz?.data.department).toBe("Marketing");
  });

  it("builds dept_status_menu on expand status", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
        },
      ],
      byStatusCounts: [{ key: "in_progress", count: 1 }],
      byFolder: [{ name: "Trends", documents: 1 }],
      byCategory: [{ name: "Blogs", documents: 1 }],
      filters: { department: "Marketing", includeCompleted: true },
    }, { userText: "Expandir status hoy en Marketing" });
    expect(viz?.type).toBe("dept_status_menu");
    expect(viz?.data.statuses?.[0]?.key).toBe("in_progress");
  });

  it("builds dept_status_list for Status in_progress", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
        },
      ],
      filters: { department: "Marketing", status: "in_progress" },
    }, { userText: "Status in_progress hoy en Marketing" });
    expect(viz?.type).toBe("dept_status_list");
    expect(viz?.data.documents).toHaveLength(1);
  });

  it("builds dept_folder_menu on expand folders", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [],
      byFolder: [{ name: "Trends", documents: 2 }],
      filters: { department: "Marketing" },
    }, { userText: "Expandir por folders hoy en Marketing" });
    expect(viz?.type).toBe("dept_folder_menu");
    expect(viz?.data.folders[0].name).toBe("Trends");
  });

  it("builds dept_category_detail for Categoría", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
        },
      ],
      filters: { department: "Marketing", category: "Blogs" },
    }, { userText: "Categoría Blogs hoy en Marketing" });
    expect(viz?.type).toBe("dept_category_detail");
    expect(viz?.data.category).toBe("Blogs");
    expect(viz?.data.groups[0].folders[0].folder).toBe("Trends");
  });

  it("builds dept_folder_detail for Folder", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
        },
      ],
      filters: { department: "Marketing", folder: "Trends" },
    }, { userText: "Folder Trends hoy en Marketing" });
    expect(viz?.type).toBe("dept_folder_detail");
    expect(viz?.data.folder).toBe("Trends");
    expect(viz?.data.documents).toHaveLength(1);
  });

  it("builds dept_category_menu on expand categories", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [],
      byCategory: [{ name: "Blogs", documents: 2 }],
      filters: { department: "Marketing" },
    }, { userText: "Expandir por categorías hoy en Marketing" });
    expect(viz?.type).toBe("dept_category_menu");
    expect(viz?.data.categories[0].name).toBe("Blogs");
  });

  it("builds dept_category_detail for Categoría All", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      documents: [
        {
          id: "n1",
          title: "Blog Post",
          status: "in_progress",
          parentFolderName: "Trends",
          departmentName: "Marketing",
          category: "Blogs",
          anchorAt: "2026-08-01T08:00:00",
        },
      ],
      filters: { department: "Marketing" },
    }, { userText: "Categoría All hoy en Marketing" });
    expect(viz?.type).toBe("dept_category_detail");
    expect(viz?.data.category).toBe("All");
    expect(viz?.data.groups[0].folders[0].folder).toBe("Trends");
  });

  it("builds incomplete sections", () => {
    const viz = buildGinaVisualization("incomplete", {
      pastDue: [{ id: "a", title: "Email", folder: "Campaigns", department: "Marketing", category: "Emails", daysOverdue: 1 }],
      upcoming: [{ id: "b", title: "Blog", folder: "Trends", daysUntilDue: 2 }],
      reserved: [],
    });
    expect(viz?.type).toBe("incomplete");
    expect(viz?.data.pastDue).toHaveLength(1);
    expect(viz?.data.upcoming).toHaveLength(1);
  });
});
