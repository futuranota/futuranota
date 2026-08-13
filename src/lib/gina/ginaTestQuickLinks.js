/**
 * Temporary Gina test quick-links (iteration harness).
 * Empty this array (or remove entries) when the user says “quítalo del link rápido”.
 */

import { GINA_RESET_DAY_RITUAL_PROTOCOL } from "./ginaDayRitualReset.js";

/**
 * @typedef {{ id: string, label: string, text: string, primary?: boolean }} GinaTestQuickLink
 */

/** @type {GinaTestQuickLink[]} */
export const GINA_TEST_QUICK_LINKS = [
  {
    id: "test_reset_day_ritual",
    label: "Reset ritual de hoy",
    text: GINA_RESET_DAY_RITUAL_PROTOCOL,
    primary: false,
  },
];

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaTestQuickLink[]}
 */
export function getGinaTestQuickLinks(opts = {}) {
  const en = opts.locale === "en";
  return GINA_TEST_QUICK_LINKS.map((link) => (
    link.id === "test_reset_day_ritual"
      ? {
        ...link,
        label: en ? "Reset today’s ritual" : "Reset ritual de hoy",
      }
      : link
  ));
}
