import { processHorizonKitsRequest } from "../../../server/horizonKitsHandler.js";
import { parseJsonBody } from "../../_lib/parseJsonBody.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.method === "GET" ? {} : parseJsonBody(req);
    const result = await processHorizonKitsRequest({
      headers: req.headers,
      method: req.method,
      body,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    const status = err && typeof err === "object" && err.status ? err.status : 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : "Horizon kits failed",
    });
  }
}
