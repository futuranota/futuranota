import { describe, expect, it } from "vitest";
import {
  buildGinaFunnelHeadline,
  buildGinaOpeningChips,
  buildGinaReplyChips,
  buildTodayDepartmentChips,
} from "./ginaReplyChips.js";

describe("ginaReplyChips", () => {
  it("opening chips include today", () => {
    const chips = buildGinaOpeningChips({ locale: "es" });
    expect(chips[0].id).toBe("today");
    expect(chips.some((c) => c.id === "today_schedule")).toBe(true);
  });

  it("department chips recommend focus", () => {
    const chips = buildTodayDepartmentChips({
      departments: [{ name: "Marketing" }, { name: "Sales" }],
      recommended: "Marketing",
      locale: "es",
    });
    expect(chips[0].primary).toBe(true);
    expect(chips[0].text).toContain("Marketing");
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

  it("reply chips from department_cards viz", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      visualization: {
        type: "department_cards",
        data: { departments: [{ name: "Marketing" }], recommended: "Marketing" },
      },
      locale: "es",
    });
    expect(chips[0].id).toContain("focus");
  });
});
