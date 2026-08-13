/**
 * Gina dashboard openings — greeting headline only; body + chips come from opening chips.
 */

/**
 * @param {{
 *   locale?: string,
 *   userName?: string | null,
 *   now?: Date,
 *   salt?: number,
 * }} opts
 */
export function pickGinaOpening(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const name = String(opts.userName || "").trim().split(/\s+/)[0] || "";
  void opts.now;
  void opts.salt;

  if (locale === "en") {
    return name ? `Hi, good day ${name}.` : "Hi, good day.";
  }
  return name ? `Hola, buenas ${name}.` : "Hola, buenas.";
}

/**
 * @param {object | null | undefined} user
 */
export function resolveGinaUserDisplayName(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const raw = meta.full_name || meta.name || meta.display_name || "";
  if (raw && String(raw).trim()) return String(raw).trim();
  const email = user.email || "";
  if (email.includes("@")) return email.split("@")[0];
  return "";
}
