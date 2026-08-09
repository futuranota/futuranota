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
import { buildTodayOverviewAfterText, buildGinaReplyChips } from "./ginaReplyChips.js";

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
    expect(offer.chip?.label).toBe("Guardar sheet del día");
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

  it("uses save-offer pitch when sheet is not saved", () => {
    const after = buildTodayOverviewAfterText({
      locale: "es",
      userId: UID,
      hasDaySheet: false,
      offerCount: 0,
      incrementOffer: false,
    });
    expect(after).toContain("¡Hey! Antes de empezar");
    expect(after).not.toMatch(/orden de horario/i);
  });

  it("falls back to sheet intro when already saved", () => {
    const after = buildTodayOverviewAfterText({
      locale: "es",
      userId: UID,
      hasDaySheet: true,
    });
    expect(after).toMatch(/sheet del día/i);
    expect(after).toMatch(/orden de horario/i);
    expect(getDaySheetOfferCount(UID)).toBe(0);
  });

  it("omits save chip when hasDaySheet on today overview", () => {
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
    expect(chips.some((c) => c.id === "save_day_sheet")).toBe(false);
    expect(chips.some((c) => c.id === "open_day_sheet")).toBe(true);
  });

  it("keeps save chip when sheet not saved", () => {
    const chips = buildGinaReplyChips({
      family: "today",
      locale: "es",
      hasDaySheet: false,
      visualization: {
        type: "schedule_sheet",
        data: {
          todayOverview: true,
          overviewByDepartment: [],
          quickSheet: { isCleanDay: false },
        },
      },
    });
    expect(chips.some((c) => c.id === "save_day_sheet")).toBe(true);
  });
});
