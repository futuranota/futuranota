/** @typedef {'manual' | 'geolocation'} WeatherLocationSource */

/**
 * @typedef {Object} WeatherLocation
 * @property {WeatherLocationSource} source
 * @property {string} city
 * @property {number|null} lat
 * @property {number|null} lon
 * @property {string} label
 */

export const DEFAULT_WEATHER_LOCATION = {
  source: "manual",
  city: "",
  lat: null,
  lon: null,
  label: "",
};

/**
 * @param {unknown} raw
 * @returns {WeatherLocation}
 */
export function normalizeWeatherLocation(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_WEATHER_LOCATION };
  }

  const source = raw.source === "geolocation" ? "geolocation" : "manual";
  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  const lat = Number.isFinite(raw.lat) ? raw.lat : null;
  const lon = Number.isFinite(raw.lon) ? raw.lon : null;
  const label = typeof raw.label === "string" ? raw.label.trim() : "";

  if (source === "geolocation" && lat != null && lon != null) {
    return {
      source: "geolocation",
      city: "",
      lat,
      lon,
      label: label || formatCoordsLabel(lat, lon),
    };
  }

  return {
    source: "manual",
    city,
    lat: null,
    lon: null,
    label: label || city,
  };
}

/**
 * @param {WeatherLocation} location
 * @returns {boolean}
 */
export function hasWeatherLocation(location) {
  if (location.source === "geolocation") {
    return location.lat != null && location.lon != null;
  }
  return Boolean(location.city?.trim());
}

/**
 * Stable key for cache-busting and refetch triggers (ignores display label).
 * @param {WeatherLocation} location
 */
export function getWeatherLocationKey(location) {
  const normalized = normalizeWeatherLocation(location);
  if (normalized.source === "geolocation" && normalized.lat != null && normalized.lon != null) {
    return `geo:${normalized.lat.toFixed(4)},${normalized.lon.toFixed(4)}`;
  }
  if (normalized.city) {
    return `city:${normalized.city.toLowerCase()}`;
  }
  return "";
}

/**
 * @param {WeatherLocation} location
 * @returns {string}
 */
export function buildWeatherLocationQuery(location) {
  const normalized = normalizeWeatherLocation(location);
  if (normalized.source === "geolocation" && normalized.lat != null && normalized.lon != null) {
    return `lat=${normalized.lat}&lon=${normalized.lon}`;
  }
  if (normalized.city) {
    return `city=${encodeURIComponent(normalized.city)}`;
  }
  return "";
}

/**
 * @param {number} lat
 * @param {number} lon
 */
export function formatCoordsLabel(lat, lon) {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}

/**
 * @returns {Promise<{ lat: number, lon: number }>}
 */
export function requestBrowserGeolocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        const code = error?.code;
        if (code === 1) {
          reject(new Error("Location permission denied"));
        } else if (code === 2) {
          reject(new Error("Location unavailable"));
        } else if (code === 3) {
          reject(new Error("Location request timed out"));
        } else {
          reject(new Error("Could not read your location"));
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000,
      },
    );
  });
}
