// api/translate.js — Vercel Function (POST /api/translate)
import { handleTranslatePost } from "../server/translateHandler.js";

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
    const outcome = await handleTranslatePost(req.body ?? {});
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Translation failed",
    });
  }
}
