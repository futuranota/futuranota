/** Matches server WEATHER_CACHE_TTL_MS (45 min). */
export const FORECAST_REFRESH_MS = 45 * 60 * 1000;

/**
 * Ms until next local midnight for an OpenWeather city timezone offset (seconds from UTC).
 * @param {number} timezoneOffsetSec
 */
export function getMsUntilCityMidnight(timezoneOffsetSec = 0) {
  const offsetMs = timezoneOffsetSec * 1000;
  const cityNow = new Date(Date.now() + offsetMs);
  const y = cityNow.getUTCFullYear();
  const m = cityNow.getUTCMonth();
  const d = cityNow.getUTCDate();
  const nextMidnightUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0, 0) - offsetMs;
  return Math.max(nextMidnightUtcMs - Date.now(), 1000);
}

/**
 * @param {() => void} onRefresh
 * @param {{ timezoneOffsetSec?: number }} [opts]
 * @returns {() => void} cleanup
 */
export function scheduleForecastAutoRefresh(onRefresh, opts = {}) {
  const timezoneOffsetSec = Number(opts.timezoneOffsetSec) || 0;
  let midnightTimerId = null;

  const intervalId = setInterval(onRefresh, FORECAST_REFRESH_MS);

  const scheduleMidnight = () => {
    midnightTimerId = setTimeout(() => {
      onRefresh({ fresh: true });
      scheduleMidnight();
    }, getMsUntilCityMidnight(timezoneOffsetSec));
  };

  scheduleMidnight();

  return () => {
    clearInterval(intervalId);
    if (midnightTimerId != null) clearTimeout(midnightTimerId);
  };
}
