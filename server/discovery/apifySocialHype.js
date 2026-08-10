const APIFY_BASE = "https://api.apify.com/v2";
const DEFAULT_ACTOR = "apidojo~tweet-scraper";

function mockSocialHype(keyword) {
  let hash = 0;
  for (let i = 0; i < keyword.length; i += 1) {
    hash = (hash * 31 + keyword.charCodeAt(i)) >>> 0;
  }
  const score = 35 + (hash % 55);
  return {
    keyword,
    hypeScore: score,
    mentions: 120 + (hash % 400),
    engagement: 800 + (hash % 5000),
    platforms: {
      twitter: Math.round(score * 0.4),
      reddit: Math.round(score * 0.35),
      news: Math.round(score * 0.25),
    },
    samplePosts: [
      { platform: "twitter", text: `Buzz building around ${keyword} ahead of the next cycle.` },
      { platform: "reddit", text: `Discussion thread tracking ${keyword} launch rumors.` },
    ],
    source: "mock",
    billed: false,
    computeUnits: null,
    usageTotalUsd: null,
    itemCount: 0,
    runId: null,
  };
}

/**
 * @param {string} actorId
 * @param {string} keyword
 */
function buildActorInput(actorId, keyword) {
  if (actorId.includes("tweet") || actorId.includes("twitter")) {
    return {
      searchTerms: [`${keyword} launch`, `${keyword} announcement`],
      maxItems: 20,
      tweetLanguage: "en",
    };
  }
  if (actorId.includes("google-search")) {
    return {
      queries: `${keyword} launch OR announcement`,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
    };
  }
  return { searchTerms: [keyword], maxItems: 15 };
}

/**
 * @param {unknown} payload
 */
function unwrapApifyData(payload) {
  if (payload && typeof payload === "object" && "data" in /** @type {object} */ (payload)) {
    return /** @type {{ data: unknown }} */ (payload).data;
  }
  return payload;
}

/**
 * Runs Apify actor synchronously when APIFY_API_TOKEN is set.
 * Uses runs?waitForFinish to capture computeUnits / usageTotalUsd (Phase A).
 * Default actor: apidojo~tweet-scraper (override with APIFY_SOCIAL_ACTOR_ID).
 * @param {string} keyword
 */
export async function fetchApifySocialHype(keyword) {
  const q = (keyword || "").trim();
  if (!q) throw new Error("keyword is required");

  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return mockSocialHype(q);

  const actorId = process.env.APIFY_SOCIAL_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  const runUrl =
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`
    + `?token=${encodeURIComponent(token)}&waitForFinish=120`;

  const runRes = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildActorInput(actorId, q)),
  });

  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`Apify ${runRes.status}: ${text.slice(0, 200)}`);
  }

  const runJson = unwrapApifyData(await runRes.json());
  const run = runJson && typeof runJson === "object" ? /** @type {Record<string, unknown>} */ (runJson) : {};
  const stats = run.stats && typeof run.stats === "object"
    ? /** @type {Record<string, unknown>} */ (run.stats)
    : {};
  const computeUnits = stats.computeUnits != null ? Number(stats.computeUnits) : null;
  const usageTotalUsd = run.usageTotalUsd != null ? Number(run.usageTotalUsd) : null;
  const datasetId = typeof run.defaultDatasetId === "string" ? run.defaultDatasetId : null;
  const runId = typeof run.id === "string" ? run.id : null;

  /** @type {unknown[]} */
  let rows = [];
  if (datasetId) {
    const itemsUrl =
      `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items`
      + `?token=${encodeURIComponent(token)}&clean=true&format=json`;
    const itemsRes = await fetch(itemsUrl);
    if (itemsRes.ok) {
      const items = await itemsRes.json();
      rows = Array.isArray(items) ? items : [];
    }
  }

  const mentions = rows.length;
  const engagement = rows.reduce((sum, row) => {
    const r = row && typeof row === "object" ? /** @type {Record<string, unknown>} */ (row) : {};
    const likes = Number(r.likes || r.favorite_count || r.upvotes || 0);
    const comments = Number(r.comments || r.reply_count || r.replies || 0);
    const retweets = Number(r.retweets || r.retweet_count || 0);
    return sum + likes + comments + retweets;
  }, 0);
  const hypeScore = Math.min(100, Math.round(Math.log10(Math.max(mentions, 1) + 1) * 25 + engagement / 500));

  const platform = actorId.includes("tweet") || actorId.includes("twitter") ? "twitter" : "web";

  return {
    keyword: q,
    hypeScore,
    mentions,
    engagement,
    platforms: {
      [platform]: hypeScore,
    },
    samplePosts: rows.slice(0, 5).map((row) => {
      const r = row && typeof row === "object" ? /** @type {Record<string, unknown>} */ (row) : {};
      return {
        platform: r.platform || platform,
        text: r.full_text || r.text || r.title || r.snippet || "",
        url: r.url || r.link || r.tweetUrl || null,
      };
    }),
    source: "apify",
    actorId,
    billed: true,
    computeUnits: Number.isFinite(computeUnits) ? computeUnits : null,
    usageTotalUsd: Number.isFinite(usageTotalUsd) ? usageTotalUsd : null,
    itemCount: mentions,
    runId,
  };
}
