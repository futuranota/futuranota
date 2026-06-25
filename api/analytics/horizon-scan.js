// api/analytics/horizon-scan.js
// Vercel Function — verified scan via Serper + Groq extract-only.

import { scanHorizonVerified } from "../../server/horizonScanHandler.js";

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
    const rangeDays = Math.min(365, Math.max(1, Number(body.rangeDays) || 90));
    const industry = typeof body.industry === "string" ? body.industry.trim() : "";
    const sources = Array.isArray(body.sources) ? body.sources : [];

    const result = await scanHorizonVerified(rangeDays, industry, sources);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Scan failed",
    });
  }
}
