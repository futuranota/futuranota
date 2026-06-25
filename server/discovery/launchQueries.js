/**
 * High-ticket launch discovery queries — announcement + physical/premium products.
 * @param {number} rangeDays
 * @param {string} [industry]
 * @returns {string[]}
 */
export function buildLaunchQueries(rangeDays, industry) {
  const scope = industry ? ` ${industry}` : "";
  const year = new Date().getFullYear();

  return [
    `"announces" "launch date" pre-order premium${scope} ${year}`,
    `"expected to launch" flagship hardware wearable${scope} ${year}`,
    `"shipping starts" MSRP sports equipment${scope}`,
    `"unveils" "global campaign" innovation limited edition${scope} ${year}`,
    `"now available for pre-order" physical product${scope} ${year}`,
    `"launching" "starting at" pro model${scope} ${year}`,
  ];
}
