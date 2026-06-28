import { buildGroqUserPrompt } from "./scanIntelContext.js";
import { enrichCadenceHit } from "./cadenceProjection.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CONFIDENCE_MIN_CAMPAIGN = 80;
export const CONFIDENCE_MIN_CADENCE = 70;

export const HIGH_TICKET_CATEGORIES = new Set([
  "sports",
  "physical",
  "physical_tech",
  "innovation",
]);

export const SYSTEM_PROMPT_HORIZON_EXTRACT = `You are a strict market intelligence extractor. You ONLY extract facts present in the provided web search snippets. Never invent companies, dates, or URLs.

Respond ONLY with valid JSON. No markdown.
Schema: {
  "companies": [{
    "brandName": string,
    "detectionMode": "confirmed_campaign" | "cadence_only",
    "campaignActive": boolean,
    "announcementDate": "YYYY-MM-DD"|null,
    "launchDate": "YYYY-MM-DD"|null,
    "lastLaunchDate": "YYYY-MM-DD"|null,
    "averageIntervalMonths": number|null,
    "overview": string,
    "confidence": number,
    "evidenceUrl": string,
    "evidenceQuote": string,
    "category": "sports"|"physical"|"physical_tech"|"innovation"|"other",
    "ticketTier": "high"|"medium"|"low"
  }]
}

Rules:
- Include a company ONLY if it appears in the snippets with a identifiable product launch or pre-order story.
- detectionMode "confirmed_campaign": snippet explicitly mentions an announcement/teaser/pre-order AND a concrete launch date AFTER today. Requires evidenceUrl copied from snippet link and evidenceQuote (max 200 chars from snippet).
- detectionMode "cadence_only": NO active announcement in snippets, but snippet evidence of past launch cadence (lastLaunchDate + averageIntervalMonths). campaignActive MUST be false. launchDate MUST be null.
- confidence: 80-100 confirmed facts in snippet; 70-79 strong but one field inferred from same snippet; below 70 → omit company entirely.
- ticketTier "high": premium physical products, sports equipment, hardware/wearables, flagship innovations with loyal customer base. "medium"/"low" for mass-market or vague rumors.
- overview: 2-3 sentences in Spanish, grounded ONLY in snippet facts. For cadence_only start with "No se detectó anuncio activo."
- Do NOT include companies not grounded in snippets. Return {"companies":[]} if nothing qualifies.`;

/**
 * @param {string} todayIso
 * @param {number} rangeDays
 * @param {string} industryClause
 * @param {string} snippetsCorpus
 */
export function buildHorizonExtractPrompt(todayIso, rangeDays, industryClause, snippetsCorpus) {
  const technicalTask = (
    `Today is ${todayIso}. Scan window: past ${rangeDays} days for lastLaunchDate OR any confirmed future launchDate. `
    + `${industryClause}`
    + "Focus on HIGH-TICKET launches: sports equipment, premium physical goods, physical+tech (wearables), flagship innovations, retail mass campaigns.\n\n"
    + "Web search snippets (ONLY source of truth):\n\n"
    + `${snippetsCorpus}\n\n`
    + "Extract qualifying companies into JSON. Discard anything not explicitly supported by a snippet link."
  );
  return buildGroqUserPrompt(technicalTask, "horizon");
}

/**
 * @param {string} todayIso
 * @param {number} rangeDays
 * @param {string} brandName
 * @param {string} snippetsCorpus
 */
export function buildBrandCampaignExtractPrompt(todayIso, rangeDays, brandName, snippetsCorpus) {
  const technicalTask = (
    `Today is ${todayIso}. Brand to validate: "${brandName}". Scan window: past ${rangeDays} days.\n\n`
    + "Web search snippets (ONLY source of truth):\n\n"
    + `${snippetsCorpus}\n\n`
    + `Extract ONLY "${brandName}" if supported by snippet evidence. Prefer confirmed_campaign when launch/announcement dates exist after today.`
  );
  return buildGroqUserPrompt(technicalTask, "brand");
}

