import { describe, expect, it } from "vitest";
import {
  buildGinaFunnelHeadline,
  buildGinaOpeningChips,
  buildGinaReplyChips,
  buildDeptFocusChips,
  buildTodayDepartmentChips,
  buildTodayOverviewAfterText,
  buildTodayOverviewPostTableCopy,
  buildTodayOverviewIntroText,
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

  it("document surface only offers Horario del día when sheet is saved", () => {
    expect(buildGinaOpeningChips({
      locale: "es",
      surface: "document",
      hasDaySheet: false,
    })).toEqual([]);

    const chips = buildGinaOpeningChips({
      locale: "es",
      surface: "document",
      hasDaySheet: true,
    });
    expect(chips.map((c) => c.id)).toEqual(["day_sheet"]);
    expect(chips[0].label).toBe("Horario del día");
    expect(chips[0].text).toBe("Horario del día");
    expect(chips.some((c) => c.id === "today")).toBe(false);
    expect(chips.some((c) => c.id === "schedule")).toBe(false);
    expect(chips.some((c) => String(c.id).startsWith("test_"))).toBe(false);
  });

  it("dashboard opening chip uses Horario del día when sheet is saved", () => {
    const chips = buildGinaOpeningChips({
      locale: "es",
      surface: "dashboard",
      hasDaySheet: true,
    });
    const day = chips.find((c) => c.id === "day_sheet");
    expect(day?.label).toBe("Horario del día");
    expect(chips.some((c) => c.id === "today")).toBe(true);
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

  it("funnel headline for today overview is classic Horario de Hoy opening", () => {
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
        quickSheet: {
          totalDocuments: 5,
          urgencyCount: 2,
          clockLabel: "3:30 PM",
          urgency: [{ id: "a" }, { id: "b" }],
          topConflict: { id: "a", title: "Sales block", overlapCount: 2 },
          isCleanDay: false,
        },
      },
    }, { locale: "es" });
    expect(line).toMatch(/^Horario de Hoy:/);
    expect(line).not.toMatch(/Ahora te voy a mostrar/i);
    expect(line).toContain("**5** documento");
    expect(line).toContain("2 horas con 15 minutos");
    expect(line).toContain("departamento principal");
    expect(line).not.toMatch(/señalar|vencido|choca/i);
  });

  it("today overview intro text is separate from headline datos", () => {
    const intro = buildTodayOverviewIntroText("es");
    expect(intro).toMatch(/Ahora te voy a mostrar el sheet del día/i);
    expect(intro).not.toMatch(/Horario de Hoy/i);
  });

  it("today overview after-text skips save pitch when recovery is needed", () => {
    const after = buildTodayOverviewAfterText({
      locale: "es",
      hasDaySheet: false,
      offerCount: 0,
      incrementOffer: false,
      quickSheet: {
        urgency: [{ id: "late" }],
        isCleanDay: false,
      },
    });
    expect(after).toBeNull();
  });

  it("today overview post-table is one block: start doc + begin + education pitch", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: false,
      offerCount: 4,
      incrementOffer: false,
      documents: [{
        id: "n1",
        title: "Call 1",
        department: "Sales",
        category: "Calls",
        workMinutes: 60,
        timeClock: "9:00 AM – 10:00 AM",
      }],
      quickSheet: {
        urgency: [],
        isCleanDay: true,
        firstPendingTitle: "Call 1",
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Call 1" }],
      },
    });
    expect(post.textAfter).toContain("**Documento de inicio:** Call 1");
    expect(post.textAfter).toContain("**Departamento:** Sales (Calls)");
    expect(post.textAfter).toContain("**Tiempo asignado:**");
    expect(post.textAfter).toContain("**Cuando desees puedes comenzar.**");
    expect(post.textAfter).toContain("Antes de empezar: si quieres podemos guardar este Horario del día");
    expect(post.textAfter).toContain("¿Quieres guardarlo?");
    expect(post.textAfter).not.toMatch(/¡Hey!/i);
    expect(post.textAfter).not.toMatch(/Sheet del Día/i);
    expect(post.textPitch).toBeNull();
  });

  it("today overview post-table still educates Horario del día when sheet already saved", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: true,
      documents: [{
        id: "n1",
        title: "Call 1",
        department: "Sales",
        category: "Calls",
        workMinutes: 45,
        timeClock: "9:00 AM – 9:45 AM",
      }],
      quickSheet: {
        isCleanDay: true,
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Call 1" }],
      },
    });
    expect(post.textAfter).toContain("**Documento de inicio:** Call 1");
    expect(post.textAfter).toContain("**Cuando desees puedes comenzar.**");
    expect(post.textAfter).toContain("Horario del día");
    expect(post.textAfter).not.toMatch(/¡Hey!/i);
    expect(post.textPitch).toBeNull();
  });

  it("clean-day save gate chip is labeled Guardar horario del día", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      hasDaySheet: false,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [],
          quickSheet: { isCleanDay: true, urgency: [], hasOverlap: false },
        },
      },
      locale: "es",
    });
    const save = chips.find((c) => c.id === "save_day_sheet");
    expect(save?.label).toBe("Guardar horario del día");
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

  it("today overview offers Comenzar + Guardar horario del día + focus", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      hasDaySheet: false,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [
            { name: "Marketing", total: 2 },
            { name: "Sales", total: 1 },
          ],
          documents: [{ id: "1" }],
          quickSheet: {
            isCleanDay: true,
            firstPendingId: "1",
            firstPendingTitle: "Doc 1",
            pending: [{ id: "1", title: "Doc 1" }],
          },
        },
      },
      locale: "es",
    });
    expect(chips.map((c) => c.id)).toContain("open_1");
    expect(chips.map((c) => c.id)).toContain("save_day_sheet");
    expect(chips.map((c) => c.id)).toContain("focus_Marketing");
    expect(chips.find((c) => c.id === "save_day_sheet")?.label).toBe("Guardar horario del día");
  });

  it("clean-day today overview without sheet offers Guardar horario del día", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      hasDaySheet: false,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [{ name: "Sales", total: 1 }],
          documents: [{ id: "n1", title: "Call 1" }],
          quickSheet: {
            completed: [],
            urgency: [],
            pending: [{ id: "n1", title: "Call 1" }],
            isCleanDay: true,
            firstPendingId: "n1",
            firstPendingTitle: "Call 1",
            hasOverlap: false,
          },
        },
      },
      locale: "es",
    });
    expect(chips.map((c) => c.id)).toContain("save_day_sheet");
    expect(chips.find((c) => c.id === "save_day_sheet")?.label).toBe("Guardar horario del día");
    expect(chips.map((c) => c.id)).toContain("open_n1");
    expect(chips.map((c) => c.id)).toContain("focus_Sales");
  });

  it("clean-day today overview with saved sheet still offers Guardar horario del día", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      hasDaySheet: true,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [{ name: "Sales", total: 1 }],
          documents: [{ id: "n1", title: "Call 1" }],
          quickSheet: {
            completed: [],
            urgency: [],
            pending: [{ id: "n1", title: "Call 1" }],
            isCleanDay: true,
            firstPendingId: "n1",
            firstPendingTitle: "Call 1",
            hasOverlap: false,
          },
        },
      },
      locale: "es",
    });
    expect(chips.map((c) => c.id)).toContain("save_day_sheet");
    expect(chips.find((c) => c.id === "save_day_sheet")?.label).toBe("Guardar horario del día");
    expect(chips.map((c) => c.id)).toContain("open_n1");
    expect(chips.map((c) => c.id)).not.toContain("open_day_sheet");
  });

  it("allowOpenWithoutSave on today overview keeps Comenzar + save + focus", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      hasDaySheet: false,
      allowOpenWithoutSave: true,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [{ name: "Sales", total: 1 }],
          documents: [{ id: "n1", title: "Call 1" }],
          quickSheet: {
            completed: [],
            urgency: [],
            pending: [{ id: "n1", title: "Call 1" }],
            isCleanDay: true,
            firstPendingId: "n1",
            firstPendingTitle: "Call 1",
            hasOverlap: false,
          },
        },
      },
      locale: "es",
    });
    expect(chips.map((c) => c.id)).toContain("open_n1");
    expect(chips.map((c) => c.id)).toContain("focus_Sales");
    expect(chips.map((c) => c.id)).toContain("save_day_sheet");
  });

  it("justSaved day sheet offers Comenzar as primary", () => {
    const chips = buildGinaReplyChips({
      family: "day_sheet",
      hasDaySheet: true,
      nextDocumentId: "n1",
      nextDocumentTitle: "Call 1",
      visualization: {
        type: "schedule_sheet",
        data: {
          isDaySheet: true,
          justSaved: true,
          nextDocumentId: "n1",
          documents: [{ id: "n1", title: "Call 1" }],
        },
      },
      locale: "es",
    });
    expect(chips[0].id).toBe("open_n1");
    expect(chips[0].text).toBe("GinaOpenDocument:n1");
    expect(chips[0].primary).toBe(true);
    expect(chips.map((c) => c.id)).toContain("day_sheet_next");
  });

  it("clean-day today overview headline still pitches save offer after text", () => {
    const headline = buildGinaFunnelHeadline({
      type: "schedule_sheet",
      data: {
        todayOverview: true,
        totalMinutes: 60,
        totalHoursLabel: "1 hora",
        documents: [{ id: "n1" }],
        overviewByDepartment: [{ name: "Sales", total: 1, minutes: 60 }],
        quickSheet: {
          isCleanDay: true,
          firstPendingId: "n1",
          firstPendingTitle: "Call 1",
          totalDocuments: 1,
          urgency: [],
          urgencyCount: 0,
        },
      },
    }, { locale: "es" });
    expect(headline).toMatch(/^Horario de Hoy:/);
    expect(headline).not.toMatch(/Ahora te voy a mostrar/i);
    expect(headline).toContain("**1** documento");
    const mid = buildTodayOverviewIntroText("es");
    expect(mid).toMatch(/sheet del día/i);
    const after = buildTodayOverviewAfterText({
      locale: "es",
      hasDaySheet: false,
      offerCount: 0,
      incrementOffer: false,
      documents: [{
        id: "n1",
        title: "Call 1",
        department: "Sales",
        category: "Calls",
        workMinutes: 60,
        timeClock: "9:00 AM – 10:00 AM",
      }],
      quickSheet: {
        isCleanDay: true,
        firstPendingId: "n1",
        firstPendingTitle: "Call 1",
        pending: [{ id: "n1", title: "Call 1" }],
        urgency: [],
      },
    });
    expect(after).toContain("**Documento de inicio:** Call 1");
    expect(after).toContain("**Pero antes quería informarte algo:**");
    expect(after).toMatch(/Sheet del Día/i);
  });

  it("urgency on today overview stays out of opening (notify later)", () => {
    const headline = buildGinaFunnelHeadline({
      type: "schedule_sheet",
      data: {
        todayOverview: true,
        totalMinutes: 60,
        totalHoursLabel: "1 hora",
        documents: [{ id: "late" }],
        overviewByDepartment: [{ name: "Sales", total: 1, minutes: 60 }],
        quickSheet: {
          isCleanDay: false,
          totalDocuments: 1,
          urgencyCount: 1,
          clockLabel: "2:00 PM",
          urgency: [{ id: "late" }],
        },
      },
    }, { locale: "es" });
    expect(headline).toMatch(/^Horario de Hoy:/);
    expect(headline).not.toContain("horario vencido");
    expect(headline).not.toContain("2:00 PM");
  });

  it("urgency on today overview chips are recovery-only (errors first)", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          hasRecoveryOffer: false,
          overviewByDepartment: [{ name: "Sales", total: 1 }],
          documents: [{ id: "late" }],
          quickSheet: {
            completed: [],
            urgency: [{ id: "late", title: "Late" }],
            pending: [{ id: "soon" }],
            isCleanDay: false,
          },
        },
      },
      locale: "es",
    });
    expect(chips.some((c) => c.id === "recovery_notify" || c.id === "mark_past_due")).toBe(true);
    expect(chips.map((c) => c.id)).not.toContain("save_day_sheet");
    expect(chips.map((c) => c.id)).not.toContain("focus_Sales");
    expect(chips.some((c) => String(c.id).startsWith("open_"))).toBe(false);
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
