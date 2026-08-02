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

  it("builds today_scope from today family", () => {
    const viz = buildGinaVisualization("today", {
      date: "2026-08-01",
      totalDocumentsToday: 2,
      breakdown: { notStarted: 1, inProgress: 1, pastDue: 0 },
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
      nextDeadline: { title: "Blog Post", time: "2026-08-01T08:00:00", folder: "Trends" },
    });
    expect(viz?.type).toBe("today_scope");
    expect(viz?.data.total).toBe(2);
    expect(viz?.data.documents[0].hierarchy).toEqual({
      department: "Marketing",
      category: "Blogs",
      folder: "Trends",
    });
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
