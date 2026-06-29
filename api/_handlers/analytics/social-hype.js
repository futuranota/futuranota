import { runSocialHypeAnalyst, socialHypeKeysConfigured } from "../../../server/agents/socialHypeAnalyst.js";

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
    const locale = body.locale === "es" ? "es" : "en";
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

    if (!brandName) {
      res.status(400).json({ error: "brandName is required" });
      return;
    }

    if (!socialHypeKeysConfigured()) {
      res.status(503).json({
        error: "Social hype scan unavailable — configure SERPAPI_KEY, APIFY_API_TOKEN, or GROQ_API_KEY",
      });
      return;
    }

    const result = await runSocialHypeAnalyst({
      locale,
      brandName,
      keyword: keyword || brandName,
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Social hype analyst failed",
    });
  }
}
