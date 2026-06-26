export const WEATHER_ERROR_LOCATION_NOT_FOUND = "location_not_found";
export const WEATHER_ERROR_NOT_CONFIGURED = "openweather_not_configured";

/**
 * @param {string} code
 * @param {(key: string) => string} t
 */
export function weatherErrorMessage(code, t) {
  if (code === WEATHER_ERROR_LOCATION_NOT_FOUND) {
    return t("intel.forecastLocationNotFound");
  }
  if (code === WEATHER_ERROR_NOT_CONFIGURED) {
    return t("intel.forecastNotConfigured");
  }
  return t("intel.forecastLoadFailed");
}
