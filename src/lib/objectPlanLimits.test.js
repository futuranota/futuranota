import { describe, expect, it } from "vitest";
import { OBJECT_ROLE_CORPUS, OBJECT_ROLE_GUEST, OBJECT_ROLE_SATELLITE } from "./objectColors.js";
import {
  canAddDocToObject,
  canCreateGuest,
  canCreateOwnedCorpus,
  countGuestObjects,
  countOwnedCorpora,
  restoreMisclassifiedGuestCorpora,
  isGuestObject,
} from "./objectPlanLimits.js";

describe("objectPlanLimits", () => {
  it("only role guest is an invited object; satellite stays a full corpus", () => {
    expect(isGuestObject({ role: OBJECT_ROLE_SATELLITE })).toBe(false);
    expect(isGuestObject({ role: OBJECT_ROLE_GUEST })).toBe(true);
    expect(isGuestObject({ role: OBJECT_ROLE_CORPUS })).toBe(false);
    expect(countOwnedCorpora({
      a: { role: OBJECT_ROLE_CORPUS },
      b: { role: OBJECT_ROLE_SATELLITE },
    })).toBe(2);
  });

  it("caps Starter at 1 corpus and 0 guests", () => {
    const one = { a: { role: OBJECT_ROLE_CORPUS } };
    expect(canCreateOwnedCorpus(one, "free")).toBe(false);
    expect(canCreateGuest({}, "free")).toBe(false);
  });

  it("caps Pro at 2 corpora and 8 guests", () => {
    const two = {
      a: { role: OBJECT_ROLE_CORPUS },
      b: { role: OBJECT_ROLE_CORPUS },
    };
    expect(countOwnedCorpora(two)).toBe(2);
    expect(canCreateOwnedCorpus(two, "pro")).toBe(false);
    expect(canCreateOwnedCorpus({ a: { role: OBJECT_ROLE_CORPUS } }, "pro")).toBe(true);

    const guests = {};
    for (let i = 0; i < 8; i += 1) guests[`g${i}`] = { role: OBJECT_ROLE_GUEST };
    expect(countGuestObjects(guests)).toBe(8);
    expect(canCreateGuest(guests, "pro")).toBe(false);
  });

  it("caps 8 docs per guest", () => {
    const guest = { id: "G1", role: OBJECT_ROLE_GUEST };
    const docs = {};
    for (let i = 0; i < 8; i += 1) docs[`d${i}`] = { parentObjectId: "G1" };
    expect(canAddDocToObject(guest, docs, "pro")).toBe(false);
    expect(canAddDocToObject({ id: "C1", role: OBJECT_ROLE_CORPUS }, docs, "pro")).toBe(true);
    expect(canAddDocToObject({ id: "S1", role: OBJECT_ROLE_SATELLITE }, docs, "pro")).toBe(true);
  });

  it("restores guest to satellite when the object already has departments", () => {
    const objects = {
      FN: { id: "FN", role: OBJECT_ROLE_GUEST, name: "Futura Nota" },
      HD: { id: "HD", role: OBJECT_ROLE_GUEST, name: "Home Depot" },
    };
    const restored = restoreMisclassifiedGuestCorpora(
      objects,
      [{ objectId: "FN" }],
      { d1: { parentObjectId: "HD", campaignActive: true } },
    );
    expect(restored.FN.role).toBe(OBJECT_ROLE_SATELLITE);
    expect(restored.HD.role).toBe(OBJECT_ROLE_GUEST);
  });
});
