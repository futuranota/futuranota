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
 * Runs Apify actor synchronously when APIFY_API_TOKEN is set.
 * Default actor: apidojo~tweet-scraper (override with APIFY_SOCIAL_ACTOR_ID).
 * @param {string} keyword
 */
export async function fetchApifySocialHype(keyword) {
  const q = (keyword || "").trim();
  if (!q) throw new Error("keyword is required");

  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return mockSocialHype(q);

  const actorId = process.env.APIFY_SOCIAL_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  const runUrl = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;

  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildActorInput(actorId, q)),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
  }

  const items = await res.json();
  const rows = Array.isArray(items) ? items : [];
  const mentions = rows.length;
  const engagement = rows.reduce((sum, row) => {
    const likes = Number(row.likes || row.favorite_count || row.upvotes || 0);
    const comments = Number(row.comments || row.reply_count || row.replies || 0);
    const retweets = Number(row.retweets || row.retweet_count || 0);
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
    samplePosts: rows.slice(0, 5).map((row) => ({
      platform: row.platform || platform,
      text: row.full_text || row.text || row.title || row.snippet || "",
      url: row.url || row.link || row.tweetUrl || null,
    })),
    source: "apify",
    actorId,
  };
}
