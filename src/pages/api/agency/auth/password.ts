export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { adminDb } from '@lib/db';
import { makeAgencyToken, buildAgencyCookie } from '@lib/agency-auth';

// Password sign-in for travel agencies that registered through /agency/signup.
// (The magic-link flow at /api/agency/auth/magic-link still works for users
// who prefer that path — both write the same HMAC cookie.)
//
// Body: { email, password }

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envVar(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as any)[name];
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return jsonError('Μη έγκυρο JSON'); }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !email.includes('@')) return jsonError('Μη έγκυρο email');
  if (!password) return jsonError('Λείπει ο κωδικός');

  // Use a throwaway client (anon key) for the password check itself — we
  // don't keep Supabase's session, we mint our own HMAC cookie below.
  const url = envVar('SUPABASE_URL');
  const anonKey = envVar('SUPABASE_ANON_KEY') || envVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey) {
    return jsonError('Λείπει διαμόρφωση Supabase', 500);
  }
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    // Same generic error for "wrong email" and "wrong password" — anti-enum
    return jsonError('Λανθασμένο email ή κωδικός', 401);
  }
  const userId = data.user.id;

  // Look up the agency the user belongs to (admin client → bypasses RLS).
  const db = adminDb();
  const { data: link, error: linkErr } = await db
    .from('agency_users')
    .select('agency_id, role, agencies(status)')
    .eq('user_id', userId)
    .maybeSingle();

  if (linkErr) {
    console.error('[agency/password] link lookup failed:', linkErr.message);
    return jsonError('Τεχνικό σφάλμα', 500);
  }
  if (!link?.agency_id) {
    return jsonError('Ο λογαριασμός σου δεν είναι συνδεδεμένος με γραφείο. Επικοινώνησε μαζί μας.', 403);
  }
  if ((link as any).agencies?.status === 'suspended') {
    return jsonError('Ο λογαριασμός του γραφείου είναι ανενεργός. Επικοινώνησε μαζί μας.', 403);
  }

  const token = makeAgencyToken({
    userId,
    agencyId: link.agency_id,
    role: link.role as 'owner' | 'editor',
  });

  return new Response(
    JSON.stringify({ ok: true, redirectTo: '/agency' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildAgencyCookie(token),
      },
    },
  );
};
