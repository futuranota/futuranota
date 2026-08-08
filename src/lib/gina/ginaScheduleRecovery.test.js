import { describe, expect, it } from "vitest";
import {
  buildCascadeSchedulePreview,
  buildDayStartAfterRecoveryText,
  buildPassedSlotSignals,
  buildRecoverySnoozeText,
  buildRescheduleAppliedText,
  buildReschedulePickerText,
  buildScheduleRecoveryAck,
  buildScheduleRecoveryBriefText,
  buildScheduleRecoveryChips,
  buildScheduleRecoveryConfirmChips,
  buildScheduleRecoveryGateChips,
  buildScheduleRecoveryIntroText,
  buildScheduleRecoveryStepText,
  isGinaWarmGoodbye,
  isMarkablePassedSlot,
  isPassedSlot,
  resolveRecoveryCurrentStep,
  resolveRecoveryNextStep,
} from "./ginaScheduleRecovery.js";
import { partitionTodayByClock, findFirstFreeSlot } from "./ginaTodayTimeTriage.js";
import { get_today_scope } from "./ginaTools.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { buildGinaFunnelHeadline, buildGinaReplyChips } from "./ginaReplyChips.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const now = new Date("2026-08-01T16:00:00");

const ctx = {
  objectId: "co1",
  now,
  departments: [
    {
      id: "dept_m",
      objectId: "co1",
      category: "Marketing",
      subcategories: [{ label: "blogs", description: "" }],
    },
  ],
  docs: {
    f1: {
      id: "f1",
      title: "Snapchat",
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
      title: "¿Qué es Futura Nota?",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T08:00:00",
      anchorFinishAt: "2026-08-01T15:00:00",
      status: "in_progress",
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
    n5: {
      id: "n5",
      title: "Evening draft",
      parentDocId: "f1",
      objectId: "co1",
      anchorAt: "2026-08-01T18:00:00",
      anchorFinishAt: "2026-08-01T20:00:00",
      status: "not_started",
    },
  },
};

describe("ginaScheduleRecovery", () => {
  it("detects passed and markable slots", () => {
    const scope = get_today_scope(ctx);
    expect(scope.passedSlotCount).toBe(2);
    expect(scope.markableSlotCount).toBe(2);
    expect(isPassedSlot(scope.documents.find((d) => d.title === "Evening draft"), now)).toBe(false);
    expect(isMarkablePassedSlot(scope.documents.find((d) => d.title === "Moodboard"), now)).toBe(true);
  });

  it("intro copy covers empty state when no urgency or overlap", () => {
    const text = buildScheduleRecoveryIntroText({ locale: "es" });
    expect(text).toMatch(/no hay nada urgente/i);
  });

  it("intro uses plural when two problems", () => {
    const text = buildScheduleRecoveryIntroText({
      locale: "es",
      urgencyCount: 2,
      hasOverlap: true,
    });
    expect(text).toContain("dos detalles");
    expect(text).toContain("rojo claro");
    expect(text).toContain("choque de horarios");
    expect(text).toContain("Vamos a resolverlos uno por uno");
  });

  it("still offers notify for overlap when slots are already past_due", () => {
    const markedCtx = {
      ...ctx,
      nodes: {
        ...ctx.nodes,
        n1: { ...ctx.nodes.n1, status: "past_due" },
        n3: { ...ctx.nodes.n3, status: "past_due" },
      },
    };
    const today = get_today_scope(markedCtx);
    expect(today.markableSlotCount).toBe(0);
    const viz = buildGinaVisualization("today", today, {
      userText: "Muéstrame los horarios de hoy",
      now,
      locale: "es",
    });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz.data.hasRecoveryOffer).toBe(true);
    expect(viz.data.highlightPassedSlots).toBe(false);
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline || "").toContain("Revisé tu agenda");
  });

  it("does not offer notify when day is clean (no markable, no overlap)", () => {
    const cleanCtx = {
      ...ctx,
      nodes: {
        n5: {
          ...ctx.nodes.n5,
          status: "not_started",
        },
      },
    };
    const today = get_today_scope(cleanCtx);
    expect(today.markableSlotCount).toBe(0);
    const viz = buildGinaVisualization("today", today, {
      userText: "Muéstrame los horarios de hoy",
      now,
      locale: "es",
    });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz.data.hasRecoveryOffer).toBe(false);
  });

  it("schedule_sheet gate chips notify + omit without highlights in copy", () => {
    const today = get_today_scope(ctx);
    const viz = buildGinaVisualization("today", today, {
      userText: "Muéstrame los horarios de hoy",
      now,
      locale: "es",
    });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz.data.hasRecoveryOffer).toBe(true);
    expect(viz.data.highlightPassedSlots).toBe(false);
    expect(viz.data.recoveryPhase).toBe("gate");
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline).toContain("Revisé tu agenda");
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.map((c) => c.id)).toEqual(["recovery_notify", "skip_recovery"]);
    expect(buildScheduleRecoveryGateChips({ locale: "es" })[0].label).toBe(
      "Gina quiere informarte algo",
    );
  });

  it("notify chip opens overdue_check step first", () => {
    const routed = runGinaQueryFamily("Gina quiere informarte algo", ctx);
    expect(routed.family).toBe("schedule_recovery_brief");
    const viz = buildGinaVisualization(routed.family, routed.toolContext, { now, locale: "es" });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz.data.recoveryWizard).toBe(true);
    expect(viz.data.currentStep).toBe("overdue_check");
    expect(viz.data.highlightPassedSlots).toBe(true);
    expect(viz.data.conflictRails).toBeFalsy();
    expect(resolveRecoveryCurrentStep({
      urgencyCount: viz.data.urgencyCount,
      lateStartCount: viz.data.lateStartCount,
      hasOverlap: viz.data.hasOverlap,
    })).toBe("overdue_check");
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline).toContain("dos detalles");
    expect(headline).toContain("Vamos a resolverlos uno por uno");
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.map((c) => c.id)).toEqual([
      "mark_completed",
      "mark_past_due",
      "move_end_of_day",
      "recovery_snooze",
    ]);
    expect(chips.find((c) => c.id === "mark_completed")?.comingSoon).toBeFalsy();
    expect(chips.find((c) => c.id === "move_end_of_day")?.comingSoon).toBeFalsy();
    expect(chips.find((c) => c.id === "mark_past_due")?.primary).toBe(true);
  });

  it("recovery next advances to conflict_resolve", () => {
    const routed = runGinaQueryFamily("Seguir al siguiente paso de recuperación", ctx);
    expect(routed.family).toBe("schedule_recovery_next");
    const viz = buildGinaVisualization(routed.family, routed.toolContext, { now, locale: "es" });
    expect(viz.data.currentStep).toBe("conflict_resolve");
    expect(viz.data.conflictRails).toBeTruthy();
    expect(viz.data.highlightPassedSlots).toBe(false);
    expect(resolveRecoveryNextStep({ hasOverlap: true })).toBe("conflict_resolve");
    const step = buildScheduleRecoveryStepText({
      locale: "es",
      currentStep: "conflict_resolve",
      hasOverlap: true,
      topConflict: viz.data.topConflict,
      conflictRangeLabel: viz.data.conflictRangeLabel,
      invadedLabels: viz.data.invadedLabels,
    });
    expect(step).toMatch(/choque/i);
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.some((c) => c.id === "move_conflict_tomorrow" && c.comingSoon)).toBe(true);
    expect(chips.some((c) => c.id === "recovery_next")).toBe(true);
  });

  it("mark preview uses confirm chips and new ack copy", () => {
    const mark = runGinaQueryFamily("Marcar como vencidos los horarios pasados de hoy", ctx);
    expect(mark.family).toBe("schedule_recovery_mark");
    const viz = buildGinaVisualization(mark.family, mark.toolContext, { now, locale: "es" });
    expect(viz?.type).toBe("recovery_preview");
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline).toContain("Encontré");
    expect(headline).toContain("Vencido");
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.map((c) => c.id)).toEqual(["confirm_recovery", "skip_recovery"]);
  });

  it("postpone preview includes cascade times", () => {
    const postpone = runGinaQueryFamily("Posponer horario de hoy manteniendo el orden", ctx);
    expect(postpone.family).toBe("schedule_recovery_postpone");
    const viz = buildGinaVisualization(postpone.family, postpone.toolContext, { now, locale: "es" });
    expect(viz.data.intent).toBe("postpone_schedule");
    expect(viz.data.documents[0].proposedTime).toBeTruthy();
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline).toContain("reorganizar tu agenda");
  });

  it("routes confirm and skip/omitir", () => {
    expect(runGinaQueryFamily("Confirmar marcar vencidos", ctx).family).toBe("schedule_recovery_mark_confirm");
    expect(runGinaQueryFamily("Confirmar reagendar en cadena", ctx).family).toBe("schedule_recovery_postpone_confirm");
    expect(runGinaQueryFamily("Saltarlo", ctx).family).toBe("schedule_recovery_skip");
    expect(runGinaQueryFamily("Omitir recuperación de horario", ctx).family).toBe("schedule_recovery_skip");
  });

  it("cascade keeps order and durations", () => {
    const scope = get_today_scope(ctx);
    const cascade = buildCascadeSchedulePreview(scope.documents, now);
    expect(cascade[0].title).toBe("¿Qué es Futura Nota?");
    const d0 = new Date(cascade[0].proposedAnchorFinishAt).getTime()
      - new Date(cascade[0].proposedAnchorAt).getTime();
    expect(d0).toBe(7 * 60 * 60 * 1000);
  });

  it("warm goodbye detection", () => {
    expect(isGinaWarmGoodbye("gracias gina que tengas un buen resto del dia")).toBe(true);
    expect(buildScheduleRecoveryAck("mark_past_due", { count: 2, locale: "es" })).toContain("Encontré 2");
    expect(buildScheduleRecoveryChips({
      locale: "es",
      urgencyCount: 2,
      currentStep: "overdue_check",
    }).some((c) => c.id === "mark_past_due")).toBe(true);
    expect(buildScheduleRecoveryConfirmChips("postpone_schedule", { locale: "es" })[1].label).toBe("Omitir");
    expect(buildPassedSlotSignals(get_today_scope(ctx).documents, now).passedSlots).toHaveLength(2);
  });

  it("day-start copy after recovery names the first pending doc", () => {
    expect(buildDayStartAfterRecoveryText({
      firstPendingTitle: "Blogs PM",
      locale: "es",
    })).toContain("Tu día empieza por **Blogs PM**");
    expect(buildDayStartAfterRecoveryText({
      firstPendingTitle: "Blogs PM",
      locale: "en",
    })).toContain("Your day starts with **Blogs PM**");
  });

  it("brief alias matches intro plural framing", () => {
    const text = buildScheduleRecoveryBriefText({
      locale: "es",
      urgencyCount: 2,
      hasOverlap: true,
    });
    expect(text).toContain("dos detalles");
    expect(text).toContain("Vamos a resolverlos uno por uno");
  });

  it("overdue step chips include live completed / move / snooze", () => {
    const chips = buildScheduleRecoveryChips({
      locale: "es",
      urgencyCount: 1,
      hasOverlap: true,
      currentStep: "overdue_check",
    });
    expect(chips.some((c) => c.id === "mark_past_due")).toBe(true);
    expect(chips.some((c) => c.id === "mark_completed" && !c.comingSoon)).toBe(true);
    expect(chips.some((c) => c.id === "move_end_of_day" && !c.comingSoon)).toBe(true);
    expect(chips.some((c) => c.id === "recovery_snooze")).toBe(true);
  });

  it("partitions today by clock into expired / late-start / future", () => {
    const scope = get_today_scope(ctx);
    const triage = partitionTodayByClock(scope.documents, now);
    expect(triage.fullyExpired.map((d) => d.id).sort()).toEqual(["n1", "n3"]);
    expect(triage.lateStartActive).toHaveLength(0);
    expect(triage.future.map((d) => d.id)).toEqual(["n5"]);
    expect(triage.actionable.map((d) => d.id).sort()).toEqual(["n1", "n3"]);
  });

  it("late-start triage drives overdue step even without fully expired", () => {
    const lateNow = new Date("2026-08-01T18:30:00");
    const lateCtx = {
      ...ctx,
      now: lateNow,
      nodes: {
        ...ctx.nodes,
        n1: { ...ctx.nodes.n1, status: "completed", completed: true },
        n3: { ...ctx.nodes.n3, status: "completed", completed: true },
        n5: {
          ...ctx.nodes.n5,
          anchorAt: "2026-08-01T17:00:00",
          anchorFinishAt: "2026-08-01T20:00:00",
          status: "not_started",
        },
      },
    };
    const scope = get_today_scope(lateCtx);
    const triage = partitionTodayByClock(scope.documents, lateNow);
    expect(triage.lateStartActive.map((d) => d.id)).toEqual(["n5"]);
    expect(resolveRecoveryCurrentStep({
      urgencyCount: 0,
      lateStartCount: triage.lateStartActive.length,
      hasOverlap: false,
    })).toBe("overdue_check");
    const step = buildScheduleRecoveryStepText({
      locale: "es",
      currentStep: "overdue_check",
      lateStartCount: 1,
      lateStartLabels: [{ label: "Marketing", time: "5:00 PM" }],
    });
    expect(step).toMatch(/programado iniciar/i);
    expect(step).toMatch(/En Progreso/i);
  });

  it("routes completed / snooze / picker / apply intents", () => {
    expect(runGinaQueryFamily(
      "Marcar como completados los bloques vencidos de hoy",
      ctx,
    ).family).toBe("schedule_recovery_complete");
    expect(runGinaQueryFamily(
      "Confirmar marcar como completados",
      ctx,
    ).family).toBe("schedule_recovery_complete_confirm");
    expect(runGinaQueryFamily(
      "Posponer recordatorio de recuperación de horario",
      ctx,
    ).family).toBe("schedule_recovery_snooze");
    expect(runGinaQueryFamily(
      "Reagendar bloques vencidos mostrar cupos libres",
      ctx,
    ).family).toBe("schedule_recovery_reschedule_pick");
    expect(runGinaQueryFamily(
      "Aplicar cupo reagendado 2026-08-01T21:00:00.000Z|2026-08-01T22:00:00.000Z",
      ctx,
    ).family).toBe("schedule_recovery_reschedule_apply");
    expect(runGinaQueryFamily(
      "Mover bloques de recuperación a mañana por la mañana",
      ctx,
    ).toolContext?.mode).toBe("tomorrow");
    expect(runGinaQueryFamily(
      "Forzar inserción de bloques al final de la noche",
      ctx,
    ).toolContext?.mode).toBe("force_end");
  });

  it("builds schedule_slot_picker viz and no-cupo chips", () => {
    const pick = runGinaQueryFamily("Reagendar bloques vencidos mostrar cupos libres", ctx);
    const viz = buildGinaVisualization(pick.family, {
      ...pick.toolContext,
      nodes: ctx.nodes,
      docs: ctx.docs,
    }, { now, locale: "es" });
    expect(viz?.type).toBe("schedule_slot_picker");
    expect(Array.isArray(viz.data.moveDocIds)).toBe(true);
    expect(viz.data.moveDocIds.length).toBeGreaterThan(0);
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    if (viz.data.noCupo || !viz.data.hasFreeSlot) {
      expect(chips.some((c) => c.id === "reschedule_tomorrow")).toBe(true);
      expect(chips.some((c) => c.id === "force_end_of_night")).toBe(true);
      expect(chips.some((c) => c.id === "compress_coming_soon" && c.comingSoon)).toBe(true);
      expect(buildReschedulePickerText({ locale: "es", hasFreeSlot: false })).toMatch(/lleno/i);
    } else {
      expect(chips.some((c) => c.id === "apply_suggested_slot" || c.id === "recovery_next")).toBe(true);
    }
    expect(buildRescheduleAppliedText({ locale: "es", timeLabel: "9:00 PM – 10:00 PM" })).toMatch(/Reagendé/);
    expect(buildRecoverySnoozeText({ locale: "es" })).toMatch(/45 minutos/);
  });

  it("findFirstFreeSlot skips occupied ranges", () => {
    const dayEnd = new Date("2026-08-01T23:59:59").getTime();
    const from = new Date("2026-08-01T16:00:00").getTime();
    const occupied = [
      { startMs: new Date("2026-08-01T16:00:00").getTime(), finishMs: new Date("2026-08-01T18:00:00").getTime() },
      { startMs: new Date("2026-08-01T18:00:00").getTime(), finishMs: new Date("2026-08-01T20:00:00").getTime() },
    ];
    const free = findFirstFreeSlot(occupied, 60 * 60 * 1000, from, dayEnd);
    expect(free).toBeTruthy();
    expect(new Date(free.startMs).getHours()).toBe(20);
  });
});
