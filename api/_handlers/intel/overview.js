import { processIntelOverviewRequest } from "../../../server/intelOverviewHandler.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await processIntelOverviewRequest({
      headers: req.headers,
      body: req.body,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    const status = err?.code === "rate_limit" ? 429 : 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : "Intel search failed",
      code: err?.code || undefined,
    });
  }
}
