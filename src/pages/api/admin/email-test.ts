export const prerender = false;

import type { APIRoute } from 'astro';
import { sendEmail, getAdminEmail } from '@lib/email';

function envVar(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as any)[name];
}

/**
 * Admin-only diagnostic for Resend. Reports:
 *   - Which env vars are set (without exposing the actual key)
 *   - What FROM address would be used
 *   - Result of an actual test send to ADMIN_EMAIL (or `to` query param)
 *
 * Hit it as: GET /api/admin/email-test
 *           or GET /api/admin/email-test?to=youremail@gmail.com
 *
 * Auth: gated by the existing admin middleware so only Mina can hit it.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || getAdminEmail();

  const apiKey = envVar('RESEND_API_KEY');
  const fromEnv = envVar('RESEND_FROM');
  const adminEmail = envVar('ADMIN_EMAIL');

  // Mask the key — show only prefix + length so we know it's set
  const keyInfo = apiKey
    ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (length ${apiKey.length})`
    : 'NOT SET';

  const env = {
    RESEND_API_KEY: keyInfo,
    RESEND_FROM: fromEnv ?? 'NOT SET → falls back to Ταξιδιάρης <noreply@taksidiaris.gr>',
    ADMIN_EMAIL: adminEmail ?? 'NOT SET → falls back to info@taksidiaris.gr',
    effectiveTo: to,
  };

  // Try an actual send and capture the Resend error if any
  const result = await sendEmail({
    to,
    subject: '[Ταξιδιάρης] Email diagnostic test',
    html: `<p>Αυτό είναι ένα δοκιμαστικό email από το diagnostic endpoint.</p>
<p>Αν το βλέπεις, το Resend setup σου είναι σωστό!</p>
<p style="color:#718096; font-size:12px;">From: ${fromEnv ?? '(default)'}<br/>To: ${to}<br/>Sent at: ${new Date().toISOString()}</p>`,
  });

  // Diagnose common issues
  const hints: string[] = [];
  if (!apiKey) hints.push('❌ Χρειάζεσαι RESEND_API_KEY στο Vercel env vars.');
  if (!fromEnv) hints.push('⚠ RESEND_FROM δεν είναι set — fallback χρησιμοποιεί noreply@taksidiaris.gr που πιθανώς δεν είναι verified domain.');
  if (result.error?.includes('not verified') || result.error?.includes('not_authorized')) {
    hints.push('🔧 Λύση: είτε άλλαξε RESEND_FROM σε "Ταξιδιάρης <onboarding@resend.dev>" (free tier — μόνο στο email του Resend account σου), είτε verify το taksidiaris.gr στο Resend dashboard.');
  }
  if (result.error?.includes('You can only send testing emails to your own email')) {
    hints.push('🔧 Free tier: επιτρέπεται αποστολή ΜΟΝΟ στο email του Resend account σου. Πρέπει να verify domain για να στέλνεις σε άλλους.');
  }
  if (!result.ok && !result.skipped) {
    hints.push('📋 Δες παρακάτω το πλήρες error από το Resend.');
  }
  if (result.skipped) {
    hints.push('⏭ Δεν έγινε call στο Resend — λείπει RESEND_API_KEY.');
  }

  return new Response(
    JSON.stringify({
      env,
      result,
      hints,
      tip: 'Hit /api/admin/email-test?to=youremail@gmail.com για να δοκιμάσεις άλλο recipient',
    }, null, 2),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
};
