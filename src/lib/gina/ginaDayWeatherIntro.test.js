import { describe, expect, it } from "vitest";
import {
  buildGinaDayWeatherIntro,
  buildGinaDayWeatherNeedCityIntro,
  formatGinaMdY,
  ginaDayPartGreeting,
  ginaWeatherConditionPhrase,
} from "./ginaDayWeatherIntro.js";

describe("ginaDayWeatherIntro", () => {
  const morning = new Date("2026-08-14T08:00:00");
  const evening = new Date("2026-08-14T20:00:00");

  it("formats mm/dd/yyyy", () => {
    expect(formatGinaMdY(morning)).toBe("08/14/2026");
  });

  it("greets by local hour", () => {
    expect(ginaDayPartGreeting(morning, "es")).toBe("Buenos días");
    expect(ginaDayPartGreeting(evening, "es")).toBe("Buenas noches");
    expect(ginaDayPartGreeting(morning, "en")).toBe("Good morning");
  });

  it("maps OpenWeather conditions to informal sky", () => {
    expect(ginaWeatherConditionPhrase("Clear", "es")).toBe("soleado");
    expect(ginaWeatherConditionPhrase("Clouds", "es")).toBe("nublado");
    expect(ginaWeatherConditionPhrase("Rain", "es")).toBe("lluvioso");
    expect(ginaWeatherConditionPhrase("Clear", "en")).toBe("sunny");
  });

  it("builds full day-reading line", () => {
    const line = buildGinaDayWeatherIntro({
      locale: "es",
      now: morning,
      city: "Miami Beach",
      condition: "Clear",
    });
    expect(line).toBe("Buenos días, hoy es 08/14/2026. El día está soleado en Miami Beach.");
  });

  it("omits invented sky when condition is missing", () => {
    const line = buildGinaDayWeatherIntro({
      locale: "es",
      now: morning,
      city: "Miami Beach",
      condition: null,
    });
    expect(line).toBe("Buenos días, hoy es 08/14/2026 en Miami Beach.");
    expect(line).not.toMatch(/soleado|nublado/i);
  });

  it("asks for city instead of inventing weather", () => {
    const line = buildGinaDayWeatherNeedCityIntro({ locale: "es", now: morning });
    expect(line).toMatch(/^Buenos días, hoy es 08\/14\/2026\./);
    expect(line).toMatch(/ciudad/i);
    expect(line).not.toMatch(/Miami|soleado/i);
  });
});
