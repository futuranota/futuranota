/**
 * Syntax bank: check free / occupied hours for a document + activate strikethrough.
 * Pattern: every new Gina intent ships a ginaSyntax*.js + tests of variants.
 */

import { foldGinaText } from "./ginaTimeScope.js";

/**
 * @param {string} text
 * @returns {"check" | "activate" | null}
 */
export function parseOccupiedHoursIntent(text) {
  const q = foldGinaText(text);
  if (!q) return null;

  // Explicit activate (no full list required)
  if (
    /\bactivar\s+horas\s+tomadas\b/.test(q)
    || /\bactivate\s+(taken|occupied)\s+hours\b/.test(q)
    || /\benable\s+(taken|occupied)\s+hours\b/.test(q)
    || /\bactivar\s+horas\s+ocupadas\b/.test(q)
  ) {
    return "activate";
  }

  // Check free / available hours for this document (chip + natural variants)
  if (
    /\bchequear\s+horas\s+libres\b/.test(q)
    || /\bcheck(?:ear)?\s+(?:available|free)\s+hours\b/.test(q)
    || /\bhoras\s+libres\s+para\s+(este\s+)?documento\b/.test(q)
    || /\b(available|free)\s+hours\s+for\s+this\s+document\b/.test(q)
    || /\bmostrar\s+horas\s+(tomadas|ocupadas|libres)\b/.test(q)
    || /\b(list|show)\s+(taken|occupied|free|available)\s+hours\b/.test(q)
    || /\bhoras\s+tomadas\b/.test(q)
    || /\boccupied\s+hours\b/.test(q)
  ) {
    return "check";
  }

  return null;
}

/**
 * @param {string} text
 */
export function wantsOccupiedHoursIntent(text) {
  return parseOccupiedHoursIntent(text) != null;
}

/**
 * Closing line after Gina unlocks picker strikethrough for the rest of the day.
 * @param {"es"|"en"} [locale]
 */
export function buildOccupiedHoursActivationTail(locale = "es") {
  if (locale === "en") {
    return "For the rest of the day I’ll strike through hours that are already taken — when you open the schedule picker you’ll see what’s free.";
  }
  return "Para el resto del día activaré la función de tachar las horas que ya fueron tomadas; cuando entres al picker de horario podrás visualizar las horas disponibles.";
}

/**
 * @param {{
 *   mode: "check" | "activate",
 *   occupied: Array<{ title?: string, time?: string }>,
 *   locale?: "es"|"en",
 * }} opts
 */
export function buildOccupiedHoursReplyMessage(opts = {}) {
  const en = opts.locale === "en";
  const occupied = Array.isArray(opts.occupied) ? opts.occupied : [];
  const tail = buildOccupiedHoursActivationTail(en ? "en" : "es");

  if (opts.mode === "activate") {
    return en
      ? `Ready — ${tail}`
      : `Listo — ${tail}`;
  }

  if (occupied.length === 0) {
    return en
      ? `Today you still have almost the rest of the day free — no other document is scheduled yet.\n\n${tail}`
      : `Hoy disponible tienes casi el resto del día; aún no tienes ningún documento seleccionado.\n\n${tail}`;
  }

  const lines = occupied.map((row) => {
    const title = String(row.title || (en ? "Document" : "Documento")).trim() || (en ? "Document" : "Documento");
    const time = String(row.time || "—").trim() || "—";
    return `• ${title} · ${time}`;
  });

  return en
    ? `Here’s the list of taken hours:\n${lines.join("\n")}\n\n${tail}`
    : `Aquí te doy el listado de las horas tomadas:\n${lines.join("\n")}\n\n${tail}`;
}
