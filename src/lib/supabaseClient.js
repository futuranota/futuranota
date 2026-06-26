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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const repair = msg.includes('announcement_date')
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
