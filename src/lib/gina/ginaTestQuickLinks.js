/**
 * Temporary Gina test quick-links (iteration harness).
 * Empty while the dashboard home chips are the product entry points.
 */

/**
 * @typedef {{ id: string, label: string, text: string, primary?: boolean }} GinaTestQuickLink
 */

/** @type {GinaTestQuickLink[]} */
export const GINA_TEST_QUICK_LINKS = [];

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaTestQuickLink[]}
 */
export function getGinaTestQuickLinks(opts = {}) {
  void opts;
  return GINA_TEST_QUICK_LINKS.slice();
}
