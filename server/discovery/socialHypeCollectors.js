import { searchWebMulti } from "./serpApiSearch.js";
import { fetchApifySocialHype } from "./apifySocialHype.js";
import { fetchDataForSeoPaa } from "./dataForSeoPaa.js";

/** @typedef {'TikTok'|'Instagram'|'X (Twitter)'|'YouTube'|'Reddit'|'Press'} HypePlatform */

/** @typedef {{ platform: HypePlatform, hits: number, engagement: number, samples: Array<{ platform: string, text: string, url: string|null }> }} PlatformSignal */

const PLATFORM_SITE_QUERIES = [
  { platform: "TikTok", query: (brand) => `site:tiktok.com "${brand}" campaign OR launch` },
  { platform: "Instagram", query: (brand) => `site:instagram.com "${brand}" campaign OR launch` },
  { platform: "YouTube", query: (brand) => `site:youtube.com "${brand}" official OR launch` },
  { platform: "Reddit", query: (brand) => `site:reddit.com "${brand}" launch OR announcement` },
  { platform: "Press", query: (brand) => `"${brand}" campaign OR ad OR commercial 2026` },
];

/**
 * @param {string} brandName
 * @param {string} [keyword]
 */
export async function collectSocialHypeSignals(brandName, keyword) {
  const brand = brandName.trim();
  const searchKeyword = (keyword || brand).trim();
  if (!brand) throw new Error("brandName is required");

  const serperQueries = PLATFORM_SITE_QUERIES.map(({ query }) => query(brand));

  const [serperHits, apifyResult, paaResult] = await Promise.all([
    searchWebMulti(serperQueries, { maxQueries: 6 }),
    fetchApifySocialHype(searchKeyword).catch(() => null),
    fetchDataForSeoPaa(searchKeyword).catch(() => null),
  ]);

  /** @type {PlatformSignal[]} */
  const platformSignals = PLATFORM_SITE_QUERIES.map(({ platform, query }) => {
    const q = query(brand);
    const hitsForQuery = Array.isArray(serperHits)
      ? serperHits.filter((hit) => {
        const link = (hit.link || "").toLowerCase();
        if (platform === "TikTok") return link.includes("tiktok.com");
        if (platform === "Instagram") return link.includes("instagram.com");
        if (platform === "YouTube") return link.includes("youtube.com") || link.includes("youtu.be");
        if (platform === "Reddit") return link.includes("reddit.com");
        if (platform === "Press") {
          return !link.includes("tiktok.com")
            && !link.includes("instagram.com")
            && !link.includes("youtube.com")
            && !link.includes("reddit.com")
            && !link.includes("twitter.com")
            && !link.includes("x.com");
        }
        return false;
      })
      : [];

    return {
      platform,
      hits: hitsForQuery.length,
      engagement: hitsForQuery.length * 12,
      samples: hitsForQuery.slice(0, 3).map((hit) => ({
        platform,
        text: [hit.title, hit.snippet].filter(Boolean).join(" — ").slice(0, 280),
        url: hit.link || null,
      })),
    };
  });

  const twitterHits = apifyResult?.mentions ?? 0;
  const twitterEngagement = apifyResult?.engagement ?? 0;
  const twitterSamples = (apifyResult?.samplePosts || []).slice(0, 3).map((post) => ({
    platform: "X (Twitter)",
    text: (post.text || "").slice(0, 280),
    url: post.url || null,
  }));

  platformSignals.push({
    platform: "X (Twitter)",
    hits: twitterHits,
    engagement: twitterEngagement,
    samples: twitterSamples,
  });

  const collectorSources = [];
  if (serperHits) collectorSources.push("serper");
  if (apifyResult?.source) collectorSources.push(apifyResult.source === "mock" ? "apify-mock" : "apify");
  if (paaResult?.source) collectorSources.push(paaResult.source === "mock" ? "dataforseo-mock" : "dataforseo");

  return {
    brandName: brand,
    keyword: searchKeyword,
    platformSignals,
    apifyResult,
    paaResult,
    collectorSources,
    collectedAt: new Date().toISOString(),
  };
}
