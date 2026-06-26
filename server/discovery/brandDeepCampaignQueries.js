/**
 * Brand-scoped Serper queries for deep campaign study (Intel Campaign tab).
 * @param {string} brandName
 * @param {number} [_rangeDays]
 * @param {string} [officialDomain]
 * @returns {string[]}
 */
export function buildBrandDeepCampaignQueries(brandName, _rangeDays, officialDomain) {
  const year = new Date().getFullYear();
  const q = `"${brandName.trim()}"`;
  const queries = [
    `${q} "acaba de lanzar" OR "acaba de anunciar" ${year}`,
    `${q} "este lanzamiento" OR "nuevo lanzamiento" ${year}`,
    `${q} "disponible desde" OR "preventa" OR "fecha de lanzamiento" ${year}`,
    `${q} "just launched" OR "now available" OR "shipping starts" ${year}`,
    `${q} "launch date" OR "pre-order" ${year}`,
    `${q} launch announcement product ${year}`,
  ];

  const domain = (officialDomain || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (domain) {
    queries.push(`site:${domain} (launch OR lanzamiento OR "new" OR announce) ${year}`);
  }

  return queries;
}

/**
 * Serper queries derived from the user's Intel Campaign textarea.
 * @param {string} userQuery
 * @param {string} brandName
 * @returns {string[]}
 */
export function buildUserQuerySerperQueries(userQuery, brandName) {
  const q = (userQuery || "").trim().slice(0, 120);
  const brand = (brandName || "").trim();
  if (!q) return [];

  const year = new Date().getFullYear();
  const queries = [q];
  if (brand && !q.toLowerCase().includes(brand.toLowerCase())) {
    queries.push(`${q} "${brand}"`);
  }
  queries.push(`${brand || q} recent campaign launch news ${year}`);
  return queries.filter(Boolean);
}
