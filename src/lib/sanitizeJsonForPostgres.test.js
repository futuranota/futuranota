import { describe, expect, it } from "vitest";
import {
  sanitizeForPostgresJson,
  sanitizeObjectCadence,
  stripLoneSurrogates,
} from "./sanitizeJsonForPostgres.js";

describe("sanitizeJsonForPostgres", () => {
  it("removes lone high surrogate", () => {
    const broken = "hello \uD800 world";
    expect(stripLoneSurrogates(broken)).toBe("hello  world");
  });

  it("keeps valid surrogate pairs (emoji)", () => {
    const emoji = "ok \uD83D\uDE00 end";
    expect(stripLoneSurrogates(emoji)).toBe(emoji);
  });

  it("sanitizes nested cadence snapshots", () => {
    const cadence = {
      launchRadarPanelSaved: {
        note: "bad \uD800 here",
        nested: [{ text: "\uDC00 lone low" }],
      },
    };
    const cleaned = sanitizeForPostgresJson(cadence);
    expect(JSON.stringify(cleaned)).not.toMatch(/[\uD800-\uDFFF]/);
    expect(cleaned.launchRadarPanelSaved.note).toBe("bad  here");
  });

  it("returns same object reference when cadence unchanged", () => {
    const obj = { id: "OBJ-1", name: "Test", cadence: { ok: true } };
    expect(sanitizeObjectCadence(obj)).toBe(obj);
  });
});
