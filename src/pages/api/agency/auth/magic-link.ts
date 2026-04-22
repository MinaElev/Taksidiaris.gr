export const prerender = false;

import type { APIRoute } from 'astro';
import { adminDb } from '@lib/db';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Send a magic-link sign-in email to an agency user.
 *
 * Body: { email: string }
 *
 * Flow:
 *   1. We confirm the email belongs to a registered Supabase auth user that
 *      is linked to an agency (via agency_users). If not, we return a clean
 *      "not authorized" error — Mina has to invite them via the admin panel
 *      first, we don't auto-register here.
 *   2. We ask Supabase to generate a magic link with `redirectTo` pointing
 *      at our /agency/auth/callback page.
 *   3. Supabase emails the user. They click → land on our callback → cookie set.
 *
 * We don't reveal whether the email exists or not (always 200) — anti
 * enumeration. The actual link is only sent if the email is authorized.
 */
export const POST: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return jsonError('Valid email required');

  const db = adminDb();

  // 1) Look up the user by email and confirm they're linked to an agency.
  //    If anything's off, silently return success (don't leak which emails
  //    are registered).
  let userId: string | null = null;
  try {
    const { data: list } = await db.auth.admin.listUsers();
    const found = list.users.find((u) => u.email?.toLowerCase() === email);
    if (found) userId = found.id;
  } catch (e) {
    console.error('[agency/magic-link] listUsers failed:', e);
  }

  let authorized = false;
  if (userId) {
    const { data: link } = await db
      .from('agency_users')
      .select('agency_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (link?.agency_id) authorized = true;
  }

  if (!authorized) {
    // Same shape as success — defense against email enumeration.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2) Generate the link. We use generateLink (not signInWithOtp) because we
  //    want the redirect to come back to OUR domain, not Supabase's hosted
  //    callback. The user clicks the link → lands on /agency/auth/callback
  //    with `token_hash` & `type` in the URL → callback verifies via
  //    verifyOtp({ token_hash, type }).
  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/agency/auth/callback`;

  try {
    const { data, error } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });
    if (error) throw error;
    // Supabase auto-sends the email when SMTP is configured in the project.
    // (We never expose `data.action_link` to the client — it would let
    // anyone with this endpoint impersonate the user.)
    void data;
  } catch (e: any) {
    console.error('[agency/magic-link] generateLink failed:', e?.message || e);
    // Still return 200 — same anti-enumeration concern. The user just won't
    // get an email; they can retry. Detail is logged server-side for Mina.
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
