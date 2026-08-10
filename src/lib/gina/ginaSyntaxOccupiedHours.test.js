/**
 * Tests: occupied-hours syntax bank + reply copy.
 */

import { describe, expect, it } from "vitest";
import {
  buildOccupiedHoursActivationTail,
  buildOccupiedHoursReplyMessage,
  parseOccupiedHoursIntent,
  wantsOccupiedHoursIntent,
} from "./ginaSyntaxOccupiedHours.js";

describe("ginaSyntaxOccupiedHours", () => {
  it("matches check chip and variants", () => {
    expect(parseOccupiedHoursIntent("Chequear horas libres para este documento")).toBe("check");
    expect(parseOccupiedHoursIntent("Check available hours for this document")).toBe("check");
    expect(parseOccupiedHoursIntent("mostrar horas tomadas")).toBe("check");
    expect(parseOccupiedHoursIntent("show occupied hours")).toBe("check");
    expect(parseOccupiedHoursIntent("horas libres para este documento")).toBe("check");
  });

  it("matches activate variants", () => {
    expect(parseOccupiedHoursIntent("activar horas tomadas")).toBe("activate");
    expect(parseOccupiedHoursIntent("Activate taken hours")).toBe("activate");
    expect(parseOccupiedHoursIntent("enable occupied hours")).toBe("activate");
  });

  it("does not steal unrelated schedule asks", () => {
    expect(wantsOccupiedHoursIntent("muéstrame los horarios de hoy")).toBe(false);
    expect(wantsOccupiedHoursIntent("qué tenemos para hoy")).toBe(false);
  });

  it("builds empty check reply + activation tail", () => {
    const msg = buildOccupiedHoursReplyMessage({
      mode: "check",
      occupied: [],
      locale: "es",
    });
    expect(msg).toMatch(/resto del día/i);
    expect(msg).toMatch(/tachar las horas/i);
    expect(buildOccupiedHoursActivationTail("en")).toMatch(/strike through/i);
  });

  it("lists taken hours when occupied", () => {
    const msg = buildOccupiedHoursReplyMessage({
      mode: "check",
      occupied: [
        { title: "Doc A", time: "11:00 AM–12:00 PM" },
        { title: "Doc B", time: "5:00 PM–7:30 PM" },
      ],
      locale: "es",
    });
    expect(msg).toMatch(/listado de las horas tomadas/i);
    expect(msg).toContain("Doc A");
    expect(msg).toContain("Doc B");
  });

  it("activate mode is short", () => {
    const msg = buildOccupiedHoursReplyMessage({
      mode: "activate",
      occupied: [{ title: "X", time: "1:00 PM–2:00 PM" }],
      locale: "es",
    });
    expect(msg).toMatch(/^Listo/i);
    expect(msg).not.toContain("Doc");
  });
});
