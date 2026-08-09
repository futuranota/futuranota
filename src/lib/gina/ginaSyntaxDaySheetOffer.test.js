import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  clearDaySheetOfferCount,
  getDaySheetOfferCount,
  setDaySheetOfferCount,
} from "./ginaDaySheetOfferStore.js";
import {
  pickDaySheetSaveOfferText,
  resolveDaySheetOfferVariant,
  DAY_SHEET_SAVE_OFFER_VARIANTS,
} from "./ginaSyntaxDaySheetOffer.js";
import { buildTodayOverviewPostTableCopy, buildGinaReplyChips } from "./ginaReplyChips.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: (k) => { memory.delete(k); },
  clear: () => { memory.clear(); },
};

const UID = "test-day-sheet-offer";

describe("ginaSyntaxDaySheetOffer", () => {
  beforeEach(() => {
    memory.clear();
    clearDaySheetOfferCount(UID);
  });

  afterEach(() => {
    memory.clear();
  });

  it("resolves novice A/B for first 3 exposures then recurrent", () => {
    expect(resolveDaySheetOfferVariant(0)).toEqual({ tier: "novice", variantId: "novice_a" });
    expect(resolveDaySheetOfferVariant(1)).toEqual({ tier: "novice", variantId: "novice_b" });
    expect(resolveDaySheetOfferVariant(2)).toEqual({ tier: "novice", variantId: "novice_a" });
    expect(resolveDaySheetOfferVariant(3)).toEqual({ tier: "recurrent", variantId: "recurrent_1" });
    expect(resolveDaySheetOfferVariant(4)).toEqual({ tier: "recurrent", variantId: "recurrent_2" });
    expect(resolveDaySheetOfferVariant(7)).toEqual({ tier: "recurrent", variantId: "recurrent_5" });
    expect(resolveDaySheetOfferVariant(8)).toEqual({ tier: "recurrent", variantId: "recurrent_1" });
  });

  it("picks novice_a copy and increments store", () => {
    const offer = pickDaySheetSaveOfferText({ locale: "es", userId: UID });
    expect(offer.tier).toBe("novice");
    expect(offer.variantId).toBe("novice_a");
    expect(offer.text).toContain("¡Hey! Antes de empezar");
    expect(offer.chip?.label).toBe("Guardar horario del día");
    expect(getDaySheetOfferCount(UID)).toBe(1);
  });

  it("rotates to novice_b then recurrent_1", () => {
    setDaySheetOfferCount(UID, 1);
    const b = pickDaySheetSaveOfferText({ locale: "es", userId: UID, offerCount: 1, increment: false });
    expect(b.variantId).toBe("novice_b");
    expect(b.text).toMatch(/tip rápido/i);

    const r = pickDaySheetSaveOfferText({ locale: "es", userId: UID, offerCount: 3, increment: false });
    expect(r.variantId).toBe("recurrent_1");
    expect(r.text).toMatch(/armada tu jornada/i);

    const r2 = pickDaySheetSaveOfferText({ locale: "es", userId: UID, offerCount: 4, increment: false });
    expect(r2.text).toMatch(/Tu Sheet del Día está listo/);
  });

  it("returns null pitch when day sheet already saved", () => {
    const offer = pickDaySheetSaveOfferText({
      locale: "es",
      userId: UID,
      hasDaySheet: true,
    });
    expect(offer.text).toBeNull();
    expect(offer.chip).toBeNull();
    expect(getDaySheetOfferCount(UID)).toBe(0);
  });

  it("has all variant strings for es and en", () => {
    for (const id of Object.keys(DAY_SHEET_SAVE_OFFER_VARIANTS)) {
      expect(DAY_SHEET_SAVE_OFFER_VARIANTS[id].es.length).toBeGreaterThan(20);
      expect(DAY_SHEET_SAVE_OFFER_VARIANTS[id].en.length).toBeGreaterThan(20);
    }
  });
});

describe("buildTodayOverviewAfterText + chips offer gating", () => {
  beforeEach(() => {
    memory.clear();
    clearDaySheetOfferCount(UID);
  });

  it("uses save-offer pitch when sheet is not saved and day is clean", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      userId: UID,
      hasDaySheet: false,
      offerCount: 0,
      incrementOffer: false,
      documents: [{
        id: "n1",
        title: "Doc A",
        department: "Marketing",
        category: "Blogs",
        workMinutes: 30,
        timeClock: "10:00 AM – 10:30 AM",
      }],
      quickSheet: {
        urgency: [],
        isCleanDay: true,
        hasOverlap: false,
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Doc A" }],
      },
    });
    expect(post.textAfter).toContain("**Documento de inicio:** Doc A");
    expect(post.textAfter).toContain("¿Quieres guardar el Sheet del Día de hoy");
    expect(post.textAfter).not.toMatch(/¡Hey! Antes de empezar/i);
    expect(post.textPitch).toBeNull();
    expect(post.textAfter).not.toMatch(/orden de horario/i);
  });

  it("still shows Sheet del Día education when already saved", () => {
    const post = buildTodayOverviewPostTableCopy({
      locale: "es",
      userId: UID,
      hasDaySheet: true,
      documents: [{
        id: "n1",
        title: "Doc A",
        department: "Marketing",
        category: "Blogs",
        workMinutes: 30,
        timeClock: "10:00 AM – 10:30 AM",
      }],
      quickSheet: {
        isCleanDay: true,
        firstPendingId: "n1",
        pending: [{ id: "n1", title: "Doc A" }],
      },
    });
    expect(post.textAfter).toContain("**Documento de inicio:** Doc A");
    expect(post.textAfter).toContain("¿Quieres guardar el Sheet del Día de hoy");
    expect(post.textPitch).toBeNull();
    expect(getDaySheetOfferCount(UID)).toBe(0);
  });

  it("omits open_day_sheet when hasDaySheet on today overview (uses Guardar horario del día)", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      locale: "es",
      hasDaySheet: true,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [],
          quickSheet: { isCleanDay: true, firstPendingId: null },
        },
      },
    });
    expect(chips.some((c) => c.id === "save_day_sheet")).toBe(true);
    expect(chips.find((c) => c.id === "save_day_sheet")?.label).toBe("Guardar horario del día");
    expect(chips.some((c) => c.id === "open_day_sheet")).toBe(false);
  });

  it("keeps Guardar horario del día when sheet not saved on today overview", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      locale: "es",
      hasDaySheet: false,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [],
          quickSheet: { isCleanDay: true },
        },
      },
    });
    expect(chips.map((c) => c.id)).toContain("save_day_sheet");
    expect(chips.find((c) => c.id === "save_day_sheet")?.label).toBe("Guardar horario del día");
  });
});
