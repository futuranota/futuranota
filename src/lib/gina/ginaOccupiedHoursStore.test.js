/**
 * Tests: Gina occupied strikethrough day store + router family.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  activateOccupiedStrikethroughForToday,
  clearOccupiedStrikethrough,
  isOccupiedStrikethroughActive,
} from "./ginaOccupiedHoursStore.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";
import { buildGinaVisualization } from "./buildGinaVisualization.js";
import { resetGinaDayRitualState } from "./ginaDayRitualReset.js";
import { shouldUseGinaSearchSequence } from "./ginaSearchSequence.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

describe("ginaOccupiedHoursStore", () => {
  const uid = "occ-user";
  const now = new Date("2026-08-10T14:00:00");

  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("activates for today and clears", () => {
    expect(isOccupiedStrikethroughActive(uid, now)).toBe(false);
    activateOccupiedStrikethroughForToday(uid, now);
    expect(isOccupiedStrikethroughActive(uid, now)).toBe(true);
    clearOccupiedStrikethrough(uid);
    expect(isOccupiedStrikethroughActive(uid, now)).toBe(false);
  });

  it("routes check intent, activates store, and builds occupied viz", () => {
    const routed = runGinaQueryFamily("Chequear horas libres para este documento", {
      now,
      userId: uid,
      documentId: "doc-self",
      objectId: "corp-1",
      nodes: {
        "doc-self": {
          id: "doc-self",
          title: "Self",
          anchorAt: "2026-08-10T15:00:00",
          anchorFinishAt: "2026-08-10T16:00:00",
        },
        "doc-other": {
          id: "doc-other",
          title: "Other",
          objectId: "corp-1",
          anchorAt: "2026-08-10T11:00:00",
          anchorFinishAt: "2026-08-10T12:00:00",
        },
      },
      docs: {},
      departments: [],
    });
    expect(routed.family).toBe("check_doc_free_hours");
    expect(routed.toolContext?.activated).toBe(true);
    expect(isOccupiedStrikethroughActive(uid, now)).toBe(true);
    expect(routed.toolContext?.occupied?.some((r) => r.id === "doc-other")).toBe(true);
    expect(routed.toolContext?.occupied?.some((r) => r.id === "doc-self")).toBe(false);
    expect(shouldUseGinaSearchSequence("check_doc_free_hours")).toBe(true);

    const viz = buildGinaVisualization("check_doc_free_hours", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("daily_report");
    expect(viz?.data?.occupiedHours?.length).toBeGreaterThan(0);
    expect(viz?.data?.strikeExample).toBe(true);
  });

  it("activate intent still shows the strikethrough example", () => {
    const routed = runGinaQueryFamily("activar horas tomadas", {
      now,
      userId: uid,
      nodes: {},
      docs: {},
      departments: [],
    });
    expect(routed.family).toBe("activate_occupied_hours");
    expect(isOccupiedStrikethroughActive(uid, now)).toBe(true);
    const viz = buildGinaVisualization("activate_occupied_hours", routed.toolContext, {
      locale: "es",
      now,
    });
    expect(viz?.type).toBe("daily_report");
    expect(viz?.data?.strikeExample).toBe(true);
    expect(viz?.data?.occupiedHours).toEqual([]);
  });

  it("day ritual reset clears occupied strikethrough", () => {
    activateOccupiedStrikethroughForToday(uid, now);
    const { cleared } = resetGinaDayRitualState(uid);
    expect(cleared).toContain("occupied_strikethrough");
    expect(isOccupiedStrikethroughActive(uid, now)).toBe(false);
  });
});
