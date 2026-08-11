import { processManagementQuotasRequest } from "../../../server/managementHandler.js";
import { parseJsonBody } from "../../_lib/parseJsonBody.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.method === "DELETE" ? {} : parseJsonBody(req);
    const result = await processManagementQuotasRequest({
      headers: req.headers,
      url: req.url,
      body,
      method: req.method,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Quotas update failed",
    });
  }
}
