import { getForecastMock } from "../data/forecastMock.js";

/** "Kissimmee, Florida 34741" → "Kissimmee" */
export function parseForecastCity(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return "";
  return trimmed.split(",")[0]?.trim() || trimmed;
}

export function resolveForecastCity(today: Date = new Date()): string {
  return parseForecastCity(getForecastMock(today).location);
}

export function formatHashtag(tag: string): string {
  const t = tag.trim().replace(/^#+/, "");
  return t ? `#${t}` : "";
}

export function buildGeoKeyword(city: string, productTerm = "Pixel 9 Pro Fold"): string {
  const c = city.trim();
  const p = productTerm.trim();
  if (!c) return p;
  if (!p) return c;
  return `${p} ${c}`;
}
