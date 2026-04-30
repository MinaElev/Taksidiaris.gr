export const prerender = false;

import type { APIRoute } from 'astro';
import { listToursAdmin } from '@lib/tours-db';
import { listAgenciesAdmin } from '@lib/agencies-db';
import { listDestinations } from '@lib/content-io';
import { isTourExpired } from '@lib/tour-status';
import { sendEmail, getAdminEmail } from '@lib/email';
import { tplDailyDigest } from '@lib/email-templates';

/**
 * Vercel cron — runs once per day. Configured in vercel.json.
 *
 * Authentication: Vercel automatically attaches an Authorization header
 * with `Bearer ${CRON_SECRET}` when CRON_SECRET is set in env. We refuse
 * any unauthenticated call so a leaked URL can't drain AI credits.
 *
 * Daily tasks:
 *   1. Send admin digest email (pending agencies, new/expired tours, stub
 *      destinations needing enrichment)
 *
 * Future tasks (TODO):
 *   - Auto-enrich stub destinations via AI (1-2 per day to control cost)
 *   - Tour-date reminders to agencies (7 days before departure)
 *   - Broken-link health check report
 */
function envVar(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as any)[name];
}

function authorize(request: Request): { ok: true } | { ok: false; status: number; msg: string } {
  const expected = envVar('CRON_SECRET');
  if (!expected) {
    // Without CRON_SECRET the endpoint is open. We log a warning but allow
    // it so the dev environment can still hit it.
    console.warn('[cron] CRON_SECRET not configured — endpoint is unauthenticated');
    return { ok: true };
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${expected}`) {
    return { ok: false, status: 401, msg: 'Unauthorized' };
  }
  return { ok: true };
}

export const GET: APIRoute = async ({ request }) => {
  const auth = authorize(request);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.msg }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const startedAt = Date.now();
  const log: string[] = [];
  const tasks: Record<string, unknown> = {};

  try {
    const [tours, agencies, destinations] = await Promise.all([
      listToursAdmin().catch(() => []),
      listAgenciesAdmin().catch(() => []),
      listDestinations().catch(() => []),
    ]);

    // --- Stats ---
    const today = new Date().toISOString().slice(0, 10);
    const pendingAgencies = agencies.filter((a) => a.status === 'pending').length;
    const newToursToday = tours.filter(
      (t) => String(t.data.updatedAt || '').slice(0, 10) === today && !t.data.draft,
    ).length;

    // Expired today: any tour whose latest "to" date is exactly yesterday/today
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const expiredToursToday = tours.filter((t) => {
      if (!isTourExpired(t.data.dates)) return false;
      const dates = t.data.dates || [];
      const latestTo = dates.reduce((max, d) => (d.to > max ? d.to : max), '');
      return latestTo.slice(0, 10) === yesterday || latestTo.slice(0, 10) === today;
    }).length;

    // Stub destinations: drafts created by agency signup, identifiable by
    // the auto-generated description prefix `<title>: ταξιδιωτικός οδηγός`.
    const stubDestinations = destinations.filter(
      (d) => d.data.draft && /:\s*ταξιδιωτικός οδηγός/.test(d.data.description || ''),
    ).length;

    log.push(`Stats: ${pendingAgencies} pending, ${newToursToday} new, ${expiredToursToday} expired, ${stubDestinations} stubs`);

    // --- Daily digest email to admin ---
    const digest = tplDailyDigest({
      pendingAgencies,
      newToursToday,
      expiredToursToday,
      stubDestinations,
    });
    if (digest) {
      const r = await sendEmail({ to: getAdminEmail(), ...digest });
      tasks.digest = r;
      log.push(`Digest sent: ${r.ok ? 'ok' : r.error || 'failed'}`);
    } else {
      log.push('Digest skipped (nothing to report)');
      tasks.digest = { skipped: true };
    }

    // TODO: Auto-enrich stub destinations
    // TODO: Tour-date reminders

    return new Response(
      JSON.stringify({
        ok: true,
        runtimeMs: Date.now() - startedAt,
        log,
        tasks,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[cron/daily] failed:', e?.message || e);
    return new Response(
      JSON.stringify({ error: 'cron failed', detail: String(e?.message || e), log }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
