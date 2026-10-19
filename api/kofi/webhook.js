import { handleKofiWebhook } from "../../server/kofi/kofiWebhook.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await handleKofiWebhook({ body: req.body });
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ error: "Webhook failed" });
  }
}
