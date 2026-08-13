import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  acceptTalkRequest,
  clearArmedTalkRequestSoft,
  clearTalkRequest,
  declineTalkRequest,
  enableTalkNotifications,
  evaluateTalkRequestDue,
  getTalkRequestState,
  hasTalkNotificationsDecision,
  isTalkNotificationsEnabled,
  shouldShowTalkRequestPopover,
  skipTalkNotifications,
  writeTalkRequestState,
  clearTalkRequestNotifiedDocIds,
} from "./ginaTalkRequestStore.js";
import {
  buildTalkRequestNotifyPrompt,
  buildTalkRequestNotifyDisplayText,
  buildTalkRequestNotifyText,
  buildTalkRequestNotifyStartDocLines,
  formatTalkRequestAssignedTime,
  getTalkRequestTodoMock,
  listUnfinishedPriorBlocks,
  buildTalkRequestConditionText,
  parseDaySheetRescheduleIntent,
  buildTalkRequestPopoverCopy,
  buildTalkNotificationsEnableChips,
  buildTalkNotificationsOfferText,
  buildTalkNotificationsEnabledAck,
  isEnableTalkNotificationsIntent,
  isGinaTalkRequestNotifyIntent,
  isSkipTalkNotificationsIntent,
  isTalkRequestThanksIntent,
  parseTalkRequestNotifyIntent,
} from "./ginaTalkRequest.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

/** Helper: arm as if the schedule start crossed since → now. */
function evalEdge(uid, docs, now, sinceMs) {
  return evaluateTalkRequestDue(uid, docs, now, { sinceMs });
}

