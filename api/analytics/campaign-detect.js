// api/analytics/campaign-detect.js
// Vercel Function — espejo de server/campaignDetectorHandler.js para producción.
// Usa process.env (no import.meta.env) — estándar de Vercel Functions

import { completeJson } from "../../server/llmJson.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function referenceMonthLabel() {
  const now = new Date();
  return `${MONTH_LABELS[now.getMonth()]} ${now.getFullYear()}`;
}

const SYSTEM_PROMPT = `You are a market intelligence analyst specialized in detecting active product launch campaigns from major brands. Today's date will be injected in every prompt — use it to calculate all dates correctly and never return dates from the past as future launch dates.

Rules:
- "campaignActive": true ONLY if launch is within 90 days from today
- "phase": "upcoming" (60-90d), "imminent" (20-60d), "live" (0-20d) — null if no campaign
- "launchDate": must be AFTER today, or null
- "lastLaunchDate": most recent confirmed past launch
- "overview": 2-3 sentences in the same language as the input
- "confidence": 80-100 confirmed, 50-79 probable, 0-49 speculative
- "category": tech | fashion | food | automotive | entertainment | retail | finance | health | other

Respond ONLY with valid JSON. No markdown, no text outside JSON.
Schema: { "campaignActive": boolean, "phase": "upcoming"|"imminent"|"live"|null, "launchDate": "YYYY-MM-DD"|null, "overview": string, "averageIntervalMonths": number, "lastLaunchDate": "YYYY-MM-DD", "confidence": number, "category": string }`;

function mockCampaignForBrand(brandName) {
  let hash = 0;
  for (let i = 0; i < brandName.length; i += 1) {
    hash = (hash * 31 + brandName.charCodeAt(i)) >>> 0;
  }
  const averageIntervalMonths = 10 + (hash % 8);
  const monthsAgo = 3 + (hash % 5);
  const last = new Date(2026, 5 - monthsAgo, 12);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, "0");
  const d = String(last.getDate()).padStart(2, "0");
  const lastLaunchDate = `${y}-${m}-${d}`;

  const campaignActive = hash % 2 === 0;
  let launchDate = null;
  let overview = `Sin campaña activa detectada para ${brandName} en este momento.`;
  if (campaignActive) {
    const daysAhead = 5 + (hash % 30);
    const launch = new Date();
    launch.setDate(launch.getDate() + daysAhead);
    launchDate = `${launch.getFullYear()}-${String(launch.getMonth() + 1).padStart(2, "0")}-${String(launch.getDate()).padStart(2, "0")}`;
    overview = `${brandName} parece tener una campaña de lanzamiento en curso, con fecha estimada el ${launchDate}.`;
  }

  return {
    campaignActive,
    category: "product launch",
    launchDate,
    overview,
    averageIntervalMonths,
    lastLaunchDate,
    source: "mock",
  };
}

function normalizeCampaignPayload(body) {
  const avg = Number(body?.averageIntervalMonths);
  const last = typeof body?.lastLaunchDate === "string"
    ? body.lastLaunchDate.trim()
    : "";
  if (!Number.isFinite(avg) || avg <= 0 || avg > 60) {
    throw new Error("Invalid averageIntervalMonths");
  }
  if (!ISO_DATE.test(last)) {
    throw new Error("Invalid lastLaunchDate");
  }
  if (Number.isNaN(new Date(`${last}T12:00:00`).getTime())) {
    throw new Error("Unparseable lastLaunchDate");
  }

  let campaignActive = Boolean(body?.campaignActive);
  let launchDate = null;
  if (campaignActive) {
    const candidate = typeof body?.launchDate === "string" ? body.launchDate.trim() : "";
    if (!ISO_DATE.test(candidate) || Number.isNaN(new Date(`${candidate}T12:00:00`).getTime())) {
      throw new Error("Invalid launchDate");
    }
    if (candidate < todayIso()) {
      // Groq sometimes returns a past date as if it were the next launch —
      // discard it rather than surface a stale "campaign active" signal.
      campaignActive = false;
    } else {
      launchDate = candidate;
    }
  }

  const overview = typeof body?.overview === "string" ? body.overview.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";

  return {
    campaignActive,
    category,
    launchDate,
    overview,
    averageIntervalMonths: Math.round(avg * 10) / 10,
    lastLaunchDate: last,
  };
}

async function detectCampaign(brandName) {
  const prompt =
    `Today is ${referenceMonthLabel()} (${todayIso()}). `
    + `Analiza la empresa ${brandName}. Determina si tienen una campaña de marketing o lanzamiento de `
    + "producto activa en este momento, y cuál sería la fecha estimada de lanzamiento. "
    + "También determina cada cuántos meses en promedio lanzan un producto importante y la fecha de "
    + 'su último lanzamiento masivo. Devuelve un JSON con: { "campaignActive": boolean, '
    + '"category": string, "launchDate": "YYYY-MM-DD"|null, "overview": string, '
    + '"averageIntervalMonths": número, "lastLaunchDate": "YYYY-MM-DD" }';

  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT });
  if (!llm) {
    return mockCampaignForBrand(brandName);
  }

  const normalized = normalizeCampaignPayload(llm.data);
  return { ...normalized, source: llm.provider };
}

// ── Vercel Function handler ──────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body ?? {};
    const brandName = typeof body.brandName === "string"
      ? body.brandName.trim()
      : "";

    if (!brandName) {
      res.status(400).json({ error: "brandName is required" });
      return;
    }

    const campaign = await detectCampaign(brandName);
    res.status(200).json(campaign);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Inference failed",
    });
  }
}
