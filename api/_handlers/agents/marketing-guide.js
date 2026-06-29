import { runMarketingGuide } from "../../../server/agents/marketingGuide.js";

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
    const detection = body.detection && typeof body.detection === "object" ? body.detection : {};
    const analystReport = body.analystReport && typeof body.analystReport === "object"
      ? body.analystReport
      : {};
    const marketContextBundle = body.marketContextBundle && typeof body.marketContextBundle === "object"
      ? body.marketContextBundle
      : null;

    if (!brandName) {
      res.status(400).json({ error: "brandName is required" });
      return;
    }

    const report = await runMarketingGuide({
      locale,
      brandName,
      detection,
      analystReport,
      marketContextBundle,
    });

    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Marketing guide failed",
    });
  }
}