/**
 * @param {string} todayIso
 * @param {number} rangeDays
 * @param {string} brandName
 * @param {string} snippetsCorpus
 */
export function buildBrandCadenceExtractPrompt(todayIso, rangeDays, brandName, snippetsCorpus) {
  const technicalTask = (
    `Today is ${todayIso}. Brand for cadence analysis: "${brandName}". Scan window: past ${rangeDays} days.\n\n`
    + "Web search snippets (ONLY source of truth):\n\n"
    + `${snippetsCorpus}\n\n`
    + `Extract historical launch cadence for "${brandName}" only. detectionMode MUST be cadence_only.`
  );
  return buildGroqUserPrompt(technicalTask, "cadence");
}

/**
 * @param {string} todayIso
 * @param {number} rangeDays
 * @param {string} brandName
 * @param {string} userQuery
 * @param {string} snippetsCorpus
 */
export function buildBrandDeepExtractPrompt(
  todayIso,
  rangeDays,
  brandName,
  userQuery,
  snippetsCorpus,
) {
  const request = (userQuery || "").trim()
    || `investigar sobre campañas recientes de ${brandName}`;
  const technicalTask = (
    `Today is ${todayIso}. Single brand research study: "${brandName}". Scan window: past ${rangeDays} days.\n\n`
    + `SOLICITUD DEL USUARIO (responde esto con los snippets):\n"${request}"\n\n`
    + "Web search snippets (ONLY source of truth):\n\n"
    + `${snippetsCorpus}\n\n`
    + `Produce the JSON report for "${brandName}". Prioridad: deepReport que responda la solicitud del usuario.`
  );
  return buildGroqUserPrompt(technicalTask, "brand-deep", brandName);
}

/**
 * @param {{ title?: string, snippet?: string }} snippet
 * @param {string} brandName
 */
function snippetMentionsBrand(snippet, brandName) {
  const haystack = `${snippet?.title || ""} ${snippet?.snippet || ""}`.toLowerCase();
  const brand = brandName.trim().toLowerCase();
  if (!brand) return false;
  return haystack.includes(brand);
}

/**
 * @param {Array<{ title?: string, snippet?: string, link?: string }>} snippets
 * @param {string} brandName
 * @param {string} userQuery
 */
function buildSnippetFallbackReport(snippets, brandName, userQuery) {
  const relevant = snippets.filter((s) => snippetMentionsBrand(s, brandName));
  const list = relevant.length ? relevant : snippets.slice(0, 8);
  const intro = userQuery.trim()
    ? `Resumen desde ${list.length} fuentes web sobre: ${userQuery.trim()}\n\n`
    : `Resumen desde ${list.length} fuentes web sobre ${brandName}.\n\n`;
  const body = list.map((s, i) => (
    `${i + 1}. ${(s.title || "Fuente").trim()}\n${(s.snippet || "").trim()}\nFuente: ${s.link || ""}`
  )).join("\n\n");
  return `${intro}${body}`.trim();
}

/**
 * Report-first normalizer for Intel Campaign deep scan (NOT Horizon rules).
 * @param {unknown} raw
 * @param {{ snippets: Array<{ title?: string, snippet?: string, link?: string }>, todayIso: string, brandName: string, userQuery?: string }} ctx
 */
