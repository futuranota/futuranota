import { describe, expect, it } from "vitest";
import {
  isDaySheetSaveIntent,
  isDaySheetSkipSaveIntent,
  isDaySheetReopenIntent,
} from "./ginaSyntaxDaySheet.js";

describe("isDaySheetSkipSaveIntent", () => {
  it("matches skip chip phrasing", () => {
    expect(isDaySheetSkipSaveIntent("Seguir sin guardar el sheet del día")).toBe(true);
    expect(isDaySheetSkipSaveIntent("Continue without saving the day sheet")).toBe(true);
    expect(isDaySheetSkipSaveIntent("seguir sin guardar")).toBe(true);
    expect(isDaySheetSkipSaveIntent("skip saving the day sheet")).toBe(true);
  });

  it("does not match plain save", () => {
    expect(isDaySheetSkipSaveIntent("Guardar esta tabla de referencia del día")).toBe(false);
    expect(isDaySheetSkipSaveIntent("Save this day reference sheet")).toBe(false);
  });
});

describe("isDaySheetSaveIntent vs skip", () => {
  it("does not treat skip phrasing as save", () => {
    expect(isDaySheetSaveIntent("Seguir sin guardar el sheet del día")).toBe(false);
    expect(isDaySheetSaveIntent("Continue without saving the day sheet")).toBe(false);
  });

  it("still matches save chip text", () => {
    expect(isDaySheetSaveIntent("Guardar esta tabla de referencia del día")).toBe(true);
    expect(isDaySheetSaveIntent("Guardar horario del día")).toBe(true);
    expect(isDaySheetSaveIntent("Save this day reference sheet")).toBe(true);
  });
});

describe("isDaySheetReopenIntent", () => {
  it("matches Horario del día and legacy Sheet del día", () => {
    expect(isDaySheetReopenIntent("Horario del día")).toBe(true);
    expect(isDaySheetReopenIntent("Sheet del día")).toBe(true);
    expect(isDaySheetReopenIntent("abre el sheet del dia")).toBe(true);
    expect(isDaySheetReopenIntent("Day schedule")).toBe(true);
  });

  it("does not steal week schedule visualize phrasing", () => {
    expect(isDaySheetReopenIntent("visualizar todos los horarios de la semana")).toBe(false);
  });
});
