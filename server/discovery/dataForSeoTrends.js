import { getDataForSeoAuthHeader, isDataForSeoConfigured } from "./dataForSeoAuth.js";
import { DEFAULT_RANGE_DAYS } from "../../src/lib/campaignWindow.js";

const EXPLORE_URL = "https://api.dataforseo.com/v3/keywords_data/dataforseo_trends/explore/live";
const SUBREGION_URL = "https://api.dataforseo.com/v3/keywords_data/dataforseo_trends/subregion_interests/live";

/**
 * @typedef {Object} MarketInterest
 * @property {string} keyword
 * @property {number|null} interestChangePercent
 * @property {string[]} topRegions
 * @property {"dataforseo"|"unavailable"} source
 */

/**
 * @param {string} url
 */
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/**
 * @param {number[]} values
 */
function computeInterestChangePercent(values) {
  const nums = (values || []).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length < 2) return null;
  const first = nums.find((v) => v > 0) ?? nums[0];
  const last = [...nums].reverse().find((v) => v > 0) ?? nums[nums.length - 1];
  if (!first || first <= 0) return null;
  return Math.round(((last - first) / first) * 100);
}

/**
 * @param {string} auth
 * @param {string} keyword
 */
async function fetchExploreSeries(auth, keyword) {
  const res = await fetch(EXPLORE_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      keywords: [keyword],
      type: "web",
      date_from: daysAgoIso(DEFAULT_RANGE_DAYS),
    }]),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO explore ${res.status}: ${text.slice(0, 160)}`);
  }

  const data = await res.json();
  const task = data?.tasks?.[0];
  const result = task?.result?.[0];
  const items = Array.isArray(result?.items) ? result.items : [];

  for (const item of items) {
    if (item?.type !== "dataforseo_trends_graph") continue;
    const dataPoints = item?.data?.values || item?.values;
    if (Array.isArray(dataPoints)) {
      return dataPoints.filter((v) => typeof v === "number");
    }
  }

  return [];
}

/**
 * @param {string} auth
 * @param {string} keyword
 */
async function fetchTopRegions(auth, keyword) {
  const res = await fetch(SUBREGION_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      keywords: [keyword],
      type: "web",
      date_from: daysAgoIso(DEFAULT_RANGE_DAYS),
    }]),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const task = data?.tasks?.[0];
  const result = task?.result?.[0];
  const interests = result?.items?.[0]?.interests || result?.interests || [];

  /** @type {{ name: string, score: number }[]} */
  const ranked = [];
  for (const block of interests) {
    const keywordData = block?.interests || [block];
    for (const entry of keywordData) {
      const values = entry?.values || [];
      const maxVal = Math.max(...values.filter((v) => typeof v === "number"), 0);
      const name = entry?.geo_name || entry?.location_name || entry?.keyword || "";
      if (name && maxVal > 0) ranked.push({ name: String(name), score: maxVal });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const row of ranked) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.name);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * @param {number} days
 */
function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * @param {string} brandName
 * @param {string} [userQuery]
 * @returns {Promise<MarketInterest>}
 */
export async function fetchDataForSeoTrends(brandName, userQuery = "") {
  const brand = (brandName || "").trim();
  const keyword = brand || (userQuery || "").trim().slice(0, 80);
  if (!keyword) {
    return { keyword: "", interestChangePercent: null, topRegions: [], source: "unavailable" };
  }

  const auth = getDataForSeoAuthHeader();
  if (!auth || !isDataForSeoConfigured()) {
    return { keyword, interestChangePercent: null, topRegions: [], source: "unavailable" };
  }

  try {
    const [series, regions] = await Promise.all([
      fetchExploreSeries(auth, keyword).catch(() => []),
      fetchTopRegions(auth, keyword).catch(() => []),
    ]);

    const interestChangePercent = computeInterestChangePercent(series);

    return {
      keyword,
      interestChangePercent,
      topRegions: regions,
      source: interestChangePercent !== null || regions.length ? "dataforseo" : "unavailable",
    };
  } catch (err) {
    console.error("[intel] dataforseo trends error:", err instanceof Error ? err.message : err);
    return { keyword, interestChangePercent: null, topRegions: [], source: "unavailable" };
  }
}

export { domainFromUrl };
