import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { copyToClipboard } from "./copyToClipboard.js";
import { normalizeStepEntries } from "./docBlocks.js";

const TABLE = "step_playbook_shares";

/**
 * @param {import("@supabase/supabase-js").User | null | undefined} user
 * @returns {{ author_name: string, author_initial: string }}
 */
export function resolveShareAuthor(user) {
  const first = String(user?.user_metadata?.first_name ?? "").trim();
  const emailLocal = String(user?.email ?? "").split("@")[0]?.trim() || "";
  const author_name = first || emailLocal || "Creator";
  const author_initial = (author_name.charAt(0) || "?").toUpperCase();
  return { author_name, author_initial };
}

/**
 * @param {import("./stepPlaybookSession.js").StepPlaybookSession} session
 * @param {import("@supabase/supabase-js").User | null | undefined} user
 */
export function buildShareSnapshot(session, user) {
  const { author_name, author_initial } = resolveShareAuthor(user);
  const title = String(session?.title ?? "").trim() || "Step by step";
  const steps = normalizeStepEntries(session?.steps || []);
  return {
    title,
    steps,
    author_name,
    author_initial,
  };
}

/**
 * @param {string} token
 */
export function buildStepPlaybookShareUrl(token) {
  const safe = String(token || "").trim();
  if (!safe || typeof window === "undefined") return "";
  return `${window.location.origin}/s/${encodeURIComponent(safe)}`;
}

/**
 * @param {Object} args
 * @param {import("./stepPlaybookSession.js").StepPlaybookSession} args.session
 * @param {import("@supabase/supabase-js").User} args.user
 * @returns {Promise<{ token: string, url: string, created: boolean }>}
 */
export async function upsertStepPlaybookShare({ session, user }) {
  if (!user?.id) {
    throw new Error("Sign in required to share");
  }
  if (!session?.saved || !session?.docId || !session?.blockId) {
    throw new Error("SAVE_FIRST");
  }

  const snapshot = buildShareSnapshot(session, user);
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from(TABLE)
    .select("id, token")
    .eq("user_id", user.id)
    .eq("source_doc_id", session.docId)
    .eq("source_block_id", session.blockId)
    .maybeSingle();

  if (selectError) {
    throw new Error(formatSupabaseError(selectError, "Load step share"));
  }

  if (existing?.id && existing?.token) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        title: snapshot.title,
        steps: snapshot.steps,
        author_name: snapshot.author_name,
        author_initial: snapshot.author_initial,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("token")
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, "Update step share"));
    }
    const token = data.token;
    return { token, url: buildStepPlaybookShareUrl(token), created: false };
  }

  const token = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "")
    : `sp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      token,
      user_id: user.id,
      source_doc_id: session.docId,
      source_block_id: session.blockId,
      title: snapshot.title,
      steps: snapshot.steps,
      author_name: snapshot.author_name,
      author_initial: snapshot.author_initial,
      created_at: now,
      updated_at: now,
    })
    .select("token")
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, "Create step share"));
  }

  return { token: data.token, url: buildStepPlaybookShareUrl(data.token), created: true };
}

/**
 * @param {string} token
 * @returns {Promise<{
 *   token: string,
 *   title: string,
 *   steps: import("./docBlocks.js").StepEntry[],
 *   author_name: string,
 *   author_initial: string,
 * } | null>}
 */
export async function fetchStepPlaybookShare(token) {
  const safe = String(token || "").trim();
  if (!safe) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("token, title, steps, author_name, author_initial")
    .eq("token", safe)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, "Load shared step playbook"));
  }
  if (!data) return null;

  return {
    token: data.token,
    title: String(data.title ?? "").trim() || "Step by step",
    steps: normalizeStepEntries(data.steps || []),
    author_name: String(data.author_name ?? "").trim() || "Creator",
    author_initial: String(data.author_initial ?? "").trim().charAt(0).toUpperCase() || "?",
  };
}

/**
 * Upsert share and copy URL to clipboard.
 * @param {Object} args
 * @param {import("./stepPlaybookSession.js").StepPlaybookSession} args.session
 * @param {import("@supabase/supabase-js").User} args.user
 * @returns {Promise<{ token: string, url: string, created: boolean, copied: boolean }>}
 */
export async function shareStepPlaybookAndCopy({ session, user }) {
  const result = await upsertStepPlaybookShare({ session, user });
  const copied = await copyToClipboard(result.url);
  return { ...result, copied };
}
