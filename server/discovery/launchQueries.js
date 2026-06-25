/**
 * Boolean web-search queries to surface pre-launch/announcement chatter.
 * @param {number} rangeDays
 * @param {string} [industry]
 * @returns {string[]}
 */
export function buildLaunchQueries(rangeDays, industry) {
  const scope = industry ? ` ${industry}` : "";
  const year = new Date().getFullYear();

  // Single exact phrase + free keywords (not all-quoted) — stacking 2-3 quoted
  // phrases together makes Google AND all of them literally, which returns
  // ~0 results almost always. One anchor phrase + loose terms gets recall.
  return [
    `"expected to launch" ${year} pre-order${scope}`,
    `"announces upcoming release" ${year}${scope}`,
    `"shipping starts in" months${scope}`,
    `"launches global campaign" ${year}${scope}`,
    `"unveils new campaign" ${year}${scope}`,
  ];
}
