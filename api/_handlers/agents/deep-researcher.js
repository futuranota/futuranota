import { requireBetaAgentAccess } from "../_lib/agentBetaAuth.js";
import { runDeepResearcher } from "../../../server/agents/planAgent.js";

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

  const user = await requireBetaAgentAccess(req, res);
  if (!user) return;

  try {
    const body = req.body ?? {};
    const locale = body.locale === "es" ? "es" : "en";
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
    const brandContext = body.brandContext && typeof body.brandContext === "object"
      ? body.brandContext
      : {};
    const knowledgeContext = typeof body.knowledgeContext === "string"
      ? body.knowledgeContext.trim()
      : "";
    const wiredInputs = Array.isArray(body.wiredInputs) ? body.wiredInputs : [];

    if (!instruction) {
      res.status(400).json({ error: "instruction is required" });
      return;
    }

    const plan = await runDeepResearcher({
      locale,
      instruction,
      brandContext,
      knowledgeContext,
      wiredInputs,
    });

    res.status(200).json(plan);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Deep researcher failed",
    });
  }
}
