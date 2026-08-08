import { describe, expect, it } from "vitest";
import {
  buildTodayQuickSheetSections,
  filterDocsAnchoredToday,
  flattenTodayQuickSheetRows,
  summarizeTodayOverlaps,
  todayHasScheduleOverlap,
  urgencyChipKind,
} from "./ginaTodayQuickSheet.js";
import { buildGinaStatusRailRuns } from "./ginaStatusColors.js";

const NOW = new Date("2026-08-08T14:00:00");

function doc(partial) {
  return {
    id: partial.id || "x",
    title: partial.title || "Doc",
    status: partial.status ?? null,
    completed: partial.completed,
    anchorAt: partial.anchorAt,
    anchorFinishAt: partial.anchorFinishAt,
    departmentName: partial.departmentName || "Sales",
  };
}

describe("ginaTodayQuickSheet", () => {
  it("filters only same calendar day as now", () => {
    const docs = [
      doc({ id: "today", anchorAt: "2026-08-08T09:00:00", anchorFinishAt: "2026-08-08T10:00:00" }),
      doc({ id: "yest", anchorAt: "2026-08-07T09:00:00", anchorFinishAt: "2026-08-07T10:00:00" }),
      doc({ id: "tom", anchorAt: "2026-08-09T09:00:00", anchorFinishAt: "2026-08-09T10:00:00" }),
    ];
    expect(filterDocsAnchoredToday(docs, NOW).map((d) => d.id)).toEqual(["today"]);
  });

  it("partitions completed / urgency (passed + null) / pending", () => {
    const docs = [
      doc({
        id: "done",
        title: "Done",
        status: "completed",
        anchorAt: "2026-08-08T08:00:00",
        anchorFinishAt: "2026-08-08T09:00:00",
      }),
      doc({
        id: "late",
        title: "Late null",
        status: null,
        anchorAt: "2026-08-08T10:00:00",
        anchorFinishAt: "2026-08-08T11:00:00",
      }),
      doc({
        id: "pd",
        title: "Past due",
        status: "past_due",
        anchorAt: "2026-08-08T09:00:00",
        anchorFinishAt: "2026-08-08T09:30:00",
      }),
      doc({
        id: "soon",
        title: "Later today",
        status: "not_started",
        anchorAt: "2026-08-08T16:00:00",
        anchorFinishAt: "2026-08-08T17:00:00",
      }),
    ];
    const s = buildTodayQuickSheetSections(docs, NOW);
    expect(s.completed.map((d) => d.id)).toEqual(["done"]);
    expect(s.urgency.map((d) => d.id)).toEqual(["pd", "late"]);
    expect(s.urgency.find((d) => d.id === "late")?.urgencyChip).toBe("status_unassigned");
    expect(s.urgency.find((d) => d.id === "pd")?.urgencyChip).toBe("past_due");
    expect(s.pending.map((d) => d.id)).toEqual(["soon"]);
    expect(s.isCleanDay).toBe(false);
  });

  it("marks clean day when only future pending remain", () => {
    const docs = [
      doc({
        id: "a",
        title: "First",
        status: "not_started",
        anchorAt: "2026-08-08T15:00:00",
        anchorFinishAt: "2026-08-08T16:00:00",
      }),
      doc({
        id: "b",
        title: "Second",
        status: "not_started",
        anchorAt: "2026-08-08T17:00:00",
        anchorFinishAt: "2026-08-08T18:00:00",
      }),
    ];
    const s = buildTodayQuickSheetSections(docs, NOW);
    expect(s.completed).toHaveLength(0);
    expect(s.urgency).toHaveLength(0);
    expect(s.pending.map((d) => d.id)).toEqual(["a", "b"]);
    expect(s.isCleanDay).toBe(true);
    expect(s.firstPending?.id).toBe("a");
    expect(s.hasOverlap).toBe(false);
  });

  it("detects overlap among non-completed today docs", () => {
    const docs = [
      doc({
        id: "a",
        title: "Long Sales",
        departmentName: "Sales",
        anchorAt: "2026-08-08T15:00:00",
        anchorFinishAt: "2026-08-08T17:00:00",
      }),
      doc({
        id: "b",
        title: "Blogs",
        departmentName: "Marketing",
        anchorAt: "2026-08-08T16:00:00",
        anchorFinishAt: "2026-08-08T16:30:00",
      }),
    ];
    expect(todayHasScheduleOverlap(docs, NOW)).toBe(true);
    const s = buildTodayQuickSheetSections(docs, NOW);
    expect(s.hasOverlap).toBe(true);
    expect(s.isCleanDay).toBe(false);
    const summary = summarizeTodayOverlaps(docs, NOW);
    expect(summary.hasOverlap).toBe(true);
    expect(summary.topConflict?.department).toBe("Sales");
    expect(summary.conflictRails?.longBlock?.id).toBe("a");
    expect(summary.conflictRails?.overlappingBlocks?.map((b) => b.id)).toContain("b");
  });

  it("urgencyChipKind distinguishes past_due vs unassigned", () => {
    expect(urgencyChipKind(doc({ status: "past_due" }))).toBe("past_due");
    expect(urgencyChipKind(doc({ status: null }))).toBe("status_unassigned");
    expect(urgencyChipKind(doc({ status: "not_started" }))).toBe("status_unassigned");
  });

  it("flattens chronologically with section tags", () => {
    const s = buildTodayQuickSheetSections([
      doc({
        id: "done",
        status: "completed",
        anchorAt: "2026-08-08T08:00:00",
        anchorFinishAt: "2026-08-08T09:00:00",
      }),
      doc({
        id: "late",
        status: null,
        anchorAt: "2026-08-08T10:00:00",
        anchorFinishAt: "2026-08-08T11:00:00",
      }),
      doc({
        id: "soon",
        status: "not_started",
        anchorAt: "2026-08-08T16:00:00",
        anchorFinishAt: "2026-08-08T17:00:00",
      }),
    ], NOW);
    const rows = flattenTodayQuickSheetRows({
      completed: s.completed,
      urgency: s.urgency,
      pending: s.pending,
    });
    expect(rows.map((d) => d.id)).toEqual(["done", "late", "soon"]);
    expect(rows.map((d) => d.sheetSection)).toEqual(["completed", "urgency", "pending"]);
    expect(rows[0].struck).toBe(true);
    const rail = buildGinaStatusRailRuns(rows, "es");
    expect(rail.length).toBeGreaterThan(0);
    expect(rail.reduce((acc, seg) => acc + seg.count, 0)).toBe(3);
  });
});
