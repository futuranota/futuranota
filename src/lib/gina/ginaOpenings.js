/**
 * Variable Gina dashboard openings.
 */

const OPENINGS_ES = [
  ({ name, period }) => (name
    ? `Hola ${name}, ¿en qué te puedo asistir ${period}?`
    : `Hola, ¿en qué te puedo asistir ${period}?`),
  ({ name, period }) => (name
    ? `Hola ${name}, ¿en qué te puedo ayudar ${period}?`
    : `Hola, por aquí — ¿en qué te puedo ayudar ${period}?`),
  ({ name }) => (name
    ? `Hola ${name}. Veo el workspace de tu compañía — ¿qué tienes en mente para hoy?`
    : "Hola, por aquí. Veo el workspace de tu compañía — ¿qué tienes en mente para hoy?"),
  ({ name, period }) => (name
    ? `${name}, ¿qué quieres revisar ${period}? Hoy, vencidos, un departamento…`
    : `¿Qué quieres revisar ${period}? Hoy, vencidos, un departamento…`),
];

const OPENINGS_EN = [
  ({ name, period }) => (name
    ? `Hi ${name} — how can I help you ${period}?`
    : `Hi — how can I help you ${period}?`),
  ({ name, period }) => (name
    ? `Hello ${name}, what can I assist with ${period}?`
    : `Hello — what can I assist with ${period}?`),
  ({ name }) => (name
    ? `Hi ${name}. I can see your company workspace — what's on your mind for today?`
    : "Hi. I can see your company workspace — what's on your mind for today?"),
  ({ name, period }) => (name
    ? `${name}, what do you want to review ${period}? Today, past due, a department…`
    : `What do you want to review ${period}? Today, past due, a department…`),
];

function dayPeriod(hour, locale) {
  if (locale === "en") {
    if (hour < 12) return "this morning";
    if (hour < 18) return "this afternoon";
    return "this evening";
  }
  if (hour < 12) return "esta mañana";
  if (hour < 18) return "esta tarde";
  return "esta noche";
}

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
  const now = opts.now instanceof Date ? opts.now : new Date();
  const period = dayPeriod(now.getHours(), locale);
  const name = String(opts.userName || "").trim().split(/\s+/)[0] || "";
  const pool = locale === "en" ? OPENINGS_EN : OPENINGS_ES;
  const salt = Number.isFinite(opts.salt) ? opts.salt : Math.floor(Math.random() * pool.length);
  const idx = Math.abs(salt) % pool.length;
  return pool[idx]({ name, period });
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
