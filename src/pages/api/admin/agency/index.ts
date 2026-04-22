export const prerender = false;

import type { APIRoute } from 'astro';
import { createAgency, readAgencyAdmin } from '@lib/agencies-db';
import { slugifyCity } from '@lib/departure-cities';

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

export const POST: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }
  const name = trimOrNull(payload?.name);
  if (!name) return jsonError('name required');

  // slug: caller can override, otherwise derive from name. Either way we
  // always run it through slugifyCity so Greek input is transliterated and
  // spaces / special chars become hyphens. URLs must be ASCII-safe.
  const rawSlug = trimOrNull(payload?.slug);
  let slug = rawSlug ? slugifyCity(rawSlug) : slugifyCity(name);
  if (!slug) return jsonError('Could not derive slug from name');

  // Reject if slug already taken — friendlier than catching the unique
  // constraint violation.
  const existing = await readAgencyAdmin(slug).catch(() => null);
  if (existing) return jsonError(`Slug "${slug}" is already in use`, 409);

  const status = ['active', 'suspended', 'pending'].includes(payload?.status)
    ? payload.status
    : 'pending'; // new agencies start pending until invited

  try {
    const agency = await createAgency({
      slug,
      name,
      description: trimOrNull(payload?.description),
      logoUrl: trimOrNull(payload?.logoUrl),
      phone: trimOrNull(payload?.phone),
      email: trimOrNull(payload?.email),
      website: trimOrNull(payload?.website),
      address: trimOrNull(payload?.address),
      city: trimOrNull(payload?.city),
      vat: trimOrNull(payload?.vat),
      eotLicense: trimOrNull(payload?.eotLicense),
      status,
    });
    return new Response(JSON.stringify({ ok: true, agency }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error('[admin/agency POST] create failed:', detail);
    return new Response(JSON.stringify({ error: 'Create failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