describe("ginaTalkRequestStore", () => {
  const uid = "talk-user";
  const now = new Date("2026-08-09T20:00:00");
  const since = now.getTime() - 15_000;

  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("does not arm starts older than catch-up (no flood of past blocks)", () => {
    enableTalkNotifications(uid, now);
    // Cold call — start 2h ago is outside catch-up
    evaluateTalkRequestDue(uid, [{
      id: "doc-past",
      title: "Past",
      anchorAt: "2026-08-09T18:00:00",
      status: "not_started",
    }], now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);

    // Edge window that does not include the start + outside catch-up → no arm
    evalEdge(uid, [{
      id: "doc-past",
      title: "Past",
      anchorAt: "2026-08-09T18:00:00",
      status: "not_started",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
  });

  it("catch-up arms a recent start when the user returns within 10 minutes", () => {
    enableTalkNotifications(uid, now);
    // Start was 5 minutes ago; last tick is *after* the start (missed edge)
    const lateSince = now.getTime() - 5_000;
    evalEdge(uid, [{
      id: "doc-recent",
      title: "Recent",
      anchorAt: "2026-08-09T19:55:00",
      status: "not_started",
    }], now, lateSince);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    expect(getTalkRequestState(uid, now)?.activeDocId).toBe("doc-recent");
  });

  it("catch-up works on cold evaluate (no sinceMs) for starts in the window", () => {
    enableTalkNotifications(uid, now);
    evaluateTalkRequestDue(uid, [{
      id: "doc-cold",
      title: "Cold",
      anchorAt: "2026-08-09T19:52:00",
      status: "not_started",
    }], now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    expect(getTalkRequestState(uid, now)?.activeDocId).toBe("doc-cold");
  });

  it("arms only when an unchecked doc’s schedule start crosses the tick window", () => {
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "doc-8pm",
      title: "Call 8pm",
      anchorAt: "2026-08-09T20:00:00",
      status: "not_started",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    expect(getTalkRequestState(uid, now)?.activeDocId).toBe("doc-8pm");
  });

  it("does not arm completed / checked docs", () => {
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "done",
      title: "Done",
      anchorAt: "2026-08-09T20:00:00",
      completed: true,
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);

    evalEdge(uid, [{
      id: "done2",
      title: "Done2",
      anchorAt: "2026-08-09T20:00:00",
      status: "completed",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
  });

  it("clears stale armed popover that was not a recent start edge", () => {
    enableTalkNotifications(uid, now);
    writeTalkRequestState(uid, {
      date: "2026-08-09",
      enabled: true,
      decided: true,
      notifiedDocIds: [],
      activeDocId: "stale",
      activeTitle: "Stale",
      armedAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
    // Soft clear (same as hook mount one-shot) — evaluate keeps active if set
    clearArmedTalkRequestSoft(uid, now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
    expect(getTalkRequestState(uid, now)?.activeDocId).toBeNull();
    expect(getTalkRequestState(uid, now)?.notifiedDocIds || []).not.toContain("stale");
  });

  it("accept and decline clear active popover but keep notifications on", () => {
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "a",
      title: "A",
      anchorAt: "2026-08-09T20:00:00",
    }], now, since);
    const accepted = acceptTalkRequest(uid, now);
    expect(accepted.docId).toBe("a");
    expect(getTalkRequestState(uid, now)?.notifiedDocIds).toContain("a");
    clearTalkRequestNotifiedDocIds(uid, ["a"], now);
    expect(getTalkRequestState(uid, now)?.notifiedDocIds || []).not.toContain("a");
    // Re-arm after the id is cleared (moved later).
    evalEdge(uid, [{
      id: "a",
      title: "A",
      anchorAt: "2026-08-09T20:00:00",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    acceptTalkRequest(uid, now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(true);

    // Same doc won’t re-arm on a later edge (notified)
    evalEdge(uid, [{
      id: "a",
      title: "A",
      anchorAt: "2026-08-09T20:00:00",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);

    // Next doc whose start crosses the window arms
    const later = new Date("2026-08-09T20:30:00");
    evalEdge(uid, [
      { id: "a", title: "A", anchorAt: "2026-08-09T20:00:00" },
      { id: "b", title: "B", anchorAt: "2026-08-09T20:30:00" },
    ], later, later.getTime() - 15_000);
    expect(getTalkRequestState(uid, later)?.activeDocId).toBe("b");

    clearTalkRequest(uid);
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "c",
      title: "C",
      anchorAt: "2026-08-09T20:00:00",
    }], now, since);
    declineTalkRequest(uid, now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(true);
  });

  it("does not arm future docs before their start", () => {
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "later",
      title: "Later",
      anchorAt: "2026-08-09T21:00:00",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
  });

  it("auto-dismisses armed popover after 10 minutes", () => {
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "doc-8pm",
      title: "Call",
      anchorAt: "2026-08-09T20:00:00",
    }], now, since);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    expect(getTalkRequestState(uid, now)?.armedAt).toBeTruthy();

    const later = new Date(now.getTime() + 10 * 60 * 1000);
    expect(shouldShowTalkRequestPopover(uid, { now: later })).toBe(false);
    expect(getTalkRequestState(uid, later)?.activeDocId).toBeNull();
    expect(getTalkRequestState(uid, later)?.notifiedDocIds).toContain("doc-8pm");
    expect(isTalkNotificationsEnabled(uid, later)).toBe(true);

    // Same doc won’t re-arm after auto-dismiss
    evalEdge(uid, [{
      id: "doc-8pm",
      title: "Call",
      anchorAt: "2026-08-09T20:00:00",
    }], later, later.getTime() - 15_000);
    expect(shouldShowTalkRequestPopover(uid, { now: later })).toBe(false);
  });

  it("keeps popover before the 10-minute window ends", () => {
    enableTalkNotifications(uid, now);
    evalEdge(uid, [{
      id: "doc-8pm",
      title: "Call",
      anchorAt: "2026-08-09T20:00:00",
    }], now, since);
    const almost = new Date(now.getTime() + 9 * 60 * 1000);
    expect(shouldShowTalkRequestPopover(uid, { now: almost })).toBe(true);
  });

  it("catch-up arms a start 2 minutes ago (1:00 → 1:02 missed edge)", () => {
    const at102 = new Date("2026-08-10T01:02:00");
    enableTalkNotifications("am-user", at102);
    // last tick was *after* 1:00 (edge already missed)
    const lateSince = at102.getTime() - 5_000;
    evaluateTalkRequestDue("am-user", [{
      id: "doc-1am",
      title: "1am block",
      anchorAt: "2026-08-10T01:00:00",
      status: "not_started",
    }], at102, { sinceMs: lateSince });
    expect(shouldShowTalkRequestPopover("am-user", { now: at102 })).toBe(true);
    expect(getTalkRequestState("am-user", at102)?.activeDocId).toBe("doc-1am");
  });

  it("cold evaluate at 1:02 still catch-up arms the 1:00 start", () => {
    const at102 = new Date("2026-08-10T01:02:00");
    enableTalkNotifications("am-user-2", at102);
    evaluateTalkRequestDue("am-user-2", [{
      id: "doc-1am",
      title: "1am block",
      anchorAt: "2026-08-10T01:00:00",
      status: "not_started",
    }], at102);
    expect(shouldShowTalkRequestPopover("am-user-2", { now: at102 })).toBe(true);
  });

  it("overnight grace: yesterday opt-in still enabled at 1:03am", () => {
    const evening = new Date("2026-08-09T22:00:00");
    enableTalkNotifications("overnight-user", evening);
    const late = new Date("2026-08-10T01:03:00");
    expect(isTalkNotificationsEnabled("overnight-user", late)).toBe(true);
    expect(getTalkRequestState("overnight-user", late)?.date).toBe("2026-08-09");
  });

  it("overnight grace ends at 06:00 — yesterday opt-in no longer loads", () => {
    const evening = new Date("2026-08-09T22:00:00");
    enableTalkNotifications("overnight-user-2", evening);
    const morning = new Date("2026-08-10T06:00:00");
    expect(isTalkNotificationsEnabled("overnight-user-2", morning)).toBe(false);
    expect(getTalkRequestState("overnight-user-2", morning)).toBeNull();
  });
});

describe("ginaTalkRequest copy + router", () => {
  it("popover copy matches Verificar / Omitir", () => {
    const en = buildTalkRequestPopoverCopy("en");
    expect(en.title).toMatch(/next task is ready on the agenda/i);
    expect(en.titleEmph).toBe("Your");
    expect(en.titleMuted).toMatch(/next task is ready/i);
    expect(en.accept).toBe("verify");
    expect(en.decline).toBe("skip");
    const es = buildTalkRequestPopoverCopy("es");
    expect(es.title).toMatch(/siguiente tarea ya está lista en la agenda/i);
    expect(es.titleEmph).toBe("Tu");
    expect(es.titleMuted).toMatch(/siguiente tarea ya está lista en la agenda/i);
    expect(es.accept).toBe("verificar");
    expect(es.decline).toBe("omitir");
  });

  it("offer chips enable / skip notifications", () => {
    const chips = buildTalkNotificationsEnableChips({ locale: "es" });
    expect(chips.map((c) => c.id)).toEqual([
      "enable_day_notifications",
      "skip_day_notifications",
    ]);
    expect(chips[0].label).toBe("activar notificaciones");
    expect(chips[1].label).toBe("prefiero chequear por mi cuenta");
    expect(buildTalkNotificationsOfferText("es")).toMatch(/¿Activamos avisos en vivo\?/i);
    expect(buildTalkNotificationsOfferText("es")).toMatch(/al inicio de cada tarea/i);
    expect(isEnableTalkNotificationsIntent(chips[0].text)).toBe(true);
    expect(isSkipTalkNotificationsIntent(chips[1].text)).toBe(true);
  });

  it("enabled ack is on-screen new-block copy", () => {
    expect(buildTalkNotificationsEnabledAck("es")).toMatch(/Entendido/i);
    expect(buildTalkNotificationsEnabledAck("es")).toMatch(/nuevo bloque de trabajo/i);
  });

  it("skip marks decision without enabling notifications", () => {
    const skipUid = "talk-skip";
    const skipNow = new Date("2026-08-09T18:00:00");
    skipTalkNotifications(skipUid, skipNow);
    expect(hasTalkNotificationsDecision(skipUid, skipNow)).toBe(true);
    expect(isTalkNotificationsEnabled(skipUid, skipNow)).toBe(false);
  });

  it("notify text is short intro (fields go in startDocLines)", () => {
    const text = buildTalkRequestNotifyText({ locale: "es" });
    expect(text).toMatch(/¿Estás listo para comenzar\?/i);
    expect(text).toMatch(/Es hora de tu siguiente bloque agendado/i);
    expect(text).not.toMatch(/comienza pronto/i);
  });

  it("notify startDocLines highlight Departamento / Documento / horario / tiempo", () => {
    const lines = buildTalkRequestNotifyStartDocLines({
      title: "Blogs",
      department: "Marketing",
      category: "Content",
      timeClock: "7:00 PM – 7:30 PM",
      anchorAt: "2026-08-13T14:00:00",
      anchorFinishAt: "2026-08-13T16:00:00",
    }, "es");
    expect(lines.map((r) => r.label)).toEqual([
      "Departamento",
      "Documento",
      "horario",
      "tiempo asignado",
    ]);
    expect(lines[0].value).toContain("Marketing");
    expect(lines[1].value).toBe("Blogs");
    expect(lines[2].value).toMatch(/7:00/);
    expect(lines[3].value).toBe("2 horas");
  });

  it("formats assigned time from the schedule window", () => {
    expect(formatTalkRequestAssignedTime({
      anchorAt: "2026-08-13T14:00:00",
      anchorFinishAt: "2026-08-13T16:00:00",
    }, "es")).toBe("2 horas");
    expect(formatTalkRequestAssignedTime({
      anchorAt: "2026-08-13T09:00:00",
      anchorFinishAt: "2026-08-13T09:30:00",
    }, "es")).toBe("30 minutos");
  });

  it("todo mock is fixed 0/3 example copy", () => {
    const mock = getTalkRequestTodoMock("es");
    expect(mock.done).toBe(0);
    expect(mock.total).toBe(3);
    expect(mock.items).toHaveLength(3);
    expect(mock.title).toMatch(/0\/3/);
  });

  it("lists unfinished prior blocks and builds condition copy", () => {
    const current = {
      id: "n2",
      title: "Horizon blog title 2",
      anchorAt: "2026-08-13T14:00:00",
      status: "not_started",
    };
    const docs = [
      {
        id: "n1",
        title: "Horizon blog title 1",
        anchorAt: "2026-08-13T09:00:00",
        status: "in_progress",
      },
      current,
      {
        id: "n0",
        title: "Done earlier",
        anchorAt: "2026-08-13T08:00:00",
        status: "completed",
      },
    ];
    const prior = listUnfinishedPriorBlocks(docs, current);
    expect(prior.map((d) => d.title)).toEqual(["Horizon blog title 1"]);
    const withPrior = buildTalkRequestConditionText({
      locale: "es",
      currentTitle: current.title,
      priorTitles: prior.map((d) => d.title),
    });
    expect(withPrior).toMatch(/bloque anterior/i);
    expect(withPrior).toContain("[ Horizon blog title 1 ]");
    expect(withPrior).toContain("[ Horizon blog title 2 ]");
    const caughtUp = buildTalkRequestConditionText({
      locale: "es",
      currentTitle: current.title,
      priorTitles: [],
    });
    expect(caughtUp).toMatch(/Todo al día/i);
  });

  it("parses selected-row reschedule protocol", () => {
    expect(parseDaySheetRescheduleIntent("GinaDaySheetReschedule:a,b")).toEqual({
      match: true,
      docIds: ["a", "b"],
    });
    expect(parseDaySheetRescheduleIntent("Reagendar para hoy").match).toBe(false);
  });

  it("routes enable opt-in to gina_talk_notifications_enable", () => {
    const routed = runGinaQueryFamily(
      "Actívame las notificaciones para hoy mientras trabajo",
      {
        now: new Date("2026-08-09T18:00:00"),
        userId: "talk-user",
        nodes: {},
        docs: {},
        departments: [],
      },
    );
    expect(routed.family).toBe("gina_talk_notifications_enable");
    expect(isTalkNotificationsEnabled("talk-user", new Date("2026-08-09T18:00:00"))).toBe(true);
  });

  it("routes Accept prompt to gina_talk_request with doc id", () => {
    const prompt = buildTalkRequestNotifyPrompt("es", "doc-1");
    expect(prompt).toBe("GinaTalkRequestNotify:doc-1");
    expect(isGinaTalkRequestNotifyIntent(prompt)).toBe(true);
    const routed = runGinaQueryFamily(prompt, {
      now: new Date("2026-08-09T18:00:00"),
      userId: "talk-user",
      nodes: {},
      docs: {},
      departments: [],
    });
    expect(routed.family).toBe("gina_talk_request");
  });

  it("preserves UPPERCASE generateId casing in notify prompt parse", () => {
    const id = "NODE-M9ABC123XYZ";
    const prompt = buildTalkRequestNotifyPrompt("es", id);
    expect(prompt).toBe(`GinaTalkRequestNotify:${id}`);
    const parsed = parseTalkRequestNotifyIntent(prompt);
    expect(parsed.match).toBe(true);
    expect(parsed.docId).toBe(id);
  });

  it("friendly display label stays readable (not the protocol)", () => {
    expect(buildTalkRequestNotifyDisplayText("es")).toMatch(/Notificación próximo documento/i);
    expect(buildTalkRequestNotifyDisplayText("en")).toMatch(/Next document notification/i);
  });

  it("routes Ok gracias thanks", () => {
    expect(isTalkRequestThanksIntent("Ok gracias")).toBe(true);
    const routed = runGinaQueryFamily("Ok gracias", {
      now: new Date("2026-08-09T18:00:00"),
      userId: "talk-user",
      nodes: {},
      docs: {},
      departments: [],
    });
    expect(routed.family).toBe("gina_talk_request_thanks");
  });

  it("routes selected-row reschedule to cascade picker", () => {
    const routed = runGinaQueryFamily("GinaDaySheetReschedule:n1,n2", {
      now: new Date("2026-08-09T18:00:00"),
      userId: "talk-user",
      nodes: {},
      docs: {},
      departments: [],
    });
    expect(routed.family).toBe("schedule_recovery_reschedule_pick");
    expect(routed.toolContext.rescheduleMode).toBe("cascade");
    expect(routed.toolContext.cascadeMoveDocIds).toEqual(["n1", "n2"]);
  });
});
