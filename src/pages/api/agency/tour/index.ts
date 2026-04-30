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
  return String(v)
    .split(/\n/)
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

function asPickupSchedule(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      city: trimOrEmpty(x?.city),
      ...(trimOrEmpty(x?.location) ? { location: trimOrEmpty(x.location) } : {}),
      ...(trimOrEmpty(x?.time) ? { time: trimOrEmpty(x.time) } : {}),
    }))
    .filter((p) => p.city);
}

function asDates(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      from: trimOrEmpty(x?.from),
      to: trimOrEmpty(x?.to),
      ...(trimOrEmpty(x?.label) ? { label: trimOrEmpty(x.label) } : {}),
    }))
    .filter((d) => d.from && d.to);
}

function asItinerary(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any, i: number) => ({
      day: Number.isFinite(Number(x?.day)) ? Number(x.day) : i + 1,
      title: trimOrEmpty(x?.title),
      description: trimOrEmpty(x?.description),
    }))
    .filter((d) => d.title || d.description);
}

function asHotels(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => {
      const out: any = { name: trimOrEmpty(x?.name) };
      if (trimOrEmpty(x?.location)) out.location = trimOrEmpty(x.location);
      if (Number.isFinite(Number(x?.nights))) out.nights = Number(x.nights);
      if (trimOrEmpty(x?.board)) out.board = trimOrEmpty(x.board);
      if (Number.isFinite(Number(x?.stars))) out.stars = Number(x.stars);
      return out;
    })
    .filter((h) => h.name);
}

function asPricing(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => {
      const out: any = {
        fromCity: trimOrEmpty(x?.fromCity),
        perPerson: Number.isFinite(Number(x?.perPerson)) ? Number(x.perPerson) : 0,
      };
      if (Number.isFinite(Number(x?.singleSupplement))) {
        out.singleSupplement = Number(x.singleSupplement);
      }
      if (trimOrEmpty(x?.childDiscount)) out.childDiscount = trimOrEmpty(x.childDiscount);
      return out;
    })
    .filter((p) => p.fromCity);
}

function asFaqs(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      q: trimOrEmpty(x?.q),
      a: trimOrEmpty(x?.a),
    }))
    .filter((f) => f.q && f.a);
}

/**
 * Create a new tour for the logged-in agency.
 *
 * Body: full tour shape — title, description, destination, region, days,
 * nights, transport, priceFrom, currency, period, departureCities, hero,
 * intro, body, includes, notIncludes, notes, keywords, draft, AND the
 * structured arrays: pickupSchedule, dates, itinerary, hotels, pricing,
 * bookingProcess, cancellationPolicy, faqs.
 *
 * The agency_id is taken from the session — clients can NEVER specify which
 * agency to attribute the tour to. Slug derived from title via slugifyCity.
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

  const rawSlug = trimOrEmpty(payload?.slug);
  const slug = rawSlug ? slugifyCity(rawSlug) : slugifyCity(title);
  if (!slug) return jsonError('Could not derive slug from title');

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
    currency: '€', // locked for the agency portal
    duration: { days, nights },
    transport: asTransport(payload?.transport),
    departureCities: asArray(payload?.departureCities),
    pickupSchedule: asPickupSchedule(payload?.pickupSchedule),
    dates: asDates(payload?.dates),
    hero: trimOrEmpty(payload?.hero) || undefined,
    gallery: [],
    intro: trimOrEmpty(payload?.intro) || undefined,
    itinerary: asItinerary(payload?.itinerary),
    hotels: asHotels(payload?.hotels),
    pricing: asPricing(payload?.pricing),
    includes: asArray(payload?.includes),
    notIncludes: asArray(payload?.notIncludes),
    bookingProcess: asArray(payload?.bookingProcess),
    cancellationPolicy: asArray(payload?.cancellationPolicy),
    notes: asArray(payload?.notes),
    faqs: asFaqs(payload?.faqs),
    keywords: asArray(payload?.keywords),
    related: [],
    draft: payload?.draft !== false,
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
