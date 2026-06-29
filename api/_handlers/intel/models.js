import { getActiveIntelModelsForPlan } from "../../../server/intelModels.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const plan = req.query?.plan === "pro" ? "pro" : "free";
  res.status(200).json({ models: getActiveIntelModelsForPlan(plan) });
}
