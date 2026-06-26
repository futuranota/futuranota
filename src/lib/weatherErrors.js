export const WEATHER_ERROR_LOCATION_NOT_FOUND = "location_not_found";

/**
 * @param {string} code
 * @param {(key: string) => string} t
 */
export function weatherErrorMessage(code, t) {
  if (code === WEATHER_ERROR_LOCATION_NOT_FOUND) {
    return t("intel.forecastLocationNotFound");
  }
  return t("intel.forecastLoadFailed");
}
