/**
 * High-intent search footprints (Phase 0) adapted to brand name.
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @returns {string[]}
 */
export function buildHighIntentQueries(brandName, locale = "es") {
  const brand = (brandName || "").trim();
  if (!brand) return [];

  const year = new Date().getFullYear();
  if (locale === "es") {
    return [
      `${brand} próximo lanzamiento ${year}`,
      `próximamente ${brand} va a sacar`,
      `filtraciones ${brand} ${year}`,
      `${brand} acabó de lanzar`,
      `${brand} anunció ${year}`,
      `${brand} reportó ${year}`,
      `${brand} video de campaña`,
    ];
  }

  return [
    `${brand} upcoming launch ${year}`,
    `${brand} just launched ${year}`,
    `${brand} announced ${year}`,
    `${brand} leaks rumors ${year}`,
    `${brand} campaign video ${year}`,
  ];
}

/**
 * Composite query for Tavily Pass 1 (intel-first, single output).
 * @param {string} brandName
 * @param {string} [userQuery]
 * @param {string} [analystBrief]
 * @param {'en' | 'es'} [locale]
 */
export function buildTavilyIntelQuery(brandName, userQuery = "", analystBrief = "", locale = "es") {
  const brand = (brandName || "").trim();
  const year = new Date().getFullYear();
  const intent = locale === "es"
    ? "novedades noticias recientes próximo lanzamiento anuncios oficiales"
    : "what's new latest news upcoming launch official announcements";

  const parts = [
    brand,
    (userQuery || "").trim().slice(0, 120),
    (analystBrief || "").trim().slice(0, 160),
    intent,
    String(year),
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 420);
}

/**
 * Serper Pass 2 queries when campaign signal is confirmed.
 * @param {string} brandName
 * @param {number} rangeDays
 * @param {string} [officialDomain]
 * @param {string} [userQuery]
 */
export function buildSerperCampaignConfirmQueries(brandName, rangeDays, officialDomain = "", userQuery = "") {
  const year = new Date().getFullYear();
  const brand = (brandName || "").trim();
  const q = `"${brand}"`;
  /** @type {string[]} */
  const queries = [];

  const domain = (officialDomain || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (domain) {
    queries.push(`site:${domain} (launch OR lanzamiento OR announce OR "new") ${year}`);
  }

  queries.push(`${q} launch date pre-order ${year}`);
  queries.push(`${q} "just launched" OR "now available" ${year}`);

  const uq = (userQuery || "").trim().slice(0, 80);
  if (uq) queries.push(`${uq} "${brand}"`);

  return queries;
}

/**
 * Normalize brand slug for site: queries (lowercase, no spaces).
 * @param {string} brandName
 */
function brandSlug(brandName) {
  return (brandName || "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Phase 1 signal discovery queries (P1–P4) per Brand Intelligence Agent spec.
 * @param {string} brandName
 * @param {string} [officialDomain]
 * @param {'en' | 'es'} [locale]
 * @returns {string[]}
 */
export function buildSignalDiscoveryQueries(brandName, officialDomain = "", locale = "es") {
  const brand = (brandName || "").trim();
  if (!brand) return [];

  const slug = brandSlug(brand);
  const year = new Date().getFullYear();
  const q = `"${brand}"`;
  const domain = (officialDomain || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

  /** @type {string[]} */
  const queries = [];

  // P1 — Official sources
  if (domain) {
    queries.push(`site:${domain}/news ${year}`);
    queries.push(`site:${domain} press release ${year}`);
  } else {
    queries.push(`site:newsroom.${slug}.com ${year}`);
    queries.push(`site:${slug}.com/news ${year}`);
  }
  queries.push(`${q} filetype:press release ${year}`);

  // P2 — Recent announcements
  queries.push(`${q} announced ${year}`);
  queries.push(`${q} just launched ${year}`);
  queries.push(`${q} released ${year}`);
  queries.push(`${q} reported ${year}`);

  // P3 — Future signals
  queries.push(`${q} upcoming ${year}`);
  queries.push(`${q} will launch ${year}`);
  queries.push(`${q} next release ${year}`);
  queries.push(`${q} ${year}`);
  queries.push(`${q} leak OR rumor ${year}`);

  // P4 — Campaign presence
  queries.push(`${q} new campaign ${year}`);
  queries.push(`${q} new ad ${year}`);
  queries.push(`${q} commercial ${year}`);

  if (locale === "es") {
    queries.push(`${brand} anunció ${year}`);
    queries.push(`${brand} próximo lanzamiento ${year}`);
  }

  return [...new Set(queries.map((s) => s.replace(/\s+/g, " ").trim()))];
}

/**
 * Extra P2/P3 queries for iteration when initial results lack dated sources.
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @returns {string[]}
 */
export function buildSignalDiscoveryRetryQueries(brandName, locale = "es") {
  const brand = (brandName || "").trim();
  if (!brand) return [];
  const year = new Date().getFullYear();
  const q = `"${brand}"`;

  if (locale === "es") {
    return [
      `${brand} acaba de lanzar ${year}`,
      `${brand} filtraciones ${year}`,
      `${q} lanzamiento confirmado ${year}`,
    ];
  }
  return [
    `${q} recently announced ${year}`,
    `${q} leaks rumors ${year}`,
    `${q} confirmed launch ${year}`,
  ];
}

/**
 * Phase 5 market context queries.
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @returns {string[]}
 */
export function buildMarketContextQueries(brandName, locale = "es") {
  const brand = (brandName || "").trim();
  if (!brand) return [];

  if (locale === "es") {
    return [
      `${brand} crecimiento mercado porcentaje Statista`,
      `${brand} ingresos por región Wikipedia`,
      `${brand} market share adopción país ciudad`,
    ];
  }
  return [
    `${brand} market growth percentage Statista`,
    `${brand} revenue by region Wikipedia`,
    `${brand} market share adoption country city`,
  ];
}
