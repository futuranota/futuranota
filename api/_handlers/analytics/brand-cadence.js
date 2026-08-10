// api/analytics/brand-cadence.js
// Vercel Function — migrada desde server/brandCadenceHandler.js
// Usa process.env (no import.meta.env) — estándar de Vercel Functions

import { completeJson } from "../../../server/llmJson.js";
import { logApiUsageEvent } from "../../../server/management/logApiUsage.js";
import { normalizeLlmUsage } from "../../../server/management/apiCostPricing.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT = `You respond only with valid JSON. No markdown, no commentary.
Schema: { "averageIntervalMonths": number, "lastLaunchDate": "YYYY-MM-DD" }
Use realistic public knowledge about the brand's product launch cadence.`;

function mockCadenceForBrand(brandName) {
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
  return {
    averageIntervalMonths,
    lastLaunchDate: `${y}-${m}-${d}`,
    source: "mock",
  };
}

function normalizeCadencePayload(body) {
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
  const parsed = new Date(`${last}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Unparseable lastLaunchDate");
  }
  return {
    averageIntervalMonths: Math.round(avg * 10) / 10,
    lastLaunchDate: last,
  };
}

async function inferBrandCadence(brandName, referenceMonthLabel) {
  const prompt =
    `Analiza el historial de lanzamientos de la empresa ${brandName}. `
    + "Determina cada cuántos meses en promedio lanzan un producto importante al mercado "
    + "y cuál fue la fecha exacta de su último lanzamiento masivo. "
    + `Estamos en ${referenceMonthLabel}. `
    + 'Devuelve un JSON con: { "averageIntervalMonths": número, "lastLaunchDate": "YYYY-MM-DD" }';

  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT });
  if (!llm) {
    return mockCadenceForBrand(brandName);
  }

  const normalized = normalizeCadencePayload(llm.data);
  return {
    ...normalized,
    source: llm.provider,
    llmModel: llm.model || null,
    llmUsage: normalizeLlmUsage(llm.usage),
  };
}

// ── Vercel Function handler ──────────────────────────────────
export default async function handler(req, res) {
  // CORS
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

    const referenceMonthLabel = typeof body.referenceMonthLabel === "string"
      && body.referenceMonthLabel.trim()
      ? body.referenceMonthLabel.trim()
      : "June 2026";

    const cadence = await inferBrandCadence(brandName, referenceMonthLabel);

    if (cadence.source === "groq" && cadence.llmUsage) {
      void logApiUsageEvent({
        provider: "groq",
        endpoint: "analytics/brand-cadence",
        routeLabel: "Launch Radar",
        inputTokens: cadence.llmUsage.inputTokens,
        outputTokens: cadence.llmUsage.outputTokens,
        model: cadence.llmModel || undefined,
        billed: true,
        meta: { brandName, referenceMonthLabel },
      });
    }

    const { llmUsage: _u, llmModel: _m, ...publicCadence } = cadence;
    res.status(200).json(publicCadence);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Inference failed",
    });
  }
}
