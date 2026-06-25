/**
 * Brand-scoped Serper queries for confirmed campaign detection (Pass A).
 * @param {string} brandName
 * @param {number} [_rangeDays]
 * @returns {string[]}
 */
export function buildBrandCampaignQueries(brandName, _rangeDays) {
  const year = new Date().getFullYear();
  const q = `"${brandName.trim()}"`;
  return [
    `${q} launch announcement pre-order ${year}`,
    `${q} "launch date" OR "available" OR "shipping starts" product ${year}`,
    `${q} flagship product launch campaign ${year}`,
  ];
}
