import { getAuthedUser } from "../../server/supabaseServer.js";
import { logApiUsageEvents } from "../../server/management/logApiUsage.js";

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
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user } = await getAuthedUser(fakeReq);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const routeLabel = typeof body.routeLabel === "string" ? body.routeLabel : "App";
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "client";
    const creditsDebited = Number(body.creditsDebited) || 0;
    const tokensDebited = Number(body.tokensDebited) || 0;
    const meta = body.meta && typeof body.meta === "object" ? body.meta : {};

    await logApiUsageEvents([
      {
        userId: user.id,
        userEmail: user.email,
        provider: "groq",
        endpoint,
        routeLabel,
        creditsDebited,
        tokensDebited,
        meta: { ...meta, source: "client-debit" },
      },
      {
        userId: user.id,
        userEmail: user.email,
        provider: "serper",
        endpoint,
        routeLabel,
        meta: { ...meta, source: "client-debit" },
      },
    ]);

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Usage log failed",
    });
  }
}
