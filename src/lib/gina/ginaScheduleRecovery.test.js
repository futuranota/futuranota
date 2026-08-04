import { describe, expect, it } from "vitest";
import {
  buildCascadeSchedulePreview,
  buildPassedSlotSignals,
  buildScheduleRecoveryAck,
  buildScheduleRecoveryChips,
  buildScheduleRecoveryConfirmChips,
  buildScheduleRecoveryOfferText,
  isGinaWarmGoodbye,
  isMarkablePassedSlot,
  isPassedSlot,
} from "./ginaScheduleRecovery.js";
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

  it("offer copy names first doc and explains both options", () => {
    const text = buildScheduleRecoveryOfferText({
      firstTitle: "¿Qué es Futura Nota?",
      locale: "es",
    });
    expect(text).toContain("Oye, viendo la hora");
    expect(text).toContain("Marcar como vencidos");
    expect(text).toContain("Reagendar en cadena");
    expect(text).toContain("¿Qué es Futura Nota?");
    expect(text.trim().endsWith("(Selecciona una opción abajo para aplicar)")).toBe(true);
  });

  it("does not offer recovery when passed slots are already past_due", () => {
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
    expect(viz.data.hasRecoveryOffer).toBe(false);
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline || "").not.toContain("Oye, viendo la hora");
  });

  it("schedule_sheet offers recovery chips", () => {
    const today = get_today_scope(ctx);
    const viz = buildGinaVisualization("today", today, {
      userText: "Muéstrame los horarios de hoy",
      now,
      locale: "es",
    });
    expect(viz?.type).toBe("schedule_sheet");
    expect(viz.data.hasRecoveryOffer).toBe(true);
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline).toContain("Oye, viendo la hora");
    const chips = buildGinaReplyChips({ visualization: viz, locale: "es" });
    expect(chips.map((c) => c.id)).toEqual([
      "mark_past_due",
      "postpone_schedule",
      "today_depts",
    ]);
  });

  it("mark preview uses confirm chips and new ack copy", () => {
    const mark = runGinaQueryFamily("Marcar como vencidos los horarios pasados de hoy", ctx);
    expect(mark.family).toBe("schedule_recovery_mark");
    const viz = buildGinaVisualization(mark.family, mark.toolContext, { now, locale: "es" });
    expect(viz?.type).toBe("recovery_preview");
    const headline = buildGinaFunnelHeadline(viz, { locale: "es" });
    expect(headline).toContain("Identifiqué");
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

  it("routes confirm and skip", () => {
    expect(runGinaQueryFamily("Confirmar marcar vencidos", ctx).family).toBe("schedule_recovery_mark_confirm");
    expect(runGinaQueryFamily("Confirmar reagendar en cadena", ctx).family).toBe("schedule_recovery_postpone_confirm");
    expect(runGinaQueryFamily("Saltarlo", ctx).family).toBe("schedule_recovery_skip");
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
    expect(buildScheduleRecoveryAck("mark_past_due", { count: 2, locale: "es" })).toContain("Identifiqué 2");
    expect(buildScheduleRecoveryChips({ locale: "es" })[1].label).toBe("Reagendar en cadena");
    expect(buildScheduleRecoveryConfirmChips("postpone_schedule", { locale: "es" })[1].label).toBe("Saltarlo");
    expect(buildPassedSlotSignals(get_today_scope(ctx).documents, now).passedSlots).toHaveLength(2);
  });
});
