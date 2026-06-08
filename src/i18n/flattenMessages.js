/**
 * Flatten nested message object to dot-keys.
 * @param {Record<string, unknown>} obj
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
export function flattenMessages(obj, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (value && typeof value === "object") {
      Object.assign(out, flattenMessages(value, path));
    }
  }
  return out;
}
