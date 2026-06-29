import { processManagementIntegrationPatch } from "../../../server/managementHandler.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const id = req.query?.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Integration id required (?id=)" });
    return;
  }

  try {
    const result = await processManagementIntegrationPatch({
      headers: req.headers,
      url: `/api/admin/management/integrations/${id}`,
      body: req.body,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Integration update failed",
    });
  }
}
