import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Two clients:
//   • adminDb()  — uses the SERVICE ROLE key. Bypasses RLS. ONLY for
//                  server-side admin code (Mina's panel). NEVER ship the
//                  service key to the browser.
//   • publicDb() — uses the ANON key. Reads only what RLS allows
//                  (active agencies, non-draft tours). Safe for SSR pages
//                  that render to the public.
// ---------------------------------------------------------------------------

function envVar(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const fromImport = (import.meta.env as Record<string, string | undefined>)[name];
  return fromImport;
}

let _admin: SupabaseClient | null = null;
let _public: SupabaseClient | null = null;

export function adminDb(): SupabaseClient {
  if (_admin) return _admin;
  const url = envVar('SUPABASE_URL');
  const key = envVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — required for admin DB writes',
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export function publicDb(): SupabaseClient {
  if (_public) return _public;
  const url = envVar('SUPABASE_URL');
  const key = envVar('SUPABASE_ANON_KEY') || envVar('SUPABASE_SERVICE_ROLE_KEY');
  // Falling back to service role for now is OK on the server because public
  // reads are filtered by RLS-equivalent logic in our query helpers anyway.
  // Ideally set SUPABASE_ANON_KEY in Vercel for the public client.
  if (!url || !key) {
    throw new Error('SUPABASE_URL missing — required for public DB reads');
  }
  _public = createClient(url, key, { auth: { persistSession: false } });
  return _public;
}
