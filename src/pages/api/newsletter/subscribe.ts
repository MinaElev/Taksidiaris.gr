export const prerender = false;

import type { APIRoute } from 'astro';
import { adminDb } from '@lib/db';
import { sendEmail } from '@lib/email';
import { tplNewsletterWelcome } from '@lib/email-templates';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Newsletter subscription. Stores the email in a Supabase table
 * `newsletter_subscribers (email PRIMARY KEY, subscribed_at TIMESTAMPTZ DEFAULT NOW(),
 *  source TEXT, confirmed BOOLEAN DEFAULT TRUE)`.
 *
 * Idempotent: re-subscribing the same email is OK (upsert), no duplicate
 * welcome email gets sent on duplicates.
 *
 * Body: { email, source? }
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const email = String(body?.email || '').trim().toLowerCase();
  const source = String(body?.source || 'website').trim();

  if (!email || !email.includes('@') || email.length < 5 || email.length > 254) {
    return jsonError('Έγκυρο email υποχρεωτικό');
  }

  const db = adminDb();

  // Check if already subscribed (silent skip on duplicate to avoid spam)
  let isNew = false;
  try {
    const { data: existing } = await db
      .from('newsletter_subscribers')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    isNew = !existing;
  } catch {
    // Table may not exist yet — caller should create it. Continue anyway
    // and try the insert; it'll fail loudly with a clear error.
  }

  try {
    const { error } = await db
      .from('newsletter_subscribers')
      .upsert({ email, source, subscribed_at: new Date().toISOString() }, { onConflict: 'email' });
    if (error) {
      // 42P01 = undefined_table — give a helpful pointer to admin
      if ((error as any).code === '42P01') {
        return jsonError(
          'Το newsletter table δεν υπάρχει. Δημιούργησε το από Supabase: ' +
          'CREATE TABLE newsletter_subscribers (email TEXT PRIMARY KEY, subscribed_at TIMESTAMPTZ DEFAULT NOW(), source TEXT, confirmed BOOLEAN DEFAULT TRUE);',
          500,
        );
      }
      throw error;
    }
  } catch (e: any) {
    console.error('[newsletter] subscribe failed:', e?.message || e);
    return jsonError('Σφάλμα αποθήκευσης: ' + (e?.message || ''), 500);
  }

  // Welcome email only on first subscription
  if (isNew) {
    sendEmail({
      to: email,
      ...tplNewsletterWelcome({ email }),
    }).catch(() => {});
  }

  return new Response(
    JSON.stringify({ ok: true, alreadySubscribed: !isNew }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
