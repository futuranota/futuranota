import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildGinaDayRitualResetAck,
  isGinaResetDayRitualIntent,
  resetGinaDayRitualState,
} from "./ginaDayRitualReset.js";
import { writeDaySheet, hasDaySheet } from "./ginaDaySheetStore.js";
import {
  enableTalkNotifications,
  isTalkNotificationsEnabled,
  hasTalkNotificationsDecision,
} from "./ginaTalkRequestStore.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("ginaDayRitualReset", () => {
  const uid = "reset-user";
  const now = new Date("2026-08-09T18:00:00");

  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("clears day sheet and talk notification opt-in", () => {
    writeDaySheet(uid, { docIds: ["a", "b"], now, source: "test" });
    enableTalkNotifications(uid, now);
    expect(hasDaySheet(uid, now)).toBe(true);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(true);

    const { cleared } = resetGinaDayRitualState(uid);
    expect(cleared).toContain("day_sheet");
    expect(cleared).toContain("talk_notifications");
    expect(hasDaySheet(uid, now)).toBe(false);
    expect(isTalkNotificationsEnabled(uid, now)).toBe(false);
    expect(hasTalkNotificationsDecision(uid, now)).toBe(false);
  });

  it("routes reset intent", () => {
    expect(isGinaResetDayRitualIntent("Reset ritual de hoy")).toBe(true);
    const routed = runGinaQueryFamily("Reset ritual de hoy", {
      now,
      userId: uid,
      nodes: {},
      docs: {},
      departments: [],
    });
    expect(routed.family).toBe("gina_day_ritual_reset");
    expect(buildGinaDayRitualResetAck("es")).toMatch(/limpié el horario del día/i);
  });
});
