export const prerender = false;

import type { APIRoute } from 'astro';
import { readAgencyByIdAdmin } from '@lib/agencies-db';
import { subscriptionLabel } from '@lib/subscription';
import { sendEmail, getAdminEmail } from '@lib/email';
import { tplRenewalRequest } from '@lib/email-templates';

// Agency-initiated renewal request. Billing is manual invoicing, so this
// doesn't take payment — it emails the admin to prepare an invoice. Protected
// by the agency middleware guard (session on locals).

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  const agency = await readAgencyByIdAdmin(session.agencyId).catch(() => null);
  if (!agency) return jsonError('Δεν βρέθηκε γραφείο', 404);

  const sub = subscriptionLabel(agency.subscriptionStatus, agency.subscriptionPeriodEnd);
  const periodEndLabel = agency.subscriptionPeriodEnd
    ? new Date(agency.subscriptionPeriodEnd).toLocaleDateString('el-GR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : '—';

  try {
    const r = await sendEmail({
      to: getAdminEmail(),
      replyTo: agency.email || undefined,
      ...tplRenewalRequest({
        agencyName: agency.name,
        slug: agency.slug,
        email: agency.email,
        phone: agency.phone,
        periodEndLabel,
        statusText: sub.text,
      }),
    });
    if (!r.ok && !r.skipped) {
      return jsonError('Δεν στάλθηκε το αίτημα, δοκίμασε ξανά ή τηλεφώνησέ μας.', 502);
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[agency/subscription/renew-request] failed:', e?.message || e);
    return jsonError('Τεχνικό σφάλμα', 500);
  }
};
