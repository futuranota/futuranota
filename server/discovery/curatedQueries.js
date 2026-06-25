/**
 * Builds site:-scoped Serper queries from admin curated sources.
 * @param {Array<{ domain: string, pathPrefix?: string, enabled?: boolean }>} sources
 * @param {number} rangeDays
 * @param {string} [industry]
 */
export function buildCuratedSourceQueries(sources, rangeDays, industry) {
  const enabled = (sources || []).filter((s) => s.enabled !== false && s.domain);
  if (enabled.length === 0) return [];

  const year = new Date().getFullYear();
  const scope = industry ? ` ${industry}` : "";
  const launchTerms = '"announces" OR "pre-order" OR "launch date" OR "available" OR "shipping"';

  return enabled.slice(0, 15).map((src) => {
    const site = src.pathPrefix
      ? `site:${src.domain}${src.pathPrefix}`
      : `site:${src.domain}`;
    return `${site} (${launchTerms}) ${year}${scope}`;
  });
}
