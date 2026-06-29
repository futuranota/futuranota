import { processCampaignStudyRequest } from "../../../server/campaignStudyHandler.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const result = await processCampaignStudyRequest({
      method: req.method,
      url: req.url || "/api/analytics/campaign-study",
      headers: req.headers,
      body: req.body,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Campaign study failed",
    });
  }
}
