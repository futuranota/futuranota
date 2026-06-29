// api/analytics/campaign-detect.js
// Vercel Function — espejo de server/campaignDetectorHandler.js para producción.

import { detectBrandIntel } from "../../../server/brandCampaignIntel.js";
import { DEFAULT_RANGE_DAYS } from "../../../src/lib/campaignWindow.js";

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

    const rangeDays = Number(body.rangeDays);
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const mode = body.mode === "deep"
      ? "deep"
      : body.mode === "radar"
        ? "radar"
        : undefined;
    const officialDomain = typeof body.officialDomain === "string"
      ? body.officialDomain.trim()
      : "";
    const userQuery = typeof body.userQuery === "string"
      ? body.userQuery.trim()
      : "";
    const analystBrief = typeof body.analystBrief === "string"
      ? body.analystBrief.trim()
      : "";
    const locale = body.locale === "en" ? "en" : "es";

    const result = await detectBrandIntel(brandName, {
      rangeDays: Number.isFinite(rangeDays) && rangeDays > 0 ? rangeDays : DEFAULT_RANGE_DAYS,
      sources,
      mode,
      officialDomain,
      userQuery,
      analystBrief,
      locale,
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Inference failed",
    });
  }
}
