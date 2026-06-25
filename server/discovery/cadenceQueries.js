/**
 * Brand-scoped Serper queries for historical launch cadence (Pass B).
 * @param {string} brandName
 * @param {number} [_rangeDays]
 * @returns {string[]}
 */
export function buildBrandCadenceQueries(brandName, _rangeDays) {
  const year = new Date().getFullYear();
  const prevYear = year - 1;
  const q = `"${brandName.trim()}"`;
  return [
    `${q} last product launch date ${prevYear} ${year}`,
    `${q} release cycle months flagship product`,
    `${q} "released" OR "announced" new product ${prevYear} ${year}`,
  ];
}
