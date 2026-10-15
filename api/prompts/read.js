import { processPromptPdfRead } from "../../server/promptPdfVision.js";

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

  try {
    const result = await processPromptPdfRead(req.body || {});
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "No se pudo leer el PDF",
    });
  }
}
