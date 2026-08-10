import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  acceptTalkRequest,
  clearTalkRequest,
  declineTalkRequest,
  enableTalkNotifications,
  evaluateTalkRequestDue,
  getTalkRequestState,
  hasTalkNotificationsDecision,
  isTalkNotificationsEnabled,
  shouldShowTalkRequestPopover,
  skipTalkNotifications,
} from "./ginaTalkRequestStore.js";
import {
  buildTalkRequestNotifyPrompt,
  buildTalkRequestNotifyText,
  buildTalkRequestPopoverCopy,
  buildTalkNotificationsEnableChips,
  buildTalkNotificationsOfferText,
  isEnableTalkNotificationsIntent,
  isGinaTalkRequestNotifyIntent,
  isSkipTalkNotificationsIntent,
  isTalkRequestThanksIntent,
} from "./ginaTalkRequest.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("ginaTalkRequestStore", () => {
  const uid = "talk-user";
  const now = new Date("2026-08-09T20:00:00");

  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("does not show popover until opt-in and a doc start is due", () => {
    expect(isTalkNotificationsEnabled(uid, now)).toBe(false);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);

    enableTalkNotifications(uid, now);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(true);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);

    evaluateTalkRequestDue(uid, [{
      id: "doc-8pm",
      title: "Call 8pm",
      anchorAt: "2026-08-09T20:00:00",
      status: "not_started",
    }], now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    expect(getTalkRequestState(uid, now)?.activeDocId).toBe("doc-8pm");
  });

  it("accept and decline clear active popover but keep notifications on", () => {
    enableTalkNotifications(uid, now);
    evaluateTalkRequestDue(uid, [{
      id: "a",
      title: "A",
      anchorAt: "2026-08-09T19:00:00",
    }], now);
    const accepted = acceptTalkRequest(uid, now);
    expect(accepted.docId).toBe("a");
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(true);

    // Same doc won’t re-arm
    evaluateTalkRequestDue(uid, [{
      id: "a",
      title: "A",
      anchorAt: "2026-08-09T19:00:00",
    }], now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);

    // Next due doc arms again
    evaluateTalkRequestDue(uid, [
      { id: "a", title: "A", anchorAt: "2026-08-09T19:00:00" },
      { id: "b", title: "B", anchorAt: "2026-08-09T20:00:00" },
    ], now);
    expect(getTalkRequestState(uid, now)?.activeDocId).toBe("b");

    clearTalkRequest(uid);
    enableTalkNotifications(uid, now);
    evaluateTalkRequestDue(uid, [{
      id: "c",
      title: "C",
      anchorAt: "2026-08-09T19:30:00",
    }], now);
    declineTalkRequest(uid, now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(true);
  });

  it("does not arm future docs before their start", () => {
    enableTalkNotifications(uid, now);
    evaluateTalkRequestDue(uid, [{
      id: "later",
      title: "Later",
      anchorAt: "2026-08-09T21:00:00",
    }], now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(false);
  });

  it("auto-dismisses armed popover after 10 minutes", () => {
    enableTalkNotifications(uid, now);
    evaluateTalkRequestDue(uid, [{
      id: "doc-8pm",
      title: "Call",
      anchorAt: "2026-08-09T20:00:00",
    }], now);
    expect(shouldShowTalkRequestPopover(uid, { now })).toBe(true);
    expect(getTalkRequestState(uid, now)?.armedAt).toBeTruthy();

    const later = new Date(now.getTime() + 10 * 60 * 1000);
    expect(shouldShowTalkRequestPopover(uid, { now: later })).toBe(false);
    expect(getTalkRequestState(uid, later)?.activeDocId).toBeNull();
    expect(getTalkRequestState(uid, later)?.notifiedDocIds).toContain("doc-8pm");
    expect(isTalkNotificationsEnabled(uid, later)).toBe(true);

    // Same doc won’t re-arm after auto-dismiss
    evaluateTalkRequestDue(uid, [{
      id: "doc-8pm",
      title: "Call",
      anchorAt: "2026-08-09T20:00:00",
    }], later);
    expect(shouldShowTalkRequestPopover(uid, { now: later })).toBe(false);
  });

  it("keeps popover before the 10-minute window ends", () => {
    enableTalkNotifications(uid, now);
    evaluateTalkRequestDue(uid, [{
      id: "doc-8pm",
      title: "Call",
      anchorAt: "2026-08-09T20:00:00",
    }], now);
    const almost = new Date(now.getTime() + 9 * 60 * 1000);
    expect(shouldShowTalkRequestPopover(uid, { now: almost })).toBe(true);
  });
});

describe("ginaTalkRequest copy + router", () => {
  it("popover copy matches Accept / Decline mock", () => {
    const en = buildTalkRequestPopoverCopy("en");
    expect(en.title).toMatch(/requesting to talk/i);
    expect(en.accept).toBe("accept");
    expect(en.decline).toBe("Decline");
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
    expect(isEnableTalkNotificationsIntent(chips[0].text)).toBe(true);
    expect(isSkipTalkNotificationsIntent(chips[1].text)).toBe(true);
  });

  it("skip marks decision without enabling notifications", () => {
    const uid = "talk-skip";
    const now = new Date("2026-08-09T18:00:00");
    skipTalkNotifications(uid, now);
    expect(hasTalkNotificationsDecision(uid, now)).toBe(true);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(false);
  });

  it("notify text mentions current task and next document", () => {
    const text = buildTalkRequestNotifyText({
      locale: "es",
      nextTitle: "Blogs",
      nextTimeLabel: "7:00 PM – 7:30 PM",
    });
    expect(text).toMatch(/Ya terminaste/i);
    expect(text).toContain("Blogs");
    expect(text).toMatch(/solo una notificación/i);
    expect(text).toMatch(/Horario del día/i);
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
});
