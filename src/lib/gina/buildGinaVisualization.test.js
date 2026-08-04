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

  it("builds department_cards for today without dept filter", () => {
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
          anchorFinishAt: "2026-08-01T15:00:00",
        },
      ],
      filters: {},
    }, { userText: "qué tenemos para hoy?" });
    expect(viz?.type).toBe("department_cards");
    expect(viz?.data.departments[0].name).toBe("Marketing");
    expect(viz?.data.recommended).toBe("Marketing");
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
