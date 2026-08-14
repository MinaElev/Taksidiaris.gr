export const prerender = false;

import type { APIRoute } from 'astro';
import { readAgencyAdmin, recordAgencyPayment } from '@lib/agencies-db';
import { SUBSCRIPTION_MONTHLY_CENTS } from '@lib/subscription';

// Record a subscription payment for an agency and extend its paid-through
// date. Manual-invoice billing — the admin enters how many months were paid.
// Protected by the admin middleware guard (/api/admin/*).
//
// Body: { months?, amountCents?, method?, invoiceNumber?, note? }

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_METHODS = ['invoice', 'bank_transfer', 'card', 'cash', 'comp'];

export const POST: APIRoute = async ({ params, request }) => {
  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  const months = Math.max(1, Math.min(60, Math.round(Number(payload?.months ?? 1))));
  if (!Number.isFinite(months)) return jsonError('months must be a number');

  const amountCents =
    payload?.amountCents != null && payload.amountCents !== ''
      ? Math.round(Number(payload.amountCents))
      : SUBSCRIPTION_MONTHLY_CENTS * months;
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return jsonError('amountCents must be a non-negative number');
  }

  const method = String(payload?.method || 'invoice');
  if (!VALID_METHODS.includes(method)) {
    return jsonError(`method must be one of: ${VALID_METHODS.join(', ')}`);
  }

  const invoiceNumber =
    payload?.invoiceNumber != null && String(payload.invoiceNumber).trim()
      ? String(payload.invoiceNumber).trim()
      : null;
  const note =
    payload?.note != null && String(payload.note).trim() ? String(payload.note).trim() : null;

  try {
    const agency = await readAgencyAdmin(slug);
    if (!agency) return jsonError('Not found', 404);

    const result = await recordAgencyPayment(agency.id, {
      amountCents,
      months,
      method,
      invoiceNumber,
      note,
    });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[admin/agency/${slug}/payment] failed:`, detail);
    return new Response(JSON.stringify({ error: 'Payment failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
