import { describe, expect, it } from "vitest";
import { openLibrarySpeakQuotes } from "./docLibrarySpeakRefs.js";

describe("openLibrarySpeakQuotes", () => {
  it("keeps the following line when replacing a short Gina.s token", () => {
    const text = "Gina.s\n[Abre un estante]";
    const opened = openLibrarySpeakQuotes(text, {
      start: 0,
      end: "Gina.s".length,
      tag: "Gina",
    });
    expect(opened.text).toBe("Gina \"\"\n[Abre un estante]");
    expect(opened.text).not.toContain("Gina \"\"[");
    expect(opened.caret).toBe("Gina \"".length);
  });

  it("keeps the following line when replacing Gina.speak", () => {
    const text = "Gina.speak\n[Abre un estante]";
    const opened = openLibrarySpeakQuotes(text, {
      start: 0,
      end: "Gina.speak".length,
      tag: "Gina",
    });
    expect(opened.text).toBe("Gina \"\"\n[Abre un estante]");
  });
});