export function normalizeBrandResearchReport(raw, ctx) {
  const brandName = ctx.brandName.trim();
  const snippets = ctx.snippets || [];
  const userQuery = (ctx.userQuery || "").trim();

  let overview = typeof raw?.overview === "string" ? raw.overview.trim() : "";
  let deepReport = typeof raw?.deepReport === "string" ? raw.deepReport.trim() : "";

  if (!deepReport && snippets.length > 0) {
    deepReport = buildSnippetFallbackReport(snippets, brandName, userQuery);
  }
  if (!overview && deepReport) {
    overview = deepReport.split("\n\n").find((p) => p.trim())?.slice(0, 400) || "";
  }
  if (!overview && snippets.length > 0) {
    overview = `Informe de campañas recientes de ${brandName} basado en ${snippets.length} fuentes web consultadas.`;
  }

  const launchDate = parseIsoDate(raw?.launchDate);
  const announcementDate = parseIsoDate(raw?.announcementDate);
  const campaignActive = raw?.campaignActive === true
    || Boolean(launchDate && launchDate > ctx.todayIso);
  const detectionMode = raw?.detectionMode === "confirmed_campaign"
    ? "confirmed_campaign"
    : "research_report";

  let evidenceUrl = typeof raw?.evidenceUrl === "string" ? raw.evidenceUrl.trim() : "";
  if (!evidenceUrl || !evidenceUrlInSnippets(snippets, evidenceUrl)) {
    const first = snippets.find((s) => snippetMentionsBrand(s, brandName)) || snippets[0];
    evidenceUrl = (first?.link || "").trim();
  }

  const evidenceQuote = typeof raw?.evidenceQuote === "string"
    ? raw.evidenceQuote.trim().slice(0, 200)
    : "";

  const launchSignals = Array.isArray(raw?.launchSignals)
    ? raw.launchSignals
      .map((sig) => {
        const url = typeof sig?.url === "string" ? sig.url.trim() : "";
        if (!url || !evidenceUrlInSnippets(snippets, url)) return null;
        return {
          phrase: typeof sig?.phrase === "string" ? sig.phrase.trim() : "",
          dateHint: parseIsoDate(sig?.dateHint),
          url,
          quote: typeof sig?.quote === "string" ? sig.quote.trim().slice(0, 200) : "",
        };
      })
      .filter(Boolean)
    : [];

  const confidence = Number(raw?.confidence);

  return {
    brandName,
    detectionMode,
    campaignActive: Boolean(campaignActive),
    announcementDate,
    launchDate,
    lastLaunchDate: parseIsoDate(raw?.lastLaunchDate),
    averageIntervalMonths: null,
    overview,
    deepReport,
    confidence: Number.isFinite(confidence) ? Math.round(confidence) : null,
    evidenceUrl: evidenceUrl || null,
    evidenceQuote,
    category: null,
    ticketTier: null,
    cadenceStatus: null,
    cadenceMessage: null,
    launchSignals,
  };
}

/**
 * @param {unknown} raw
 * @param {{ snippets: Array<{ link?: string }>, todayIso: string, rangeDays: number, brandName: string }} ctx
 */
