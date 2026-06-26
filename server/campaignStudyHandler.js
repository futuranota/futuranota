import {
  debitTokens,
  getAuthedUser,
  loadCampaignStudy,
  loadUserProfile,
  studyRowToResponse,
  upsertCampaignStudy,
} from "./supabaseServer.js";
import { pipelineKeysConfigured, runCampaignStudyPipeline } from "./campaignStudyPipeline.js";

const TOKEN_COST = 10_000;

/**
 * @param {import('http').IncomingMessage} req
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

/**
 * Core handler — works from Vite middleware and Vercel function.
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined>, body?: unknown }} reqLike
 */
export async function processCampaignStudyRequest(reqLike) {
  const method = reqLike.method || "GET";
  let brandName = "";
  let keyword = "";
  let refresh = false;

  if (method === "GET") {
    const url = new URL(reqLike.url || "", "http://localhost");
    brandName = url.searchParams.get("brandName")?.trim() || "";
    keyword = url.searchParams.get("keyword")?.trim() || "";
  } else if (method === "POST") {
    const body = reqLike.body && typeof reqLike.body === "object"
      ? reqLike.body
      : {};
    brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
    refresh = Boolean(body.refresh);
  } else {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  if (!brandName) {
    return { status: 400, body: { error: "brandName is required" } };
  }

  const fakeReq = { headers: reqLike.headers || {} };
  const { user, supabase } = await getAuthedUser(fakeReq);
  if (!user || !supabase) {
    return { status: 401, body: { error: "Authentication required" } };
  }

  const profile = await loadUserProfile(supabase, user.id);
  if (!profile) {
    return { status: 404, body: { error: "Profile not found" } };
  }

  const cached = await loadCampaignStudy(supabase, user.id, brandName);
  if (cached && !refresh) {
    return { status: 200, body: studyRowToResponse(cached, { fromCache: true, tokensDebited: 0 }) };
  }

  if (method === "GET") {
    return { status: 404, body: { error: "No cached study — POST with refresh to run live" } };
  }

  const plan = profile.plan === "pro" ? "pro" : "free";
  if (plan === "free" && profile.campaign_live_used) {
    if (cached) {
      return { status: 200, body: studyRowToResponse(cached, { fromCache: true, tokensDebited: 0 }) };
    }
    return { status: 403, body: { error: "Free plan: campaign live already used", code: "campaign_frozen" } };
  }

  const balance = profile.tokens_balance ?? 0;
  if (balance < TOKEN_COST) {
    return {
      status: 403,
      body: { error: "Insufficient tokens", code: "tokens", tokensRequired: TOKEN_COST },
    };
  }

  if (!pipelineKeysConfigured()) {
    return { status: 503, body: { error: "Campaign study pipeline unavailable — configure GROQ_API_KEY" } };
  }

  const pipeline = await runCampaignStudyPipeline(brandName, keyword || brandName);

  const row = await upsertCampaignStudy({
    supabase,
    userId: user.id,
    row: {
      brand_name: brandName,
      keyword: keyword || brandName,
      campaign_status: pipeline.status,
      campaign_active: pipeline.campaignActive,
      overview: pipeline.overview,
      note: pipeline.note,
      people_also_ask: pipeline.peopleAlsoAsk,
      social_hype: pipeline.socialHype,
      search_intent: pipeline.searchIntent,
      source: pipeline.source,
    },
  });

  const debit = await debitTokens(supabase, { ...profile, user_id: user.id }, TOKEN_COST);

  return {
    status: 200,
    body: {
      ...studyRowToResponse(row, { fromCache: false, tokensDebited: TOKEN_COST }),
      tokensBalance: debit.tokens_balance,
      campaignLiveUsed: debit.campaign_live_used,
    },
  };
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleCampaignStudy(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  const path = req.url?.split("?")[0];
  if (path !== "/api/analytics/campaign-study") return false;

  try {
    let body;
    if (req.method === "POST") {
      body = await readJsonBody(req);
    }
    const result = await processCampaignStudyRequest({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    });
    sendJson(res, result.status, result.body);
    return true;
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "Campaign study failed",
    });
    return true;
  }
}

export function createCampaignStudyMiddleware() {
  return async (req, res, next) => {
    const handled = await handleCampaignStudy(req, res);
    if (!handled) next();
  };
}
