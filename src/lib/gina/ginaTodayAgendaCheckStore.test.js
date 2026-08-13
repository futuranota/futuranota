import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearTodayAgendaChecked,
  hasTodayAgendaChecked,
  isTodayAgendaCheckFamily,
  markTodayAgendaChecked,
  markTodayAgendaCheckedFromFamily,
} from "./ginaTodayAgendaCheckStore.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("ginaTodayAgendaCheckStore", () => {
  const uid = "agenda-check-user";
  const now = new Date("2026-08-13T15:00:00");

  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("marks and reads check for the calendar day", () => {
    expect(hasTodayAgendaChecked(uid, now)).toBe(false);
    markTodayAgendaChecked(uid, now);
    expect(hasTodayAgendaChecked(uid, now)).toBe(true);
  });

  it("keeps yesterday’s check overnight before 06:00", () => {
    markTodayAgendaChecked(uid, new Date("2026-08-12T20:00:00"));
    expect(hasTodayAgendaChecked(uid, new Date("2026-08-13T03:00:00"))).toBe(true);
    expect(hasTodayAgendaChecked(uid, new Date("2026-08-13T07:00:00"))).toBe(false);
  });

  it("clears the flag", () => {
    markTodayAgendaChecked(uid, now);
    clearTodayAgendaChecked(uid);
    expect(hasTodayAgendaChecked(uid, now)).toBe(false);
  });

  it("marks only today-agenda families", () => {
    expect(isTodayAgendaCheckFamily("today")).toBe(true);
    expect(isTodayAgendaCheckFamily("day_sheet")).toBe(true);
    expect(isTodayAgendaCheckFamily("incomplete")).toBe(false);
    markTodayAgendaCheckedFromFamily(uid, "this_week", now);
    expect(hasTodayAgendaChecked(uid, now)).toBe(false);
    markTodayAgendaCheckedFromFamily(uid, "today", now);
    expect(hasTodayAgendaChecked(uid, now)).toBe(true);
  });
});