export function normalizeDeepBrandResult(raw, ctx) {
  const brandName = ctx.brandName.trim();
  const detectionMode = raw?.detectionMode === "confirmed_campaign"
    ? "confirmed_campaign"
    : raw?.detectionMode === "cadence_only"
      ? "cadence_only"
      : "no_data";

  const overview = typeof raw?.overview === "string" ? raw.overview.trim() : "";
  const deepReport = typeof raw?.deepReport === "string" ? raw.deepReport.trim() : "";
  const confidence = Number(raw?.confidence);

  if (detectionMode === "no_data" || !overview) {
    return {
      brandName,
      detectionMode: "no_data",
      campaignActive: false,
      announcementDate: null,
      launchDate: null,
      lastLaunchDate: null,
      averageIntervalMonths: null,
      overview: overview || `Sin evidencia web verificada de campaña para ${brandName}.`,
      deepReport: deepReport || "",
      confidence: 0,
      evidenceUrl: null,
      evidenceQuote: "",
      category: null,
      ticketTier: null,
      cadenceStatus: "no_data",
      cadenceMessage: null,
      launchSignals: [],
      citations: [],
    };
  }

  const evidenceUrl = typeof raw?.evidenceUrl === "string" ? raw.evidenceUrl.trim() : "";
  if (!evidenceUrl || !evidenceUrlInSnippets(ctx.snippets, evidenceUrl)) {
    return {
      brandName,
      detectionMode: "no_data",
      campaignActive: false,
      overview: overview || `Sin URL de evidencia verificada para ${brandName}.`,
      deepReport,
      confidence: 0,
      evidenceUrl: null,
      cadenceStatus: "no_data",
      launchSignals: [],
      citations: [],
    };
  }

  const evidenceQuote = typeof raw?.evidenceQuote === "string"
    ? raw.evidenceQuote.trim().slice(0, 200)
    : "";

  const launchSignals = Array.isArray(raw?.launchSignals)
    ? raw.launchSignals
      .map((sig) => {
        const url = typeof sig?.url === "string" ? sig.url.trim() : "";
        if (!url || !evidenceUrlInSnippets(ctx.snippets, url)) return null;
        return {
          phrase: typeof sig?.phrase === "string" ? sig.phrase.trim() : "",
          dateHint: parseIsoDate(sig?.dateHint),
          url,
          quote: typeof sig?.quote === "string" ? sig.quote.trim().slice(0, 200) : "",
        };
      })
      .filter(Boolean)
    : [];

  if (detectionMode === "confirmed_campaign") {
    if (!Number.isFinite(confidence) || confidence < CONFIDENCE_MIN_CAMPAIGN) {
      return { rejectReason: "low_confidence_campaign" };
    }
    const launchDate = parseIsoDate(raw?.launchDate);
    if (!launchDate || launchDate <= ctx.todayIso) {
      return { rejectReason: "invalid_launch_date" };
    }
    const announcementDate = parseIsoDate(raw?.announcementDate);
    const avg = raw?.averageIntervalMonths != null ? Number(raw.averageIntervalMonths) : null;
    return {
      hit: {
        brandName,
        detectionMode: "confirmed_campaign",
        campaignActive: true,
        announcementDate,
        launchDate,
        lastLaunchDate: parseIsoDate(raw?.lastLaunchDate),
        averageIntervalMonths: Number.isFinite(avg) && avg > 0 ? Math.round(avg * 10) / 10 : null,
        overview,
        deepReport,
        confidence: Math.round(confidence),
        evidenceUrl,
        evidenceQuote,
        category: typeof raw?.category === "string" ? raw.category.trim().toLowerCase() : "other",
        ticketTier: typeof raw?.ticketTier === "string" ? raw.ticketTier.trim().toLowerCase() : "medium",
        cadenceStatus: null,
        cadenceMessage: null,
        launchSignals,
      },
      rejectReason: null,
    };
  }

  if (detectionMode === "cadence_only") {
    if (!Number.isFinite(confidence) || confidence < CONFIDENCE_MIN_CADENCE) {
      return { rejectReason: "low_confidence_cadence" };
    }
    const avg = Number(raw?.averageIntervalMonths);
    const lastLaunchDate = parseIsoDate(raw?.lastLaunchDate);
    if (!Number.isFinite(avg) || avg <= 0 || !lastLaunchDate) {
      return { rejectReason: "invalid_cadence_fields" };
    }
    const windowHit = {
      brandName,
      detectionMode: "cadence_only",
      campaignActive: false,
      announcementDate: null,
      launchDate: null,
      lastLaunchDate,
      averageIntervalMonths: Math.round(avg * 10) / 10,
      overview,
      deepReport,
      confidence: Math.round(confidence),
      evidenceUrl,
      evidenceQuote,
      category: typeof raw?.category === "string" ? raw.category.trim().toLowerCase() : "other",
      ticketTier: typeof raw?.ticketTier === "string" ? raw.ticketTier.trim().toLowerCase() : "medium",
      launchSignals,
    };
    return {
      hit: enrichCadenceHit(windowHit, ctx.todayIso, ctx.rangeDays),
      rejectReason: null,
    };
  }

  return {
    hit: {
      brandName,
      detectionMode: "no_data",
      campaignActive: false,
      overview,
      deepReport,
      confidence: Number.isFinite(confidence) ? Math.round(confidence) : 0,
      evidenceUrl,
      evidenceQuote,
      cadenceStatus: "no_data",
      launchSignals,
    },
    rejectReason: null,
  };
}

