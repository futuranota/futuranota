import { routeOrchestratorPlan } from "../../../server/agents/orchestratorRouter.js";

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
    const canvasContext = body.canvasContext && typeof body.canvasContext === "object"
      ? body.canvasContext
      : null;

    if (!canvasContext) {
      res.status(400).json({ error: "canvasContext is required" });
      return;
    }

    const plan = await routeOrchestratorPlan({ locale, canvasContext });
    res.status(200).json(plan);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Orchestrator routing failed",
    });
  }
}
