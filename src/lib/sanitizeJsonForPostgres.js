/**
 * Postgres JSON/JSONB rejects strings with unpaired UTF-16 surrogates.
 * JS JSON.stringify may still emit them — strip before Supabase upserts.
 */

/** @param {string} str */
export function stripLoneSurrogates(str) {
  if (typeof str !== "string" || !str.length) return str;
  let out = "";
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += str[i] + str[i + 1];
        i += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }
    out += str[i];
  }
  return out;
}

/**
 * Deep-clone JSON-safe data with sanitized strings for Postgres JSON columns.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeForPostgresJson(value) {
  if (value == null) return value;
  if (typeof value === "string") return stripLoneSurrogates(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForPostgresJson(entry));
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitizeForPostgresJson(entry);
    }
    return out;
  }
  return value;
}

/**
 * @param {object|null|undefined} object
 * @returns {object|null|undefined}
 */
export function sanitizeObjectCadence(object) {
  if (!object || typeof object !== "object") return object;
  const cadence = object.cadence;
  if (!cadence || typeof cadence !== "object" || Array.isArray(cadence)) {
    return object;
  }
  const cleaned = sanitizeForPostgresJson(cadence);
  if (cleaned === cadence) return object;
  try {
    if (JSON.stringify(cleaned) === JSON.stringify(cadence)) return object;
  } catch {
    // fall through to replace
  }
  return { ...object, cadence: cleaned };
}

/**
 * @param {Record<string, object>} objectsById
 * @returns {{ objects: Record<string, object>, changed: boolean }}
 */
export function sanitizeAllObjectCadences(objectsById) {
  if (!objectsById || typeof objectsById !== "object") {
    return { objects: {}, changed: false };
  }
  let changed = false;
  /** @type {Record<string, object>} */
  const objects = {};
  for (const [id, object] of Object.entries(objectsById)) {
    const next = sanitizeObjectCadence(object);
    objects[id] = next;
    if (next !== object) changed = true;
  }
  return { objects, changed };
}
