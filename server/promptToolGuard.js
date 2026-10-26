import { DESK_FREE_PREVIEW_EMAIL, PROMPT_LIMITS_ENFORCED } from "../src/lib/promptPlanLimits.js";
import { getAuthedUser } from "./supabaseServer.js";

const TOOL_LIMIT = "El plan gratis incluye 3 llamadas con los tools.";

function payloadOf(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return typeof data === "object" ? data : null;
}

/**
 * Mejorar and Organizar spend one lifetime call for free accounts.
 * Returns a response to send, or null when the call may continue.
 * @param {import('http').IncomingMessage} req
 * @param {{ pass?: string }} body
 */
export async function guardPromptToolCall(req, body) {
  if (!PROMPT_LIMITS_ENFORCED) return null;
  const pass = body?.pass;
  if (pass !== "improve" && pass !== "structure") return null;

  const { user, supabase } = await getAuthedUser(req);
  if (!user || !supabase) {
    return { status: 401, body: { error: "Sign in to use this tool." } };
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (email === DESK_FREE_PREVIEW_EMAIL) return null;

  const { data, error } = await supabase.rpc("consume_prompt_tool_call");
  if (error) {
    return { status: 503, body: { error: "No pude revisar las llamadas del plan gratis." } };
  }
  const payload = payloadOf(data);
  if (!payload?.ok) {
    return { status: 403, body: { error: TOOL_LIMIT } };
  }
  return null;
}
