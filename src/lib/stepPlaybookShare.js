import { supabase, formatSupabaseError } from "./supabaseClient.js";
import { copyToClipboard } from "./copyToClipboard.js";
import { normalizeStepEntries } from "./docBlocks.js";
import { isAdminSessionEmail } from "./adminPlanCredits.js";

const TABLE = "step_playbook_shares";

/** @typedef {'requested' | 'published' | 'rejected'} StepShareStatus */

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

function makeShareToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `sp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {any} row
 * @returns {{
 *   id: string,
 *   token: string,
 *   url: string,
 *   status: StepShareStatus,
 *   title: string,
 *   author_name: string,
 *   author_initial: string,
 *   requested_at: string | null,
 *   reviewed_at: string | null,
 *   updated_at: string | null,
 *   created_at: string | null,
 *   steps?: import("./docBlocks.js").StepEntry[],
 * } | null}
 */
export function normalizeShareRow(row) {
  if (!row?.token) return null;
  const status = /** @type {StepShareStatus} */ (
    ["requested", "published", "rejected"].includes(row.status) ? row.status : "requested"
  );
  return {
    id: row.id,
    token: row.token,
    url: buildStepPlaybookShareUrl(row.token),
    status,
    title: String(row.title ?? "").trim() || "Step by step",
    author_name: String(row.author_name ?? "").trim() || "Creator",
    author_initial: String(row.author_initial ?? "").trim().charAt(0).toUpperCase() || "?",
    requested_at: row.requested_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
    updated_at: row.updated_at ?? null,
    created_at: row.created_at ?? null,
    user_id: row.user_id ?? null,
    source_doc_id: row.source_doc_id ?? null,
    steps: row.steps != null ? normalizeStepEntries(row.steps || []) : undefined,
  };
}

/**
 * @param {Object} args
 * @param {import("./stepPlaybookSession.js").StepPlaybookSession} args.session
 * @param {import("@supabase/supabase-js").User} args.user
 */
export async function fetchOwnStepPlaybookShare({ session, user }) {
  if (!user?.id || !session?.docId || !session?.blockId) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("id, token, status, title, author_name, author_initial, requested_at, reviewed_at, reviewed_by, updated_at, created_at")
    .eq("user_id", user.id)
    .eq("source_doc_id", session.docId)
    .eq("source_block_id", session.blockId)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, "Load own step share"));
  }
  if (!data) return null;

  // Grandfathered "published" without admin Accept → treat as pending request.
  if (data.status === "published" && !data.reviewed_by) {
    const now = new Date().toISOString();
    const { data: reset, error: resetError } = await supabase
      .from(TABLE)
      .update({
        status: "requested",
        requested_at: now,
        reviewed_at: null,
        reviewed_by: null,
        updated_at: now,
      })
      .eq("id", data.id)
      .eq("user_id", user.id)
      .select("id, token, status, title, author_name, author_initial, requested_at, reviewed_at, reviewed_by, updated_at, created_at")
      .single();

    if (resetError) {
      throw new Error(formatSupabaseError(resetError, "Reset grandfathered step share"));
    }
    return normalizeShareRow(reset);
  }

  return normalizeShareRow(data);
}

/**
 * Create or refresh a share request (status → requested). Does not copy.
 * @param {Object} args
 * @param {import("./stepPlaybookSession.js").StepPlaybookSession} args.session
 * @param {import("@supabase/supabase-js").User} args.user
 */
export async function upsertStepPlaybookShareRequest({ session, user }) {
  if (!user?.id) {
    throw new Error("Sign in required to share");
  }
  if (!isAdminSessionEmail(user?.email)) {
    throw new Error("SHARE_BETA_ONLY");
  }
  if (!session?.saved || !session?.docId || !session?.blockId) {
    throw new Error("SAVE_FIRST");
  }

  const snapshot = buildShareSnapshot(session, user);
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from(TABLE)
    .select("id, token, status")
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
        status: "requested",
        requested_at: now,
        reviewed_at: null,
        reviewed_by: null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("id, token, status, title, author_name, author_initial, requested_at, reviewed_at, updated_at, created_at")
      .single();

    if (error) {
      throw new Error(formatSupabaseError(error, "Update step share request"));
    }
    return { ...normalizeShareRow(data), created: false };
  }

  const token = makeShareToken();
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
      status: "requested",
      requested_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("id, token, status, title, author_name, author_initial, requested_at, reviewed_at, updated_at, created_at")
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, "Create step share request"));
  }

  return { ...normalizeShareRow(data), created: true };
}

/**
 * Copy URL only when the share is already published.
 * @param {Object} args
 * @param {import("./stepPlaybookSession.js").StepPlaybookSession} args.session
 * @param {import("@supabase/supabase-js").User} args.user
 */
export async function copyPublishedStepShare({ session, user }) {
  if (!isAdminSessionEmail(user?.email)) {
    throw new Error("SHARE_BETA_ONLY");
  }
  const row = await fetchOwnStepPlaybookShare({ session, user });
  // fetchOwn may reset grandfathered published → requested
  if (!row || row.status !== "published") {
    throw new Error("NOT_PUBLISHED");
  }
  const copied = await copyToClipboard(row.url);
  return { ...row, copied };
}

/**
 * Public page loader — published only.
 * @param {string} token
 */
export async function fetchStepPlaybookShare(token) {
  const safe = String(token || "").trim();
  if (!safe) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("token, title, steps, author_name, author_initial, status")
    .eq("token", safe)
    .eq("status", "published")
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

/** @deprecated Prefer upsertStepPlaybookShareRequest + copyPublishedStepShare */
export async function upsertStepPlaybookShare({ session, user }) {
  const row = await upsertStepPlaybookShareRequest({ session, user });
  return { token: row.token, url: row.url, created: row.created };
}

/** @deprecated Prefer copyPublishedStepShare after approve */
export async function shareStepPlaybookAndCopy({ session, user }) {
  const result = await upsertStepPlaybookShare({ session, user });
  const copied = await copyToClipboard(result.url);
  return { ...result, copied };
}

/** Admin: pending requests (includes steps for Open / Scan) */
export async function fetchRequestedStepShares() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, token, status, title, steps, author_name, author_initial, requested_at, reviewed_at, reviewed_by, updated_at, created_at, user_id, source_doc_id")
    .eq("status", "requested")
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(formatSupabaseError(error, "Load step share requests"));
  }
  return (data || []).map((row) => normalizeShareRow(row)).filter(Boolean);
}

/**
 * Admin: load one share by id (requested or otherwise) with steps.
 * @param {string} id
 */
export async function fetchStepShareAdminById(id) {
  const safe = String(id || "").trim();
  if (!safe) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, token, status, title, steps, author_name, author_initial, requested_at, reviewed_at, reviewed_by, updated_at, created_at, user_id, source_doc_id")
    .eq("id", safe)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, "Load step share for admin"));
  }
  return normalizeShareRow(data);
}

/**
 * @param {string} id
 * @param {import("@supabase/supabase-js").User} adminUser
 */
export async function approveStepShare(id, adminUser) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: "published",
      reviewed_at: now,
      reviewed_by: adminUser?.id || null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "requested")
    .select("id, token, status, title, author_name, author_initial, requested_at, reviewed_at, updated_at, created_at")
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, "Approve step share"));
  }
  return normalizeShareRow(data);
}

/**
 * @param {string} id
 * @param {import("@supabase/supabase-js").User} adminUser
 */
export async function rejectStepShare(id, adminUser) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: adminUser?.id || null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "requested")
    .select("id, token, status, title, author_name, author_initial, requested_at, reviewed_at, updated_at, created_at")
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, "Reject step share"));
  }
  return normalizeShareRow(data);
}