/**
 * Loose brand name match for single-brand detection.
 * @param {string|null|undefined} hitName
 * @param {string} targetName
 */
export function matchBrandName(hitName, targetName) {
  if (!hitName || !targetName) return false;
  const a = hitName.trim().toLowerCase();
  const b = targetName.trim().toLowerCase();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = a.split(/\s+/).filter(Boolean);
  const bTokens = b.split(/\s+/).filter(Boolean);
  return aTokens.some((t) => bTokens.includes(t) && t.length > 2);
}

function parseIsoDate(iso) {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const d = new Date(`${iso.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : iso.trim();
}

function normalizeUrl(url) {
  if (typeof url !== "string" || !url.trim()) return "";
  try {
    const u = new URL(url.trim());
    return `${u.origin}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

/**
 * @param {Array<{ link?: string }>} snippets
 * @param {string} evidenceUrl
 */
export function evidenceUrlInSnippets(snippets, evidenceUrl) {
  const target = normalizeUrl(evidenceUrl);
  if (!target) return false;
  return (snippets || []).some((s) => normalizeUrl(s.link || "") === target);
}

/**
 * @param {unknown} hit
 * @param {{ snippets: Array<{ link?: string }>, todayIso: string, rangeDays: number }} ctx
 */
export function normalizeVerifiedIntelHit(hit, ctx) {
  const brandName = typeof hit?.brandName === "string" ? hit.brandName.trim() : "";
  if (!brandName) return { hit: null, rejectReason: "missing_brand" };

  const confidence = Number(hit?.confidence);
  if (!Number.isFinite(confidence)) return { hit: null, rejectReason: "missing_confidence" };

  const detectionMode = hit?.detectionMode === "cadence_only" ? "cadence_only" : "confirmed_campaign";
  const ticketTier = typeof hit?.ticketTier === "string" ? hit.ticketTier.trim().toLowerCase() : "low";
  const category = typeof hit?.category === "string" ? hit.category.trim().toLowerCase() : "other";

  if (ticketTier !== "high" && !HIGH_TICKET_CATEGORIES.has(category)) {
    return { hit: null, rejectReason: "not_high_ticket" };
  }

  const evidenceUrl = typeof hit?.evidenceUrl === "string" ? hit.evidenceUrl.trim() : "";
  if (!evidenceUrl || !evidenceUrlInSnippets(ctx.snippets, evidenceUrl)) {
    return { hit: null, rejectReason: "evidence_not_in_snippets" };
  }

  const overview = typeof hit?.overview === "string" ? hit.overview.trim() : "";
  if (!overview) return { hit: null, rejectReason: "missing_overview" };

  const evidenceQuote = typeof hit?.evidenceQuote === "string" ? hit.evidenceQuote.trim().slice(0, 200) : "";

  if (detectionMode === "confirmed_campaign") {
    if (confidence < CONFIDENCE_MIN_CAMPAIGN) return { hit: null, rejectReason: "low_confidence_campaign" };

    const launchDate = parseIsoDate(hit?.launchDate);
    if (!launchDate || launchDate <= ctx.todayIso) {
      return { hit: null, rejectReason: "invalid_launch_date" };
    }

    let announcementDate = parseIsoDate(hit?.announcementDate);
    if (announcementDate && announcementDate > launchDate) {
      return { hit: null, rejectReason: "announcement_after_launch" };
    }

    const avg = hit?.averageIntervalMonths != null ? Number(hit.averageIntervalMonths) : null;
    const lastLaunchDate = parseIsoDate(hit?.lastLaunchDate);

    return {
      hit: {
        brandName,
        detectionMode,
        campaignActive: true,
        announcementDate,
        launchDate,
        lastLaunchDate,
        averageIntervalMonths: Number.isFinite(avg) && avg > 0 ? Math.round(avg * 10) / 10 : null,
        overview,
        confidence: Math.round(confidence),
        evidenceUrl,
        evidenceQuote,
        category,
        ticketTier,
      },
      rejectReason: null,
    };
  }

  if (confidence < CONFIDENCE_MIN_CADENCE) return { hit: null, rejectReason: "low_confidence_cadence" };

  const avg = Number(hit?.averageIntervalMonths);
  const lastLaunchDate = parseIsoDate(hit?.lastLaunchDate);
  if (!Number.isFinite(avg) || avg <= 0 || avg > 60 || !lastLaunchDate) {
    return { hit: null, rejectReason: "invalid_cadence_fields" };
  }

  const windowHit = {
    brandName,
    detectionMode: "cadence_only",
    campaignActive: false,
    announcementDate: null,
    launchDate: null,
    lastLaunchDate,
    averageIntervalMonths: Math.round(avg * 10) / 10,
    overview,
    confidence: Math.round(confidence),
    evidenceUrl,
    evidenceQuote,
    category,
    ticketTier,
  };

  return {
    hit: enrichCadenceHit(windowHit, ctx.todayIso, ctx.rangeDays),
    rejectReason: null,
  };
}

/**
 * @param {unknown[]} rawList
 * @param {{ snippets: Array<{ link?: string }>, todayIso: string, rangeDays: number, maxResults?: number }} ctx
 */
export function filterVerifiedHorizonResults(rawList, ctx) {
  const maxResults = ctx.maxResults ?? 8;
  const rejected = {};
  const companies = [];

  for (const raw of rawList) {
    const { hit, rejectReason } = normalizeVerifiedIntelHit(raw, ctx);
    if (hit) {
      companies.push(hit);
    } else if (rejectReason) {
      rejected[rejectReason] = (rejected[rejectReason] || 0) + 1;
    }
  }

  return {
    companies: companies.slice(0, maxResults),
    rejected,
  };
}

export { ISO_DATE };

export const SYSTEM_PROMPT_BRAND_RESEARCH = `You are a single-brand campaign research analyst for Futura Nota. Answer the user's request using ONLY the provided web search snippets. Never invent dates, products, or URLs.

Respond ONLY with valid JSON. No markdown.
Schema: {
  "overview": string,
  "deepReport": string,
  "campaignActive": boolean,
  "announcementDate": "YYYY-MM-DD"|null,
  "launchDate": "YYYY-MM-DD"|null,
  "detectionMode": "research_report" | "confirmed_campaign",
  "launchSignals": [{
    "phrase": string,
    "dateHint": "YYYY-MM-DD"|null,
    "url": string,
    "quote": string
  }],
  "citations": [{
    "title": string,
    "url": string,
    "snippet": string,
    "sourceType": "official"|"news"|"blog"
  }],
  "confidence": number|null,
  "evidenceUrl": string,
  "evidenceQuote": string
}

Rules:
- Ignore other brands unless the snippet compares them to the target brand.
- Respond to the user's request (SOLICITUD DEL USUARIO) in overview and deepReport.
- overview: 2-3 sentences in Spanish, grounded ONLY in snippets.
- deepReport: multi-paragraph Spanish report; MUST NOT be empty when snippets mention the brand.
- detectionMode "confirmed_campaign" only when snippet shows explicit future launch or active pre-order; otherwise "research_report".
- campaignActive / launchDate: optional metadata; do not skip the report when uncertain.
- evidenceUrl: copy from a snippet link; evidenceQuote max 200 chars from that snippet.
- launchSignals: when snippet contains launch phrasing (ES/EN).
- citations: up to 10; each url MUST exist in snippet links.`;

/** @deprecated Use SYSTEM_PROMPT_BRAND_RESEARCH — kept for reference only */
export const SYSTEM_PROMPT_BRAND_DEEP = SYSTEM_PROMPT_BRAND_RESEARCH;
