import { describe, expect, it } from "vitest";
import {
  buildCascadeSchedulePreview,
  buildDayStartAfterRecoveryText,
  buildPassedSlotSignals,
  buildRecoverySnoozeText,
  parseRecoverySnoozeProtocol,
  buildRescheduleAppliedText,
  buildRescheduleBatchApplyProtocol,
  buildReschedulePickerText,
  buildRescheduleForkChips,
  buildRescheduleForkText,
  buildRescheduleProgressText,
  buildScheduleRecoveryAck,
  buildScheduleRecoveryBriefText,
  buildScheduleRecoveryChips,
  buildScheduleRecoveryConfirmChips,
  buildScheduleRecoveryGateChips,
  buildScheduleRecoveryIntroText,
  buildScheduleRecoveryStepText,
  buildRecoveryEasyLinksLegend,
  isGinaWarmGoodbye,
  isMarkablePassedSlot,
  isPassedSlot,
  resolveRecoveryCurrentStep,
  resolveRecoveryNextStep,
} from "./ginaScheduleRecovery.js";
import {
  partitionTodayByClock,
  findFirstFreeSlot,
  formatLateStartDelay,
  resolveRecoveryOfferMode,
} from "./ginaTodayTimeTriage.js";
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
      "move_end_of_day",
      "mark_completed",
      "mark_past_due",
    ]);
    expect(chips.find((c) => c.id === "mark_completed")?.comingSoon).toBeFalsy();
    expect(chips.find((c) => c.id === "move_end_of_day")?.comingSoon).toBeFalsy();
    expect(chips.find((c) => c.id === "move_end_of_day")?.primary).toBe(true);
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

  it("overdue step chips include live completed / move (snooze is menu)", () => {
    const chips = buildScheduleRecoveryChips({
      locale: "es",
      urgencyCount: 1,
      hasOverlap: true,
      currentStep: "overdue_check",
    });
    expect(chips.some((c) => c.id === "mark_past_due")).toBe(true);
    expect(chips.some((c) => c.id === "mark_completed" && !c.comingSoon)).toBe(true);
    expect(chips.some((c) => c.id === "move_end_of_day" && !c.comingSoon)).toBe(true);
    expect(chips.find((c) => c.id === "move_end_of_day")?.primary).toBe(true);
    expect(chips.some((c) => c.id === "recovery_snooze")).toBe(false);
  });

  it("partitions today by clock into expired / late-start / future", () => {
    const scope = get_today_scope(ctx);
    const triage = partitionTodayByClock(scope.documents, now);
    expect(triage.fullyExpired.map((d) => d.id).sort()).toEqual(["n1", "n3"]);
    expect(triage.lateStartActive).toHaveLength(0);
    expect(triage.future.map((d) => d.id)).toEqual(["n5"]);
    expect(triage.actionable.map((d) => d.id).sort()).toEqual(["n1", "n3"]);
    expect(resolveRecoveryOfferMode({ urgencyCount: 2, lateStartCount: 0 })).toBe("expired");
    expect(resolveRecoveryOfferMode({ urgencyCount: 0, lateStartCount: 1 })).toBe("late_start");
    expect(resolveRecoveryOfferMode({ urgencyCount: 1, lateStartCount: 1 })).toBe("mixed");
    expect(formatLateStartDelay("2026-08-01T17:00:00", new Date("2026-08-01T18:30:00"), "es"))
      .toBe("1 h 30 min");
  });

  it("recovery brief moveDocIds are only fully expired (not late-start)", () => {
    const lateNow = new Date("2026-08-01T18:30:00");
    const lateCtx = {
      ...ctx,
      now: lateNow,
      nodes: {
        ...ctx.nodes,
        n5: {
          ...ctx.nodes.n5,
          anchorAt: "2026-08-01T17:00:00",
          anchorFinishAt: "2026-08-01T20:00:00",
          status: "not_started",
        },
      },
    };
    const scope = get_today_scope(lateCtx);
    const brief = runGinaQueryFamily("Gina quiere informarte algo", lateCtx);
    // Prefer explicit brief family if available
    const family = brief.family === "schedule_recovery_brief"
      ? brief.family
      : "schedule_recovery_brief";
    const viz = buildGinaVisualization(family, {
      ...scope,
      documents: scope.documents,
      nodes: lateCtx.nodes,
      docs: lateCtx.docs,
    }, { now: lateNow, locale: "es" });
    expect(viz?.data?.recoveryOfferMode).toBe("mixed");
    expect(viz?.data?.moveDocIds?.sort()).toEqual(["n1", "n3"]);
    expect(viz?.data?.moveDocIds).not.toContain("n5");
    expect(viz?.data?.cascadeMoveDocIds?.sort()).toEqual(["n1", "n3", "n5"]);
    // First overdue table = expired only (no late-start n5 mixed in)
    expect(viz?.data?.documents?.map((d) => d.id).sort()).toEqual(["n1", "n3"]);
    expect(viz?.data?.playHighlightsSound).toBe(true);
    expect(viz?.data?.highlightPassedSlots).toBe(true);

    const lateOnlyCtx = {
      ...lateCtx,
      nodes: {
        ...lateCtx.nodes,
        n1: { ...lateCtx.nodes.n1, status: "completed", completed: true },
        n3: { ...lateCtx.nodes.n3, status: "completed", completed: true },
      },
    };
    const lateScope = get_today_scope(lateOnlyCtx);
    const lateViz = buildGinaVisualization("schedule_recovery_brief", {
      ...lateScope,
      documents: lateScope.documents,
      nodes: lateOnlyCtx.nodes,
      docs: lateOnlyCtx.docs,
    }, { now: lateNow, locale: "es" });
    expect(lateViz?.data?.recoveryOfferMode).toBe("late_start");
    expect(lateViz?.data?.moveDocIds).toEqual([]);
    const blockedPick = buildGinaVisualization("schedule_recovery_reschedule_pick", {
      ...lateScope,
      documents: lateScope.documents,
      nodes: lateOnlyCtx.nodes,
      docs: lateOnlyCtx.docs,
      moveDocIds: ["n5"],
    }, { now: lateNow, locale: "es" });
    expect(blockedPick?.data?.rescheduleBlockedActive).toBe(true);
    expect(blockedPick?.type).toBe("schedule_sheet");
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
          title: "Evening draft",
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
      urgencyCount: 0,
      lateStartCount: 1,
      recoveryOfferMode: "late_start",
      lateStartLabels: [{
        label: "Marketing",
        title: "Evening draft",
        time: "5:00 PM",
        delay: "1 h 30 min",
      }],
    });
    expect(step).toMatch(/\*\*Evening draft\*\*/);
    expect(step).toMatch(/1 h 30 min/);
    expect(step).toMatch(/\*\*«Sin empezar»\*\*/);
    expect(step).toMatch(/retomarlo/i);
    expect(step).not.toMatch(/Ambos/);
    expect(step).not.toMatch(/ya pasó de hora/);
    expect(step).not.toMatch(/¿Cómo deseas proceder/);
    const plural = buildScheduleRecoveryStepText({
      locale: "es",
      currentStep: "overdue_check",
      urgencyCount: 0,
      lateStartCount: 2,
      recoveryOfferMode: "late_start",
      lateStartLabels: [
        { label: "Sales", title: "A", time: "4:45 PM", delay: "45 minutos" },
        { label: "PDN", title: "B", time: "5:00 PM", delay: "30 minutos" },
      ],
    });
    expect(plural).toMatch(/Estos documentos/);
    expect(plural).toMatch(/retomarlos/i);
    const expiredStep = buildScheduleRecoveryStepText({
      locale: "es",
      currentStep: "overdue_check",
      urgencyCount: 1,
      overdueTitles: ["Blogs AM"],
      lateStartCount: 0,
      recoveryOfferMode: "expired",
    });
    expect(expiredStep).toMatch(/El documento \*\*Blogs AM\*\* ya pasó de hora/);
    const chips = buildScheduleRecoveryChips({
      locale: "es",
      urgencyCount: 0,
      lateStartCount: 1,
      recoveryOfferMode: "late_start",
      openDocId: "n5",
      openDocTitle: "Evening draft",
      currentStep: "overdue_check",
    });
    expect(chips.find((c) => c.id === "move_end_of_day")).toBeUndefined();
    expect(chips.find((c) => c.id === "mark_completed")).toBeUndefined();
    expect(chips.find((c) => c.id === "mark_past_due")).toBeUndefined();
    expect(chips.find((c) => c.id === "mark_in_progress_batch")).toBeTruthy();
    expect(chips.find((c) => c.id === "open_late_start_doc")?.text).toBe("GinaRevealDocument:n5");
    expect(chips.find((c) => c.id === "recovery_snooze")).toBeUndefined();
    const lateLegend = buildRecoveryEasyLinksLegend({
      locale: "es",
      recoveryOfferMode: "late_start",
      openDocId: "n5",
    });
    expect(lateLegend.map((r) => r.id)).toEqual([
      "mark_in_progress_batch",
      "open_late_start_doc",
      "recovery_snooze",
    ]);
    expect(lateLegend.find((r) => r.id === "recovery_snooze")?.control).toBe("snooze_menu");
    const expiredLegend = buildRecoveryEasyLinksLegend({
      locale: "es",
      recoveryOfferMode: "expired",
    });
    expect(expiredLegend.map((r) => r.id)).toEqual([
      "move_end_of_day",
      "mark_completed",
      "mark_past_due",
      "recovery_snooze",
    ]);
    expect(expiredLegend[0].tier).toBe("star");
    expect(expiredLegend[0].control).toBe("link");
    expect(expiredLegend[0].ctaLabel).toBe("Ajustar agenda");
    expect(expiredLegend.filter((r) => r.statusKey).map((r) => r.statusKey)).toEqual([
      "completed",
      "past_due",
    ]);
    expect(expiredLegend.find((r) => r.id === "recovery_snooze")?.title).toMatch(/Posponer Recordatorio/i);
    expect(expiredLegend.find((r) => r.id === "recovery_snooze")?.title).not.toMatch(/45/);
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
      "Posponer recordatorio de recuperación 15m",
      ctx,
    ).toolContext?.snoozeMinutes).toBe(15);
    expect(runGinaQueryFamily(
      "Posponer recordatorio de recuperación 60m",
      ctx,
    ).toolContext?.snoozeMinutes).toBe(60);
    expect(runGinaQueryFamily(
      "Posponer recordatorio de recuperación hasta hueco libre",
      ctx,
    ).toolContext?.snoozeUntilFreeGap).toBe(true);
    expect(runGinaQueryFamily(
      "Posponer recordatorio de recuperación hasta 18:30",
      ctx,
    ).toolContext?.snoozeUntilHhmm).toBe("18:30");
    expect(parseRecoverySnoozeProtocol("Posponer recordatorio de recuperación 30m")).toEqual({
      match: true,
      minutes: 30,
      untilHhmm: null,
      untilFreeGap: false,
    });
    expect(buildRecoverySnoozeText({ locale: "es", minutes: 15 })).toMatch(/15 minutos/);
    expect(buildRecoverySnoozeText({ locale: "es", untilLabel: "6:30 PM" })).toMatch(/6:30 PM/);
    expect(runGinaQueryFamily(
      "Reagendar para hoy",
      ctx,
    ).family).toBe("schedule_recovery_reschedule_fork");
    expect(runGinaQueryFamily(
      "Mover en cascada los bloques desde ahora",
      ctx,
    )).toMatchObject({
      family: "schedule_recovery_reschedule_pick",
      toolContext: expect.objectContaining({ rescheduleMode: "cascade" }),
    });
    expect(runGinaQueryFamily(
      "Reagendar bloques vencidos mostrar cupos libres",
      ctx,
    )).toMatchObject({
      family: "schedule_recovery_reschedule_pick",
      toolContext: expect.objectContaining({ rescheduleMode: "gaps" }),
    });
    const applyOne = runGinaQueryFamily(
      "Aplicar cupo reagendado n1|2026-08-01T21:00:00.000Z|2026-08-01T22:00:00.000Z|n1,n3",
      ctx,
    );
    expect(applyOne.family).toBe("schedule_recovery_reschedule_apply");
    expect(applyOne.toolContext?.applyDocId).toBe("n1");
    expect(applyOne.toolContext?.sessionMoveDocIds).toEqual(["n1", "n3"]);
    expect(applyOne.toolContext?.batchApplies).toEqual([
      {
        id: "n1",
        startIso: "2026-08-01T21:00:00.000Z",
        finishIso: "2026-08-01T22:00:00.000Z",
      },
    ]);
    const applyBatch = runGinaQueryFamily(
      "Aplicar cambios reagendados n1|2026-08-01T21:00:00.000Z|2026-08-01T22:00:00.000Z;n3|2026-08-01T22:00:00.000Z|2026-08-01T22:30:00.000Z|n1,n3",
      ctx,
    );
    expect(applyBatch.family).toBe("schedule_recovery_reschedule_apply");
    expect(applyBatch.toolContext?.batchApplies).toEqual([
      {
        id: "n1",
        startIso: "2026-08-01T21:00:00.000Z",
        finishIso: "2026-08-01T22:00:00.000Z",
      },
      {
        id: "n3",
        startIso: "2026-08-01T22:00:00.000Z",
        finishIso: "2026-08-01T22:30:00.000Z",
      },
    ]);
    expect(applyBatch.toolContext?.sessionMoveDocIds).toEqual(["n1", "n3"]);
    expect(buildRescheduleBatchApplyProtocol(
      [
        { id: "n1", startIso: "a", finishIso: "b" },
        { id: "n3", startIso: "c", finishIso: "d" },
      ],
      ["n1", "n3"],
    )).toBe("Aplicar cambios reagendados n1|a|b;n3|c|d|n1,n3");
    expect(runGinaQueryFamily(
      "Mover bloques de recuperación a mañana por la mañana",
      ctx,
    ).toolContext?.mode).toBe("tomorrow");
    expect(runGinaQueryFamily(
      "Forzar inserción de bloques al final de la noche",
      ctx,
    ).toolContext?.mode).toBe("force_end");
  });

  it("builds schedule_slot_picker per-doc loop (no suggested mass chip)", () => {
    const pick = runGinaQueryFamily("Reagendar bloques vencidos mostrar cupos libres", ctx);
    const viz = buildGinaVisualization(pick.family, {
      ...pick.toolContext,
      nodes: ctx.nodes,
      docs: ctx.docs,
    }, { now, locale: "es" });
    expect(viz?.type).toBe("schedule_slot_picker");
    expect(viz.data.rescheduleMode).toBe("gaps");
    expect(Array.isArray(viz.data.moveDocIds)).toBe(true);
    expect(viz.data.moveDocIds.length).toBeGreaterThan(0);
    expect(viz.data.activeDocId).toBeTruthy();
    expect(viz.data.progress?.total).toBe(viz.data.moveDocIds.length);
    // Occupied excludes only the active doc
    expect(viz.data.occupied.every((o) => o.id !== viz.data.activeDocId)).toBe(true);
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.some((c) => c.id === "apply_suggested_slot")).toBe(false);
    expect(chips.some((c) => c.id === "recovery_next")).toBe(true);
    if (viz.data.noCupo) {
      expect(chips.some((c) => c.id === "reschedule_tomorrow")).toBe(true);
      expect(chips.some((c) => c.id === "force_end_of_night")).toBe(true);
      expect(chips.some((c) => c.id === "compress_coming_soon" && c.comingSoon)).toBe(true);
    }
    expect(buildReschedulePickerText({ locale: "es" })).toMatch(/Elige uno/i);
    expect(buildReschedulePickerText({ locale: "es", noCupo: true, activeTitle: "Blogs" }))
      .toMatch(/Sin cupo libre hoy para \*\*Blogs\*\*/i);
    expect(buildRescheduleProgressText({
      locale: "es",
      title: "Blogs",
      timeLabel: "9:00 PM – 10:00 PM",
      nextTitle: "Sales",
      remaining: 1,
    })).toMatch(/Siguiente: elige el cupo para \*\*Sales\*\*/);
    expect(buildRescheduleAppliedText({ locale: "es", timeLabel: "9:00 PM – 10:00 PM" })).toMatch(/Reagendé/);
    expect(buildRecoverySnoozeText({ locale: "es" })).toMatch(/siguiente revisión/);
  });

  it("forks reschedule and seeds cascade drafts", () => {
    expect(buildRescheduleForkText({ locale: "es" })).toMatch(/Cascada/i);
    const forkChips = buildRescheduleForkChips({ locale: "es" });
    expect(forkChips.map((c) => c.id)).toEqual(["reschedule_cascade", "reschedule_gaps"]);
    expect(buildGinaReplyChips({
      family: "schedule_recovery_reschedule_fork",
      locale: "es",
    }).map((c) => c.id)).toEqual(["reschedule_cascade", "reschedule_gaps"]);

    const cascade = runGinaQueryFamily("Mover en cascada los bloques desde ahora", ctx);
    const viz = buildGinaVisualization(cascade.family, {
      ...cascade.toolContext,
      nodes: ctx.nodes,
      docs: ctx.docs,
    }, { now, locale: "es" });
    expect(viz?.type).toBe("schedule_slot_picker");
    expect(viz.data.rescheduleMode).toBe("cascade");
    expect(viz.data.noCupo).toBe(false);
    // Cascade session = all today non-completed (expired + future pending), not only fullyExpired
    expect(viz.data.moveDocIds.sort()).toEqual(["n1", "n3", "n5"]);
    const draftIds = Object.keys(viz.data.initialDrafts || {});
    expect(draftIds.length).toBe(viz.data.moveDocIds.length);
    expect(draftIds.every((id) => viz.data.moveDocIds.includes(id))).toBe(true);
    for (const id of draftIds) {
      const draft = viz.data.initialDrafts[id];
      expect(draft.startIso).toBeTruthy();
      expect(draft.finishIso).toBeTruthy();
      expect(new Date(draft.finishIso).getTime()).toBeGreaterThan(new Date(draft.startIso).getTime());
      expect(new Date(draft.startIso).getTime()).toBeGreaterThanOrEqual(now.getTime() - 15 * 60 * 1000);
    }
    // Cascade occupied excludes the whole move session
    expect(viz.data.occupied.every((o) => !viz.data.moveDocIds.includes(o.id))).toBe(true);
    expect(buildReschedulePickerText({ locale: "es", mode: "cascade" })).toMatch(/horario propuesto/i);
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.some((c) => c.id === "reschedule_tomorrow")).toBe(false);
  });

  it("gaps picker still drops non-expired from session", () => {
    const viz = buildGinaVisualization("schedule_recovery_reschedule_pick", {
      documents: get_today_scope(ctx).documents,
      nodes: ctx.nodes,
      docs: ctx.docs,
      rescheduleMode: "gaps",
      // n5 is future (not fully expired) — dropped from gaps move session
      sessionMoveDocIds: ["n1", "n3", "n5"],
      assignedDocIds: ["n1"],
      activeDocId: "n3",
    }, { now, locale: "es" });
    expect(viz.data.rescheduleMode).toBe("gaps");
    expect(viz.data.activeDocId).toBe("n3");
    expect(viz.data.moveDocIds.sort()).toEqual(["n1", "n3"]);
    expect(viz.data.moveDocs.find((d) => d.id === "n1")?.assigned).toBe(true);
    expect(viz.data.moveDocs.find((d) => d.id === "n3")?.assigned).toBe(false);
    expect(viz.data.occupied.some((o) => o.id === "n3")).toBe(false);
    expect(viz.data.progress).toEqual({ assigned: 1, total: 2, remaining: 1 });
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
