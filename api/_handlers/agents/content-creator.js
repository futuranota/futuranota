import {
  buildFallbackContentCreatorPlan,
  runContentCreator,
} from "../../../server/agents/contentCreator.js";
import { parseJsonBody } from "../../_lib/parseJsonBody.js";

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

  const body = parseJsonBody(req);
  const locale = body.locale === "es" ? "es" : "en";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const brandContext = body.brandContext && typeof body.brandContext === "object"
    ? body.brandContext
    : {};
  const knowledgeContext = typeof body.knowledgeContext === "string"
    ? body.knowledgeContext.trim()
    : "";
  const wiredInputs = Array.isArray(body.wiredInputs) ? body.wiredInputs : [];
  const mode = body.mode === "macro_blog" ? "macro_blog" : "document_plan";
  const macroTitle = typeof body.macroTitle === "string" ? body.macroTitle.trim() : "";
  const scheduleAt = body.scheduleAt ?? null;

  if (!instruction) {
    res.status(400).json({ error: "instruction is required" });
    return;
  }

  try {
    const plan = await runContentCreator({
      locale,
      instruction,
      brandContext,
      knowledgeContext,
      wiredInputs,
      mode,
      macroTitle,
      scheduleAt,
    });

    res.status(200).json(plan);
  } catch (err) {
    console.error("[content-creator]", err);
    const fallback = buildFallbackContentCreatorPlan(
      locale,
      instruction,
      brandContext,
      mode,
      macroTitle,
    );
    res.status(200).json({ ...fallback, source: "fallback-handler-error" });
  }
}
