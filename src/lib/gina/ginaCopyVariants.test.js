import { describe, expect, it } from "vitest";
import {
  GINA_SEARCH_PRELUDE_ES,
  pickGinaDocsByDepartmentHeadline,
  pickGinaDocsByStatusHeadline,
  pickGinaRandom,
  pickGinaSearchPrelude,
} from "./ginaCopyVariants.js";
import { buildGinaSearchSequence } from "./ginaSearchSequence.js";

describe("ginaCopyVariants", () => {
  it("pickGinaRandom is stable with salt", () => {
    expect(pickGinaRandom(["a", "b", "c"], 0)).toBe("a");
    expect(pickGinaRandom(["a", "b", "c"], 1)).toBe("b");
    expect(pickGinaRandom(["a", "b", "c"], 2)).toBe("c");
    expect(pickGinaRandom(["a", "b", "c"], 3)).toBe("a");
  });

  it("prelude variants include user bank", () => {
    for (const line of GINA_SEARCH_PRELUDE_ES) {
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(5);
    }
    expect(pickGinaSearchPrelude({ locale: "es", salt: 0 })).toBe(GINA_SEARCH_PRELUDE_ES[0]);
    expect(pickGinaSearchPrelude({ locale: "es", salt: 3 })).toMatch(/dame un momento/i);
    expect(buildGinaSearchSequence("es", { salt: 5 }).preludeMessage).toMatch(/espera un instante/i);
  });

  it("docs-by-department headline templates use n", () => {
    const a = pickGinaDocsByDepartmentHeadline({ count: 27, locale: "es", salt: 0 });
    expect(a).toMatch(/27/);
    expect(a).toMatch(/departamentos/i);
    const b = pickGinaDocsByDepartmentHeadline({ count: 27, locale: "es", salt: 1 });
    expect(b).toMatch(/27/);
    expect(b).toMatch(/listo|encontr/i);
    expect(a).not.toBe(b);
  });

  it("docs-by-status headline says status not departments", () => {
    const a = pickGinaDocsByStatusHeadline({ count: 12, locale: "es", salt: 2 });
    expect(a).toMatch(/12/);
    expect(a).toMatch(/status/i);
    expect(a).not.toMatch(/departamentos/i);
  });
});
