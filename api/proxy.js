import { getAuthedUser } from "../server/supabaseServer.js";
import { processWebProxyRequest } from "../server/webProxy.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { user } = await getAuthedUser({ headers: req.headers || {} });
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const result = await processWebProxyRequest({
      url: typeof req.query?.url === "string" ? req.query.url : "",
    });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(result.status).send(result.html);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy failed";
    const status = message.includes("required") || message.includes("Invalid") || message.includes("allowed")
      ? 400
      : 502;
    res.status(status).json({ error: message });
  }
}
