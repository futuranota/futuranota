import { describe, expect, it } from "vitest";
import {
  get_today_scope,
  get_past_due_documents,
  get_folder_children_summary,
  get_schedule_conflicts,
  get_all_company_folders,
} from "./ginaTools.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const now = new Date("2026-08-01T12:00:00");

const ctx = {
  objectId: "co1",
  now,
  departments: [
    { id: "dept_m", objectId: "co1", category: "Marketing", subcategories: [{ label: "blogs", description: "" }] },
  ],
  docs: {
    f1: {
      id: "f1",
      title: "Trends",
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
      title: "Blog Post",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T08:00:00",
      anchorFinishAt: "2026-08-01T15:00:00",
      status: "in_progress",
    },
    n2: {
      id: "n2",
      title: "Email campaign",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-07-31T10:00:00",
      anchorFinishAt: "2026-07-31T12:00:00",
      status: "past_due",
    },
    n3: {
      id: "n3",
      title: "Moodboard",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T10:00:00",
      anchorFinishAt: "2026-08-01T13:00:00",
      status: "not_started",
    },
  },
};

describe("ginaTools", () => {
  it("lists folders with child counts", () => {
    const folders = get_all_company_folders(ctx);
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe("Trends");
    expect(folders[0].childDocuments).toBe(3);
  });

  it("get_today_scope finds today's docs", () => {
    const scope = get_today_scope(ctx);
    expect(scope.totalDocumentsToday).toBe(2);
    expect(scope.date).toBe("2026-08-01");
  });

  it("get_past_due_documents", () => {
    const out = get_past_due_documents(ctx);
    expect(out.totalPastDue).toBeGreaterThanOrEqual(1);
    expect(out.documents.some((d) => d.title === "Email campaign")).toBe(true);
  });

  it("folder summary", () => {
    const sum = get_folder_children_summary(ctx, "f1");
    expect(sum.folderName).toBe("Trends");
    expect(sum.aggregated.total).toBe(3);
  });

  it("detects schedule conflicts same day", () => {
    const { conflicts } = get_schedule_conflicts(ctx);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ginaQueryFamily", () => {
  it("routes today questions", () => {
    const r = runGinaQueryFamily("Gina, qué tengo para hoy?", ctx);
    expect(r.family).toBe("today");
    expect(r.toolsCalled).toContain("get_today_scope");
  });

  it("routes past due", () => {
    const r = runGinaQueryFamily("qué está vencido?", ctx);
    expect(r.family).toBe("past_due");
  });
});
