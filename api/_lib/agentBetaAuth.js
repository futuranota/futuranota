import { createClient } from "@supabase/supabase-js";
import { isBetaAgentEmail } from "../../server/agentAccess.js";

/**
 * @param {import('http').IncomingMessage} req
 */
export async function requireBetaAgentAccess(req, res) {
  const authHeader = req.headers.authorization;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token) {
    res.status(401).json({ error: "Unauthorized", code: "auth_required" });
    return null;
  }

  const url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    res.status(503).json({ error: "Auth not configured" });
    return null;
  }

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    res.status(401).json({ error: "Unauthorized", code: "invalid_token" });
    return null;
  }

  if (!isBetaAgentEmail(data.user.email)) {
    res.status(403).json({ error: "Agent not available for this account", code: "agent_forbidden" });
    return null;
  }

  return data.user;
}
