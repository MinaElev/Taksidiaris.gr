export const prerender = false;

import type { APIRoute } from 'astro';
import { readAgencyByIdAdmin, updateAgency } from '@lib/agencies-db';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Update the logged-in agency's own profile.
 *
 * What an agency CAN edit: name, description, logo, phone, email, website,
 * address, city, vat, eotLicense.
 *
 * What an agency CANNOT edit: slug (would break URLs), status (only Mina
 * can activate/suspend). These are silently ignored if present in the payload.
 */
export const PUT: APIRoute = async ({ request, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  // Look up the agency by id to get its current slug — updateAgency uses
  // slug as the key.
  const current = await readAgencyByIdAdmin(session.agencyId);
  if (!current) return jsonError('Agency not found', 404);

  const name = trimOrNull(payload?.name);
  if (!name) return jsonError('name required');

  try {
    const updated = await updateAgency(current.slug, {
      name,
      description: trimOrNull(payload?.description),
      logoUrl:     trimOrNull(payload?.logoUrl),
      phone:       trimOrNull(payload?.phone),
      email:       trimOrNull(payload?.email),
      website:     trimOrNull(payload?.website),
      address:     trimOrNull(payload?.address),
      city:        trimOrNull(payload?.city),
      vat:         trimOrNull(payload?.vat),
      eotLicense:  trimOrNull(payload?.eotLicense),
      // status & slug intentionally not passed — not editable by agency.
    });
    return new Response(JSON.stringify({ ok: true, agency: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error('[agency/profile PUT] failed:', detail);
    return new Response(JSON.stringify({ error: 'Update failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
