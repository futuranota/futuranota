import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (
  import.meta.env.SUPABASE_PROJECT_URL
  || import.meta.env.VITE_SUPABASE_URL
  || ''
).trim();

const supabaseAnonKey = (
  import.meta.env.SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || ''
).trim();

export function getSupabaseConfigError() {
  if (supabaseUrl && supabaseAnonKey) return null;
  return (
    'Supabase no configurado en el cliente. '
    + 'Añadí SUPABASE_PROJECT_URL y SUPABASE_ANON_KEY en .env.local y reiniciá `npm run dev`. '
    + 'En Vercel: Project Settings → Environment Variables (prefijo SUPABASE_ o VITE_SUPABASE_).'
  );
}

if (getSupabaseConfigError()) {
  console.warn(getSupabaseConfigError());
}

function unavailableSupabase(message) {
  const error = { message };
  const auth = {
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error }),
    signInWithPassword: async () => ({ data: { session: null, user: null }, error }),
    signUp: async () => ({ data: { session: null, user: null }, error }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error }),
    updateUser: async () => ({ data: { user: null }, error }),
    signInWithOAuth: async () => ({ data: null, error }),
    exchangeCodeForSession: async () => ({ data: { session: null }, error }),
    setSession: async () => ({ data: { session: null }, error }),
  };
  const chain = {
    select() { return chain; },
    insert() { return chain; },
    update() { return chain; },
    delete() { return chain; },
    upsert() { return chain; },
    eq() { return chain; },
    neq() { return chain; },
    order() { return chain; },
    limit() { return chain; },
    single: async () => ({ data: null, error }),
    maybeSingle: async () => ({ data: null, error }),
    then(resolve, reject) {
      return Promise.resolve({ data: null, error }).then(resolve, reject);
    },
  };
  return {
    auth,
    from() { return chain; },
    storage: {
      from() {
        return {
          upload: async () => ({ data: null, error }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        };
      },
    },
  };
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        // Manual exchange in authRedirect.js — avoid double PKCE redemption.
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : unavailableSupabase(getSupabaseConfigError());

/**
 * @param {{ message?: string, code?: string, details?: string, hint?: string }|null} error
 * @param {string} action
 */
export function formatSupabaseError(error, action) {
  if (!error) return `${action} failed`;
  const parts = [action, error.message || 'Unknown error'];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.details) parts.push(error.details);
  if (error.hint) parts.push(error.hint);
  const msg = parts.filter(Boolean).join(' · ');
  if (error.code === 'PGRST204' || msg.includes('schema cache') || msg.includes('does not exist')) {
    const repair = msg.includes('lazy_todos')
      ? 'supabase_lazy_todos.sql'
      : msg.includes('step_playbook_shares')
      ? 'supabase_step_playbook_shares.sql (+ moderation)'
      : msg.includes('url_table_entries') || msg.includes('url_tables') || msg.includes('password_table_entries')
      ? (msg.includes('foreign key') || msg.includes('23503')
        ? 'supabase_vault_tables_repair_fk.sql'
        : msg.includes('url_tables') || msg.includes('table_id')
          ? 'supabase_url_tables.sql'
          : msg.includes('url_table_entries')
          ? (msg.includes('tag') || msg.includes('category')
            ? 'supabase_url_table_entries_tag_category.sql'
            : 'supabase_url_table_entries.sql')
          : 'supabase_password_table_entries.sql')
      : msg.includes('announcement_date')
      || msg.includes('detection_mode')
      || msg.includes('evidence_url')
      || msg.includes('ticket_tier')
      || msg.includes('status')
      ? 'supabase_signal_campaigns_repair.sql'
      : 'supabase_campaign_pipeline.sql';
    return `${msg} — ejecutá ${repair} en Supabase SQL Editor (Run completo).`;
  }
  if (msg.includes('row-level security') || error.code === '42501') {
    return `${msg} — iniciá sesión en /panel (cuenta admin autenticada).`;
  }
  return msg;
}
