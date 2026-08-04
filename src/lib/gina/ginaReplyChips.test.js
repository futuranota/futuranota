import { describe, expect, it } from "vitest";
import {
  buildGinaFunnelHeadline,
  buildGinaOpeningChips,
  buildGinaReplyChips,
  buildDeptFocusChips,
  buildTodayDepartmentChips,
} from "./ginaReplyChips.js";

describe("ginaReplyChips", () => {
  it("opening chips only today + schedule", () => {
    const chips = buildGinaOpeningChips({ locale: "es" });
    expect(chips.map((c) => c.id)).toEqual(["today", "today_schedule"]);
  });

  it("department chips have no past_due", () => {
    const chips = buildTodayDepartmentChips({
      departments: [{ name: "Marketing" }],
      recommended: "Marketing",
      locale: "es",
    });
    expect(chips.some((c) => c.id === "past_due")).toBe(false);
    expect(chips[0].text).toContain("Marketing");
  });

  it("dept focus chips are expand modes", () => {
    const chips = buildDeptFocusChips({ department: "Marketing", locale: "es" });
    expect(chips.map((c) => c.id)).toEqual([
      "expand_categories",
      "expand_status",
      "expand_folders",
      "back_depts",
    ]);
  });

  it("funnel headline for department_cards", () => {
    const line = buildGinaFunnelHeadline({
      type: "department_cards",
      data: {
        departments: [{ name: "A" }, { name: "B" }],
        recommended: "A",
      },
    }, { locale: "es" });
    expect(line).toContain("2 departamentos");
    expect(line).toContain("A");
  });

  it("funnel headline for dept_summary asks how to expand", () => {
    const line = buildGinaFunnelHeadline({
      type: "dept_summary",
      data: { department: "Marketing", folders: 2, documents: 3 },
    }, { locale: "es" });
    expect(line).toContain("expandir");
  });

  it("reply chips from dept_status_menu", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      visualization: {
        type: "dept_status_menu",
        data: {
          department: "Marketing",
          statuses: [
            { key: "in_progress", count: 2 },
            { key: "past_due", count: 1 },
          ],
        },
      },
      locale: "es",
    });
    expect(chips.some((c) => c.id === "status_in_progress")).toBe(true);
    expect(chips[0].text).toContain("Status in_progress");
  });
});
