/**
 * Copy bank — “¿Guardamos el Sheet del Día?” (novice vs recurrent).
 * Syntax + variants; router/host picks via pickDaySheetSaveOfferText.
 */

import {
  getDaySheetOfferCount,
  incrementDaySheetOfferCount,
} from "./ginaDaySheetOfferStore.js";

export const DAY_SHEET_SAVE_CHIP = {
  id: "save_day_sheet",
  labelEs: "Guardar sheet del día",
  labelEn: "Save day sheet",
  textEs: "Guardar esta tabla de referencia del día",
  textEn: "Save this day reference sheet",
};

/** @type {Record<string, { es: string, en: string }>} */
export const DAY_SHEET_SAVE_OFFER_VARIANTS = {
  novice_a: {
    es: "¡Hey! Antes de empezar: si quieres podemos guardar este Sheet del Día. La ventaja es que, mientras trabajes en cualquier otro documento, podrás abrir este horario general, ir tachando las tareas completadas y saber siempre cuál es tu siguiente paso. ¿Quieres guardarlo?",
    en: "Hey! Before we start: we can save this Day Sheet if you want. While you work in any other document, you’ll be able to open this general schedule, check off finished tasks, and always know what’s next. Want to save it?",
  },
  novice_b: {
    es: "Un tip rápido antes de seguir: puedes guardar este Sheet del Día. Así se mantendrá a la mano desde cualquier documento para que consultes tu horario general y vayas marcando tus avances. ¿Lo dejamos guardado?",
    en: "A quick tip before we continue: you can save this Day Sheet. It stays handy from any document so you can check your general schedule and mark progress as you go. Shall we keep it saved?",
  },
  recurrent_1: {
    es: "Ya tienes armada tu jornada de hoy. ¿Guardamos este Sheet del Día para que te acompañe mientras trabajas en tus documentos?",
    en: "Your day is already set up. Shall we save this Day Sheet so it stays with you while you work in your documents?",
  },
  recurrent_2: {
    es: "Tu Sheet del Día está listo. ¿Lo fijamos para que tengas tu horario general a la mano y vayas tachando avances?",
    en: "Your Day Sheet is ready. Want to pin it so you have your general schedule handy and can check off progress?",
  },
  recurrent_3: {
    es: "¿Dejamos guardado el Sheet de hoy? Así mantienes la referencia de lo que sigue y vas tachando lo completado sobre la marcha.",
    en: "Shall we keep today’s Sheet saved? That way you keep a reference of what’s next and check off what’s done as you go.",
  },
  recurrent_4: {
    es: "¿Quieres guardar el Sheet del Día de hoy para acceso rápido desde cualquier documento?",
    en: "Want to save today’s Day Sheet for quick access from any document?",
  },
  recurrent_5: {
    es: "Horario organizado. ¿Lo guardamos para que puedas ir marcando lo listo mientras abres tus otros archivos?",
    en: "Schedule organized. Shall we save it so you can mark what’s done while you open your other files?",
  },
};

const NOVICE_IDS = ["novice_a", "novice_b"];
const RECURRENT_IDS = [
  "recurrent_1",
  "recurrent_2",
  "recurrent_3",
  "recurrent_4",
  "recurrent_5",
];

/**
 * Resolve variant id for a given exposure count (before increment).
 * @param {number} offerCount
 * @returns {{ tier: "novice" | "recurrent", variantId: string }}
 */
export function resolveDaySheetOfferVariant(offerCount = 0) {
  const n = Math.max(0, Math.floor(Number(offerCount) || 0));
  if (n < 3) {
    return {
      tier: "novice",
      variantId: NOVICE_IDS[n % NOVICE_IDS.length],
    };
  }
  return {
    tier: "recurrent",
    variantId: RECURRENT_IDS[(n - 3) % RECURRENT_IDS.length],
  };
}

/**
 * @param {{
 *   locale?: string,
 *   userId?: string,
 *   hasDaySheet?: boolean,
 *   offerCount?: number,
 *   increment?: boolean,
 * }} [opts]
 * @returns {{
 *   text: string | null,
 *   tier: "novice" | "recurrent" | null,
 *   variantId: string | null,
 *   chip: { id: string, label: string, text: string, primary?: boolean } | null,
 * } | null}
 */
export function pickDaySheetSaveOfferText(opts = {}) {
  if (opts.hasDaySheet) {
    return {
      text: null,
      tier: null,
      variantId: null,
      chip: null,
    };
  }

  const en = opts.locale === "en";
  const count = opts.offerCount != null
    ? Math.max(0, Math.floor(Number(opts.offerCount) || 0))
    : getDaySheetOfferCount(opts.userId);
  const { tier, variantId } = resolveDaySheetOfferVariant(count);
  const row = DAY_SHEET_SAVE_OFFER_VARIANTS[variantId];
  const text = row ? (en ? row.en : row.es) : null;

  if (opts.increment !== false && opts.offerCount == null) {
    incrementDaySheetOfferCount(opts.userId);
  }

  return {
    text,
    tier,
    variantId,
    chip: {
      id: DAY_SHEET_SAVE_CHIP.id,
      label: en ? DAY_SHEET_SAVE_CHIP.labelEn : DAY_SHEET_SAVE_CHIP.labelEs,
      text: en ? DAY_SHEET_SAVE_CHIP.textEn : DAY_SHEET_SAVE_CHIP.textEs,
      primary: true,
    },
  };
}
