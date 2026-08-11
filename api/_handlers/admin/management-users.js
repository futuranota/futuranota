import { processManagementUserPatch } from "../../../server/managementHandler.js";
import { parseJsonBody } from "../../_lib/parseJsonBody.js";

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

  try {
    const body = parseJsonBody(req);
    const result = await processManagementUserPatch({
      headers: req.headers,
      url: req.url,
      body,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "User update failed",
    });
  }
}
