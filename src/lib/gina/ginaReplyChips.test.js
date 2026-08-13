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
  buildTodayScheduleProgressNarration,
} from "./ginaReplyChips.js";

describe("ginaReplyChips", () => {
  it("opening chips are home agenda entries only", () => {
    const chips = buildGinaOpeningChips({ locale: "es" });
    expect(chips.map((c) => c.id)).toEqual([
      "home_intro",
      "agenda_today",
      "review_week",
      "all_schedules",
      "home_explore",
      "see_all_docs",
    ]);
    expect(chips[0].kind).toBe("prompt");
    expect(chips.find((c) => c.id === "agenda_today")?.label).toMatch(/agenda para hoy/i);
    expect(chips.find((c) => c.id === "all_schedules")?.text).toMatch(/todos los horarios/i);
    expect(chips.find((c) => c.id === "see_all_docs")?.label).toMatch(/Ver todo/i);
    expect(chips.some((c) => String(c.id).startsWith("test_") || String(c.id).startsWith("core_"))).toBe(false);
  });

  it("document surface offers free-hours check (and day sheet when saved)", () => {
    const bare = buildGinaOpeningChips({
      locale: "es",
      surface: "document",
      hasDaySheet: false,
    });
    expect(bare.map((c) => c.id)).toEqual(["check_free_hours_doc"]);
    expect(bare[0].label).toMatch(/horas libres/i);
    expect(bare[0].primary).toBe(true);

    const chips = buildGinaOpeningChips({
      locale: "es",
      surface: "document",
      hasDaySheet: true,
    });
    expect(chips.map((c) => c.id)).toEqual(["check_free_hours_doc", "day_sheet"]);
    expect(chips[1].label).toBe("Horario del día");
    expect(chips.some((c) => c.id === "today")).toBe(false);
    expect(chips.some((c) => c.id === "schedule")).toBe(false);
    expect(chips.some((c) => String(c.id).startsWith("test_"))).toBe(false);
  });

  it("document surface EN chip checks available hours", () => {
    const chips = buildGinaOpeningChips({
      locale: "en",
      surface: "document",
      hasDaySheet: false,
    });
    expect(chips[0].text).toMatch(/available hours for this document/i);
  });

  it("in-doc day sheet headline omits counts and “puedes decir” prose", () => {
    const viz = {
      type: "schedule_sheet",
      data: {
        isDaySheet: true,
        documents: [{ id: "1" }, { id: "2" }],
        progress: { total: 2, completed: 0, remaining: 2 },
      },
    };
    const compact = buildGinaFunnelHeadline(viz, { locale: "es", compact: true });
    expect(compact).toBe("");
    expect(compact).not.toMatch(/puedes decir/i);
    expect(compact).not.toMatch(/Aquí tienes tu sheet/i);

    const dashboard = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(dashboard).toMatch(/Aquí tienes tu sheet del día/);
    expect(dashboard).toMatch(/puedes decir/i);
  });

  it("dashboard opening has no day_sheet / legacy today chip", () => {
    const chips = buildGinaOpeningChips({
      locale: "es",
      surface: "dashboard",
      hasDaySheet: true,
    });
    expect(chips.some((c) => c.id === "day_sheet")).toBe(false);
    expect(chips.some((c) => c.id === "today")).toBe(false);
    expect(chips.some((c) => c.id === "agenda_today")).toBe(true);
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

  it("funnel headline for today overview is empty pre-sheet (summary is post-sheet)", () => {
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
    expect(line).toBe("");
    expect(line).not.toMatch(/Ahora te voy a mostrar/i);
    expect(line).not.toMatch(/señalar|vencido|choca/i);
  });

  it("today overview intro text is separate from headline datos", () => {
    const intro = buildTodayOverviewIntroText("es");
    expect(intro).toBe("Ahora te voy a mostrar el horario del día:");
    expect(intro).not.toMatch(/desde ayer|lista y organizada/i);
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

  it("today overview post-table: day summary + start doc + agenda ready + notifs", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: false,
      documents: [{
        id: "n1",
        title: "Call 1",
        department: "Sales",
        category: "Calls",
        workMinutes: 60,
        timeClock: "9:00 AM – 10:00 AM",
      }],
      overviewByDepartment: [{ name: "Sales", total: 1, minutes: 60, hoursLabel: "1h" }],
      totalMinutes: 60,
      totalHoursLabel: "1 hora",
      quickSheet: {
        urgency: [],
        isCleanDay: true,
        firstPendingTitle: "Call 1",
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Call 1" }],
        totalDocuments: 1,
      },
    });
    expect(post.textAfterLead).toMatch(/Resumen inicial del día/i);
    expect(post.textAfterLead).toMatch(/Sales/i);
    expect(post.textAfter).toContain("**Documento de inicio:** Call 1");
    expect(post.textAfter).toContain("**Departamento:** Sales (Calls)");
    expect(post.textAfter).toContain("**Tiempo asignado:**");
    expect(post.textAfter).not.toContain("**Cuando desees puedes comenzar.**");
    expect(post.textAfter).toMatch(/Tu agenda está lista/i);
    expect(post.textAfter).toMatch(/abre el Asistente/i);
    expect(post.textAfter).toMatch(/¿Activamos avisos en vivo\?/i);
    expect(post.textAfter).toMatch(/al inicio de cada tarea/i);
    expect(post.textAfter).not.toMatch(/¿Quieres guardarlo/i);
    expect(post.textAfter).not.toMatch(/Call Asistente/i);
    expect(post.textPitch).toBeNull();
    expect(post.startDocLines?.length).toBe(3);
    expect(post.startDocLines[0].label).toBe("Documento de inicio");
    expect(post.textAfterRest).toMatch(/Tu agenda está lista/i);
    expect(post.textAfterRest).not.toContain("Documento de inicio");
    expect(post.textAfterRest).not.toContain("**Cuando desees puedes comenzar.**");
  });

  it("labels Próximo Documento when a completed doc is earlier in the day", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: false,
      offerCount: 4,
      incrementOffer: false,
      forceCleanDay: true,
      documents: [{
        id: "n2",
        title: "Sales call",
        department: "Sales",
        category: "Calls",
        workMinutes: 120,
        timeClock: "5:30 PM – 7:30 PM",
        anchorAt: "2026-08-09T17:30:00.000Z",
      }],
      quickSheet: {
        isCleanDay: true,
        firstPendingId: "n2",
        firstPendingTitle: "Sales call",
        completed: [{
          id: "n1",
          title: "Blogs",
          completed: true,
          anchorAt: "2026-08-09T15:30:00.000Z",
        }],
        urgency: [],
        pending: [{
          id: "n2",
          title: "Sales call",
          anchorAt: "2026-08-09T17:30:00.000Z",
        }],
      },
    });
    expect(post.startDocLines[0].label).toBe("Próximo Documento");
    expect(post.textAfter).toContain("**Próximo Documento:** Sales call");
    expect(post.textAfter).not.toContain("**Documento de inicio:**");
  });

  it("recovery gate still returns startDocLines with highlight SFX rows", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: false,
      offerCount: 4,
      incrementOffer: false,
      hasRecoveryOffer: true,
      lateStartCount: 1,
      documents: [{
        id: "n2",
        title: "Assistente test",
        department: "Sales",
        category: "—",
        workMinutes: 120,
        timeClock: "5:30 PM – 7:30 PM",
      }],
      quickSheet: {
        isCleanDay: false,
        firstPendingId: "n2",
        firstPendingTitle: "Assistente test",
        completed: [{ id: "n1", title: "Blogs", completed: true }],
        urgency: [],
        pending: [{ id: "n2", title: "Assistente test" }],
      },
    });
    expect(post.startDocLines?.length).toBe(3);
    expect(post.startDocLines[0].label).toBe("Próximo Documento");
    expect(post.startDocLines[0].value).toBe("Assistente test");
    expect(post.startDocLines[1].value).toBe("Sales");
    expect(post.startDocLines[1].value).not.toMatch(/\(\s*[—-]\s*\)/);
    expect(post.textAfter).toBeNull();
    expect(post.textAfterRest).toBeNull();
    expect(post.textPitch).toBeNull();
  });

  it("buildTodayScheduleProgressNarration: N=2, P=0", () => {
    const text = buildTodayScheduleProgressNarration({
      locale: "es",
      dayProgress: { total: 2, completed: 0, percent: 0, remaining: 2 },
      folderProgress: [{ folder: "Youtube", percent: 0 }],
      startFolder: "Youtube",
    });
    expect(text).toMatch(/2 documentos/i);
    expect(text).toMatch(/\*\*0%\*\*/);
    expect(text).toMatch(/0 de 2/);
    expect(text).toMatch(/Youtube/);
    expect(text).toMatch(/0% de ese folder/);
  });

  it("post-table lead includes day progress when dayProgress.total > 0", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: false,
      documents: [{
        id: "n1",
        title: "Call 1",
        department: "Sales",
        category: "Calls",
        folder: "Youtube",
        workMinutes: 60,
        timeClock: "9:00 AM – 10:00 AM",
      }],
      overviewByDepartment: [{ name: "Sales", total: 1, minutes: 60, hoursLabel: "1h" }],
      totalMinutes: 60,
      totalHoursLabel: "1 hora",
      dayProgress: { total: 2, completed: 0, percent: 0, remaining: 2 },
      folderProgress: [{ folder: "Youtube", percent: 0, done: 0, total: 2 }],
      quickSheet: {
        urgency: [],
        isCleanDay: true,
        firstPendingTitle: "Call 1",
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Call 1", folder: "Youtube" }],
        totalDocuments: 1,
      },
    });
    expect(post.textAfterLead).toMatch(/2 documentos/i);
    expect(post.textAfterLead).toMatch(/\*\*0%\*\*/);
    expect(post.textAfterLead).toMatch(/Youtube/);
    expect(post.textAfterLead).toMatch(/Resumen inicial del día/i);
  });

  it("recovery gate surfaces progress narration as textAfterLead", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasRecoveryOffer: true,
      lateStartCount: 1,
      dayProgress: { total: 2, completed: 0, percent: 0 },
      folderProgress: [{ folder: "Youtube", percent: 0 }],
      documents: [{
        id: "n2",
        title: "Assistente test",
        department: "Sales",
        folder: "Youtube",
        workMinutes: 120,
        timeClock: "5:30 PM – 7:30 PM",
      }],
      quickSheet: {
        isCleanDay: false,
        firstPendingId: "n2",
        pending: [{ id: "n2", title: "Assistente test", folder: "Youtube" }],
        completed: [{ id: "n1", completed: true }],
        urgency: [],
      },
    });
    expect(post.textAfterLead).toMatch(/2 documentos/i);
    expect(post.textAfterLead).toMatch(/\*\*0%\*\*/);
    expect(post.startDocLines?.length).toBeGreaterThan(0);
  });

  it("offerDayReady forces post-table copy even if quickSheet is not clean", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      hasDaySheet: false,
      offerDayReady: true,
      forceCleanDay: true,
      documents: [{
        id: "n1",
        title: "Call 1",
        department: "Sales",
        category: "Calls",
        workMinutes: 60,
        timeClock: "9:00 AM – 10:00 AM",
      }],
      quickSheet: {
        urgency: [{ id: "late" }],
        isCleanDay: false,
        firstPendingTitle: "Call 1",
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Call 1" }],
      },
    });
    expect(post.textAfter).toContain("**Documento de inicio:** Call 1");
    expect(post.textAfter).toMatch(/Tu agenda está lista/i);
    expect(post.textAfter).toMatch(/abre el Asistente/i);
  });

  it("today overview post-table still educates Asistente when sheet already saved", () => {
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
    expect(post.textAfter).not.toContain("**Cuando desees puedes comenzar.**");
    expect(post.textAfter).toMatch(/Tu agenda está lista/i);
    expect(post.textAfter).toMatch(/abre el Asistente/i);
    expect(post.textAfter).not.toMatch(/¿Quieres guardarlo/i);
    expect(post.textAfter).not.toMatch(/¡Hey!/i);
    expect(post.textPitch).toBeNull();
  });

  it("clean-day today overview does not offer Guardar calendario del día", () => {
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
    expect(chips.some((c) => c.id === "save_day_sheet")).toBe(false);
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

  it("today overview offers live-notifications first (before Comenzar / Re-agendar)", () => {
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
    expect(chips.map((c) => c.id)).toEqual([
      "enable_day_notifications",
      "skip_day_notifications",
    ]);
    expect(chips.map((c) => c.id)).not.toContain("open_1");
    expect(chips.map((c) => c.id)).not.toContain("reschedule_times");
    expect(chips.map((c) => c.id)).not.toContain("save_day_sheet");
    expect(chips.map((c) => c.id)).not.toContain("focus_Marketing");
    expect(chips.find((c) => c.id === "enable_day_notifications")?.label).toBe("activar notificaciones");
    expect(chips.find((c) => c.id === "skip_day_notifications")?.label).toBe("prefiero chequear por mi cuenta");
  });

  it("after notifications decision, today overview offers Comenzar + Reagendar", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      talkNotificationsDecided: true,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
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
    expect(chips.map((c) => c.id)).toEqual(["open_1", "reschedule_times"]);
    expect(chips.find((c) => c.id === "open_1")?.label).toBe("Comenzar con Doc 1");
    expect(chips.find((c) => c.id === "open_1")?.primary).toBe(true);
    expect(chips.find((c) => c.id === "reschedule_times")?.label).toBe("Reagendar calendario");
  });

  it("clean-day today overview without decision only offers notifications", () => {
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
    expect(chips.map((c) => c.id)).not.toContain("save_day_sheet");
    expect(chips.map((c) => c.id)).not.toContain("open_n1");
    expect(chips.map((c) => c.id)).toContain("enable_day_notifications");
    expect(chips.map((c) => c.id)).not.toContain("focus_Sales");
  });

  it("clean-day today overview with decision + anchored sheet offers Comenzar", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      hasDaySheet: true,
      talkNotificationsDecided: true,
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
    expect(chips.map((c) => c.id)).not.toContain("save_day_sheet");
    expect(chips.map((c) => c.id)).toContain("open_n1");
    expect(chips.map((c) => c.id)).not.toContain("open_day_sheet");
    expect(chips.map((c) => c.id)).not.toContain("focus_Sales");
  });

  it("allowOpenWithoutSave still waits for notification decision before Comenzar", () => {
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
    expect(chips.map((c) => c.id)).toContain("enable_day_notifications");
    expect(chips.map((c) => c.id)).not.toContain("open_n1");
    expect(chips.map((c) => c.id)).not.toContain("save_day_sheet");
  });

  it("justSaved day_sheet_saved funnel copy points to Asistente", () => {
    const line = buildGinaFunnelHeadline({
      type: "day_sheet_saved",
      data: { justSaved: true },
    }, { locale: "es" });
    expect(line).toMatch(/ya está guardado el horario del día/i);
    expect(line).toMatch(/abre el Asistente/i);
    expect(line).toMatch(/Horario del día/i);
    expect(line).not.toMatch(/Call Asistente/i);
    expect(line).not.toMatch(/guarde tu horario/i);
  });

  it("justSaved day sheet offers Comenzar as primary", () => {
    const chips = buildGinaReplyChips({
      family: "day_sheet",
      hasDaySheet: true,
      nextDocumentId: "n1",
      nextDocumentTitle: "Call 1",
      visualization: {
        type: "day_sheet_saved",
        data: {
          isDaySheet: true,
          justSaved: true,
          nextDocumentId: "n1",
          nextDocumentTitle: "Call 1",
          documents: [],
        },
      },
      locale: "es",
    });
    expect(chips[0].id).toBe("open_n1");
    expect(chips[0].text).toBe("GinaOpenDocument:n1");
    expect(chips[0].primary).toBe(true);
    expect(chips.map((c) => c.id)).toContain("day_sheet_next");
  });

  it("clean-day today overview keeps pre-sheet headline empty (summary is post-sheet)", () => {
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
    expect(headline).toBe("");
    const mid = buildTodayOverviewIntroText("es");
    expect(mid).toMatch(/horario del día/i);
    const after = buildTodayOverviewAfterText({
      locale: "es",
      hasDaySheet: false,
      offerCount: 0,
      incrementOffer: false,
      overviewByDepartment: [{ name: "Sales", total: 1, minutes: 60, hoursLabel: "1h" }],
      totalMinutes: 60,
      totalHoursLabel: "1 hora",
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
        totalDocuments: 1,
      },
    });
    expect(after).toMatch(/Resumen inicial del día/i);
    expect(after).toContain("**Documento de inicio:** Call 1");
    expect(after).toMatch(/Tu agenda está lista/i);
    expect(after).toMatch(/abre el Asistente/i);
    expect(after).not.toMatch(/¿Quieres guardarlo/i);
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
    expect(headline).toBe("");
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
