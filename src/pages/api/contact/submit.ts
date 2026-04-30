export const prerender = false;

import type { APIRoute } from 'astro';
import { sendEmail, getAdminEmail } from '@lib/email';
import { tplContactToAgency, tplContactToAdmin } from '@lib/email-templates';
import { listToursPublic } from '@lib/tours-db';
import { readAgencyByIdAdmin } from '@lib/agencies-db';
import { SITE } from '@lib/site';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Public contact form. Routes to the right inbox:
 *   - If `tourSlug` is in the body → look up the tour, find its agency, send
 *     the lead to that agency's email (CC admin)
 *   - Otherwise → send to admin only (general inquiry)
 *
 * Body: { name, email, phone?, subject?, message, tourSlug?, agencySlug? }
 *
 * Honeypot: any field named `website` MUST be empty (bots fill all inputs).
 */
export const POST: APIRoute = async ({ request }) => {
  const ct = request.headers.get('content-type') || '';
  let payload: Record<string, string> = {};

  if (ct.includes('application/json')) {
    try { payload = await request.json(); } catch { return jsonError('Invalid JSON'); }
  } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    fd.forEach((v, k) => { payload[k] = String(v); });
  } else {
    return jsonError('Unsupported content type');
  }

  // Honeypot — silently 200 to fool the bot
  if (payload.website && payload.website.trim()) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = String(payload.phone || '').trim();
  const subject = String(payload.subject || '').trim();
  const message = String(payload.message || '').trim();
  const tourSlug = String(payload.tourSlug || '').trim();
  const agencySlug = String(payload.agencySlug || '').trim();

  if (!name) return jsonError('Όνομα υποχρεωτικό');
  if (!email || !email.includes('@')) return jsonError('Έγκυρο email υποχρεωτικό');
  if (!message || message.length < 5) return jsonError('Μήνυμα υποχρεωτικό');
  if (message.length > 4000) return jsonError('Μήνυμα πολύ μεγάλο');

  // ─── Routing: try to find the right agency ─────────────────────
  let routedAgencyEmail: string | null = null;
  let routedAgencyName: string | null = null;
  let tourTitle: string | undefined;
  let tourUrl: string | undefined;

  if (tourSlug) {
    try {
      const all = await listToursPublic();
      const t = all.find((x) => x.slug === tourSlug);
      if (t) {
        tourTitle = t.data.title;
        tourUrl = `${SITE.url}/ekdromi/${t.slug}`;
        if (t.agencyId) {
          const ag = await readAgencyByIdAdmin(t.agencyId);
          if (ag?.email) {
            routedAgencyEmail = ag.email;
            routedAgencyName = ag.name;
          }
        }
      }
    } catch (e) {
      console.warn('[contact] tour lookup failed:', e);
    }
  }

  if (!routedAgencyEmail && agencySlug) {
    try {
      const all = await listToursPublic(); // any list helper that includes agency context — keep simple
      const t = all.find((x) => x.agencyId);
      // not ideal, fallback to admin lookup
      const { listAgenciesAdmin } = await import('@lib/agencies-db');
      const ags = await listAgenciesAdmin();
      const ag = ags.find((x) => x.slug === agencySlug && x.status === 'active');
      if (ag?.email) {
        routedAgencyEmail = ag.email;
        routedAgencyName = ag.name;
      }
      void t;
    } catch (e) {
      console.warn('[contact] agency lookup failed:', e);
    }
  }

  // ─── Send emails ──────────────────────────────────────────────
  const tasks: Promise<unknown>[] = [];

  if (routedAgencyEmail && routedAgencyName) {
    tasks.push(
      sendEmail({
        to: routedAgencyEmail,
        replyTo: email,
        ...tplContactToAgency({
          agencyName: routedAgencyName,
          visitorName: name,
          visitorEmail: email,
          visitorPhone: phone || undefined,
          subject: subject || tourTitle || 'Γενικό ενδιαφέρον',
          message,
          tourTitle,
          tourUrl,
        }),
      }),
    );
  }

  // Always copy admin so Mina has visibility
  tasks.push(
    sendEmail({
      to: getAdminEmail(),
      replyTo: email,
      ...tplContactToAdmin({
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone || undefined,
        subject: subject || tourTitle || 'Γενικό ενδιαφέρον',
        message,
        routedToAgency: routedAgencyName ?? undefined,
      }),
    }),
  );

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r as any).value?.ok && !(r as any).value?.skipped));

  if (failed.length === results.length) {
    // Every send failed — surface so the user knows to try another channel
    return jsonError('Σφάλμα αποστολής. Παρακαλώ καλέστε μας απευθείας.', 502);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      routedToAgency: routedAgencyName,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
