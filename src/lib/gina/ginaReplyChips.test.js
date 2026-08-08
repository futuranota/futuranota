import { describe, expect, it } from "vitest";
import {
  buildGinaFunnelHeadline,
  buildGinaOpeningChips,
  buildGinaReplyChips,
  buildDeptFocusChips,
  buildTodayDepartmentChips,
  buildTodayOverviewDeptBlocks,
} from "./ginaReplyChips.js";

describe("ginaReplyChips", () => {
  it("opening chips include today, test harness, and schedule", () => {
    const chips = buildGinaOpeningChips({ locale: "es" });
    expect(chips[0].id).toBe("today");
    expect(chips.some((c) => c.id === "test_folder_plan_negocio")).toBe(true);
    expect(chips.some((c) => c.id === "schedule")).toBe(true);
    expect(chips.find((c) => c.id === "test_folder_plan_negocio")?.text).toMatch(/plan de negocio/i);
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

  it("funnel headline for today overview is title + descriptive body", () => {
    const line = buildGinaFunnelHeadline({
      type: "schedule_sheet",
      data: {
        todayOverview: true,
        totalMinutes: 135,
        totalHoursLabel: "2 horas con 15 minutos",
        documents: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
        overviewByDepartment: [
          {
            name: "Estrategias de negocios",
            total: 3,
            minutes: 75,
            hoursLabel: "1 hora con 15 minutos",
            categories: [{ name: "Plan de negocio", count: 3 }],
          },
          {
            name: "Marketing",
            total: 2,
            minutes: 60,
            hoursLabel: "1 hora",
            categories: [{ name: "Social Media", count: 2 }],
          },
        ],
      },
    }, { locale: "es" });
    expect(line).toMatch(/^Horario de Hoy:/);
    expect(line).toContain("2 horas con 15 minutos");
    expect(line).toContain("departamento principal");
    expect(line).not.toContain("Estrategias de negocios");
    expect(line).not.toContain("Marketing");
  });

  it("today overview dept blocks have headline + bold docs/hours", () => {
    const blocks = buildTodayOverviewDeptBlocks({
      locale: "es",
      overviewByDepartment: [
        {
          name: "Estrategias de negocios",
          color: "#008AF5",
          total: 2,
          minutes: 135,
          categories: [{ name: "Plan de Negocio", count: 2 }],
        },
      ],
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].headline).toBe("Estrategias de negocios:");
    expect(blocks[0].color).toBe("#008AF5");
    expect(blocks[0].body).toContain("**2 documentos**");
    expect(blocks[0].body).toContain("Plan de Negocio");
    expect(blocks[0].body).toContain("**2 horas con 15** minutos");
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

  it("today overview chips offer save + focus, not department cards loop", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [
            { name: "Marketing", total: 2 },
            { name: "Sales", total: 1 },
          ],
          documents: [{ id: "1" }],
        },
      },
      locale: "es",
    });
    expect(chips.map((c) => c.id)).toContain("save_day_sheet");
    expect(chips.map((c) => c.id)).toContain("focus_Marketing");
    expect(chips.map((c) => c.id)).toContain("focus_Sales");
    expect(chips.map((c) => c.id)).not.toContain("today_depts");
  });

  it("funnel headline for dept_summary asks how to view schedules", () => {
    const line = buildGinaFunnelHeadline({
      type: "dept_summary",
      data: { department: "Marketing", folders: 2, documents: 3 },
    }, { locale: "es" });
    expect(line).toContain("Marketing");
    expect(line).toContain("visualizar los horarios");
  });

  it("reply chips from dept_status_menu only navigate back", () => {
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
    expect(chips.map((c) => c.id)).toEqual(["back_dept"]);
  });

  it("category menu chips start with All", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      visualization: {
        type: "dept_category_menu",
        data: {
          department: "Marketing",
          categories: [{ name: "Blogs", documents: 2 }],
        },
      },
      locale: "es",
    });
    expect(chips[0].id).toBe("cat_all");
    expect(chips[0].label).toBe("All");
    expect(chips[1].id).toBe("cat_Blogs");
  });
});
