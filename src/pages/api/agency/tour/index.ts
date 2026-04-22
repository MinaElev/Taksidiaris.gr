export const prerender = false;

import type { APIRoute } from 'astro';
import { createTourForAgency, isSlugAvailable } from '@lib/tours-db';
import { slugifyCity } from '@lib/departure-cities';
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
  // Comma / newline separated
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
 * Create a new tour for the logged-in agency.
 *
 * Body: { title, description, destination, region, days, nights, transport,
 *         priceFrom, currency, period, departureCities, hero, body, draft }
 *
 * The agency_id is taken from the session — clients can NEVER specify which
 * agency to attribute the tour to. The slug is derived from the title via
 * slugifyCity (Greek-safe). Caller can override via `slug` if they want.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  const title = trimOrEmpty(payload?.title);
  if (!title) return jsonError('title required');

  // Slug: caller can pass one, otherwise derive from title. Always run
  // through slugifyCity so URLs stay ASCII-safe even with Greek input.
  const rawSlug = trimOrEmpty(payload?.slug);
  const slug = rawSlug ? slugifyCity(rawSlug) : slugifyCity(title);
  if (!slug) return jsonError('Could not derive slug from title');

  // Reject collisions up front (friendlier than letting Postgres' unique
  // constraint blow up).
  if (!(await isSlugAvailable(slug))) {
    return jsonError(`Το slug "${slug}" χρησιμοποιείται ήδη. Δοκίμασε άλλον τίτλο ή πρόσθεσε λεπτομέρεια.`, 409);
  }

  const region = String(payload?.region || '').trim() as Region;
  if (!VALID_REGIONS.includes(region)) {
    return jsonError('region must be one of: ellada, europi, kosmos');
  }

  const days = Number(payload?.days);
  const nights = Number(payload?.nights);
  if (!Number.isFinite(days) || days < 1) return jsonError('days must be >= 1');
  if (!Number.isFinite(nights) || nights < 0) return jsonError('nights must be >= 0');

  const description = trimOrEmpty(payload?.description);
  if (!description) return jsonError('description required');
  const destination = trimOrEmpty(payload?.destination);
  if (!destination) return jsonError('destination required');

  const data: TourFrontmatter = {
    title,
    description,
    destination,
    region,
    period: trimOrEmpty(payload?.period) || undefined,
    priceFrom: payload?.priceFrom != null && payload.priceFrom !== '' ? Number(payload.priceFrom) : undefined,
    currency: trimOrEmpty(payload?.currency) || '€',
    duration: { days, nights },
    transport: asTransport(payload?.transport),
    departureCities: asArray(payload?.departureCities),
    pickupSchedule: [],
    dates: [],
    hero: trimOrEmpty(payload?.hero) || undefined,
    gallery: [],
    intro: trimOrEmpty(payload?.intro) || undefined,
    itinerary: [],
    hotels: [],
    pricing: [],
    includes: asArray(payload?.includes),
    notIncludes: asArray(payload?.notIncludes),
    bookingProcess: [],
    cancellationPolicy: [],
    notes: asArray(payload?.notes),
    faqs: [],
    keywords: asArray(payload?.keywords),
    related: [],
    draft: payload?.draft !== false, // new tours default to draft=true (safer)
  };

  const body = String(payload?.body ?? '');

  try {
    const saved = await createTourForAgency(session.agencyId, slug, data, body);
    return new Response(JSON.stringify({ ok: true, slug: saved.slug }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[agency/tour POST] failed:`, detail);
    return new Response(JSON.stringify({ error: 'Create failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
