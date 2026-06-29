import { runAllIntegrationProbes } from "../../server/integrationsProbe.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const live = req.query?.live !== "0";
    const report = await runAllIntegrationProbes({ live });
    res.status(report.ok ? 200 : 503).json(report);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Health check failed",
    });
  }
}
