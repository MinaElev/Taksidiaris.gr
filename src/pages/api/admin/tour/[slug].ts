export const prerender = false;

import type { APIRoute } from 'astro';
// Tours live in Postgres now (multi-agency pivot). Mina edits via /admin
// → writeTourAdmin upserts; agencies edit via /agency → updateTourForAgency.
// Both go through the same `tours` table; we preserve agency_id when present.
import { writeTourAdmin, readTourAdmin } from '@lib/tours-db';

function sanitizeSlug(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PUT: APIRoute = async ({ params, request }) => {
  const slug = sanitizeSlug(params.slug as string);
  if (!slug) return jsonError('slug required');
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }
  if (!payload?.title || !payload?.description || !payload?.destination) {
    return jsonError('title, description and destination are required');
  }
  if (!['ellada', 'europi', 'kosmos'].includes(payload.region)) {
    return jsonError('region must be ellada, europi, or kosmos');
  }
  const days = num(payload?.duration?.days);
  const nights = num(payload?.duration?.nights);
  if (!days || !nights) {
    return jsonError('duration.days and duration.nights required (numbers)');
  }

  const body = String(payload.body ?? '');
  const today = new Date().toISOString().slice(0, 10);

  const data = {
    title: String(payload.title),
    description: String(payload.description),
    destination: String(payload.destination),
    region: payload.region as 'ellada' | 'europi' | 'kosmos',
    period: payload.period || undefined,
    priceFrom: num(payload.priceFrom),
    currency: payload.currency || '€',
    duration: { days, nights },
    transport: ['αεροπορικώς', 'οδικώς', 'ακτοπλοϊκώς', 'συνδυαστικά'].includes(payload.transport)
      ? payload.transport
      : 'αεροπορικώς',
    departureCities: Array.isArray(payload.departureCities) ? payload.departureCities.map(String).filter(Boolean) : [],
    pickupSchedule: Array.isArray(payload.pickupSchedule)
      ? payload.pickupSchedule
          .filter((p: any) => p && p.city)
          .map((p: any) => ({
            city: String(p.city),
            location: p.location ? String(p.location) : undefined,
            time: p.time ? String(p.time) : undefined,
          }))
      : [],
    dates: Array.isArray(payload.dates)
      ? payload.dates
          .filter((d: any) => d && d.from && d.to)
          .map((d: any) => ({
            from: String(d.from),
            to: String(d.to),
            label: d.label ? String(d.label) : undefined,
          }))
      : [],
    hero: payload.hero || undefined,
    gallery: Array.isArray(payload.gallery) ? payload.gallery.map(String).filter(Boolean) : [],
    intro: payload.intro || undefined,
    itinerary: Array.isArray(payload.itinerary)
      ? payload.itinerary
          .filter((d: any) => d && (d.title || d.description))
          .map((d: any, i: number) => ({
            day: num(d.day) ?? i + 1,
            title: String(d.title || `Ημέρα ${i + 1}`),
            description: String(d.description || ''),
          }))
      : [],
    hotels: Array.isArray(payload.hotels)
      ? payload.hotels
          .filter((h: any) => h && h.name)
          .map((h: any) => ({
            name: String(h.name),
            location: h.location ? String(h.location) : undefined,
            nights: num(h.nights),
            board: h.board ? String(h.board) : undefined,
            stars: num(h.stars),
          }))
      : [],
    pricing: Array.isArray(payload.pricing)
      ? payload.pricing
          .filter((p: any) => p && p.fromCity && num(p.perPerson) !== undefined)
          .map((p: any) => ({
            fromCity: String(p.fromCity),
            perPerson: num(p.perPerson)!,
            singleSupplement: num(p.singleSupplement),
            childDiscount: p.childDiscount ? String(p.childDiscount) : undefined,
          }))
      : [],
    includes: Array.isArray(payload.includes) ? payload.includes.map(String).filter(Boolean) : [],
    notIncludes: Array.isArray(payload.notIncludes) ? payload.notIncludes.map(String).filter(Boolean) : [],
    bookingProcess: Array.isArray(payload.bookingProcess) ? payload.bookingProcess.map(String).filter(Boolean) : [],
    cancellationPolicy: Array.isArray(payload.cancellationPolicy) ? payload.cancellationPolicy.map(String).filter(Boolean) : [],
    notes: Array.isArray(payload.notes) ? payload.notes.map(String).filter(Boolean) : [],
    faqs: Array.isArray(payload.faqs)
      ? payload.faqs
          .filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string' && f.q.trim() && f.a.trim())
          .map((f: any) => ({ q: String(f.q), a: String(f.a) }))
      : [],
    keywords: Array.isArray(payload.keywords) ? payload.keywords.map(String).filter(Boolean) : [],
    related: Array.isArray(payload.related) ? payload.related.map(String).filter(Boolean) : [],
    draft: Boolean(payload.draft),
    updatedAt: today,
  };

  try {
    // writeTourAdmin: upsert by slug, preserving the existing agency_id (if any).
    // We don't pass agencyId here — admin saves shouldn't accidentally reassign
    // the tour. Agency reassignment goes through PUT /api/admin/tour/[slug]/agency.
    await writeTourAdmin(slug, data, body);
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[admin/tour PUT ${slug}] write failed:`, detail);
    return new Response(
      JSON.stringify({ error: 'Save failed', detail }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ ok: true, slug }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ params }) => {
  const slug = String(params.slug || '');
  try {
    const entry = await readTourAdmin(slug);
    if (!entry) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify({ ...entry.data, _body: entry.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error(`[admin/tour GET ${slug}] read failed:`, e?.message || e);
    return new Response('Not found', { status: 404 });
  }
};
