export const prerender = false;

import type { APIRoute } from 'astro';
import {
  readTourForAgency,
  updateTourForAgency,
  deleteTourForAgency,
} from '@lib/tours-db';
import type { TourFrontmatter, Region } from '@lib/content-io';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function trimOrEmpty(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function asArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const VALID_REGIONS: Region[] = ['ellada', 'europi', 'kosmos'];
const VALID_TRANSPORT = ['αεροπορικώς', 'οδικώς', 'ακτοπλοϊκώς', 'συνδυαστικά'] as const;
type Transport = (typeof VALID_TRANSPORT)[number];

function asTransport(v: unknown): Transport | undefined {
  const s = trimOrEmpty(v);
  return (VALID_TRANSPORT as readonly string[]).includes(s) ? (s as Transport) : undefined;
}

/**
 * Update an existing tour. Ownership enforced — the WHERE clause includes
 * both `slug` and `agency_id`, so an agency can only patch tours that
 * already belong to them. Slug is immutable here (rename = create + delete).
 *
 * We preserve the JSONB fields the basic editor doesn't expose (itinerary,
 * pricing, hotels, faqs, etc.) by reading the current row first and merging.
 * This way Mina can fill those in via /admin and the agency editing the
 * basics doesn't wipe them out.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');

  const existing = await readTourForAgency(slug, session.agencyId);
  if (!existing) return jsonError('Δεν βρέθηκε εκδρομή σου με αυτό το slug', 404);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  const title = trimOrEmpty(payload?.title);
  if (!title) return jsonError('title required');
  const description = trimOrEmpty(payload?.description);
  if (!description) return jsonError('description required');
  const destination = trimOrEmpty(payload?.destination);
  if (!destination) return jsonError('destination required');

  const region = String(payload?.region || '').trim() as Region;
  if (!VALID_REGIONS.includes(region)) {
    return jsonError('region must be one of: ellada, europi, kosmos');
  }

  const days = Number(payload?.days);
  const nights = Number(payload?.nights);
  if (!Number.isFinite(days) || days < 1) return jsonError('days must be >= 1');
  if (!Number.isFinite(nights) || nights < 0) return jsonError('nights must be >= 0');

  // Merge: take new "basic" fields from the payload, preserve everything
  // else (the rich JSONB structures) from the existing row.
  const merged: TourFrontmatter = {
    ...existing.data,
    title,
    description,
    destination,
    region,
    period: trimOrEmpty(payload?.period) || undefined,
    priceFrom:
      payload?.priceFrom != null && payload.priceFrom !== ''
        ? Number(payload.priceFrom)
        : undefined,
    currency: trimOrEmpty(payload?.currency) || '€',
    duration: { days, nights },
    transport: asTransport(payload?.transport),
    departureCities: asArray(payload?.departureCities),
    hero: trimOrEmpty(payload?.hero) || undefined,
    intro: trimOrEmpty(payload?.intro) || undefined,
    includes: asArray(payload?.includes),
    notIncludes: asArray(payload?.notIncludes),
    notes: asArray(payload?.notes),
    keywords: asArray(payload?.keywords),
    draft: Boolean(payload?.draft),
  };

  const body = typeof payload?.body === 'string' ? payload.body : existing.body;

  try {
    const saved = await updateTourForAgency(session.agencyId, slug, merged, body);
    if (!saved) return jsonError('Update returned no row (ownership lost?)', 409);
    return new Response(JSON.stringify({ ok: true, slug: saved.slug }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[agency/tour PUT ${slug}] failed:`, detail);
    return new Response(JSON.stringify({ error: 'Update failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * Delete a tour. Ownership enforced via WHERE on agency_id.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');

  try {
    const ok = await deleteTourForAgency(session.agencyId, slug);
    if (!ok) return jsonError('Δεν βρέθηκε εκδρομή σου με αυτό το slug', 404);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[agency/tour DELETE ${slug}] failed:`, detail);
    return new Response(JSON.stringify({ error: 'Delete failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
