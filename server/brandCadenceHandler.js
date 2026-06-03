import { completeJson } from "./llmJson.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT = `You respond only with valid JSON. No markdown, no commentary.
Schema: { "averageIntervalMonths": number, "lastLaunchDate": "YYYY-MM-DD" }
Use realistic public knowledge about the brand's product launch cadence.`;

/**
 * Deterministic fallback when no LLM keys are configured (local dev).
 * @param {string} brandName
 */
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

/**
 * @param {unknown} body
 */
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

/**
 * @param {string} brandName
 * @param {string} referenceMonthLabel e.g. "June 2026"
 */
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
  return { ...normalized, source: llm.provider };
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
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

/**
 * Vite / Node middleware for POST /api/analytics/brand-cadence
 */
export function createBrandCadenceMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/analytics/brand-cadence") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const brandName = typeof body.brandName === "string"
        ? body.brandName.trim()
        : "";
      if (!brandName) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "brandName is required" }));
        return;
      }

      const referenceMonthLabel = typeof body.referenceMonthLabel === "string"
        && body.referenceMonthLabel.trim()
        ? body.referenceMonthLabel.trim()
        : "June 2026";

      const cadence = await inferBrandCadence(brandName, referenceMonthLabel);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(cadence));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Inference failed",
      }));
    }
  };
}
