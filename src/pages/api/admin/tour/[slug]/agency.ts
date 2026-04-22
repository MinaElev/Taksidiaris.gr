export const prerender = false;

import type { APIRoute } from 'astro';
import { setAgencyForTourSlug } from '@lib/tour-agency';
import { readAgencyByIdAdmin } from '@lib/agencies-db';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Assign / unassign a tour to an agency.
 * Body: { agencyId: string | null }
 *
 * Idempotent. Pass `null` to make tour legacy (Mina-managed).
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  // Treat empty string as null (the <select> sends "" for the legacy option).
  let agencyId: string | null = null;
  if (payload?.agencyId && String(payload.agencyId).trim()) {
    agencyId = String(payload.agencyId).trim();
    // Sanity check: agency must exist (any status — Mina can assign to a
    // pending agency before activating it).
    const agency = await readAgencyByIdAdmin(agencyId).catch(() => null);
    if (!agency) return jsonError(`Agency ${agencyId} not found`, 404);
  }

  try {
    await setAgencyForTourSlug(slug, agencyId);
    return new Response(JSON.stringify({ ok: true, slug, agencyId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[admin/tour/${slug}/agency PUT] failed:`, detail);
    return new Response(JSON.stringify({ error: 'Update failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
