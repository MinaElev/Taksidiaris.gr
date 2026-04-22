export const prerender = false;

import type { APIRoute } from 'astro';
import { writeHotel, readHotel, deleteHotel } from '@lib/content-io';

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

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export const PUT: APIRoute = async ({ params, request }) => {
  const slug = sanitizeSlug(params.slug as string);
  if (!slug) return new Response('slug required', { status: 400 });
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!payload?.name || !payload?.description || !payload?.destination) {
    return new Response('name, description and destination are required', { status: 400 });
  }
  if (!['ellada', 'europi', 'kosmos'].includes(payload.region)) {
    return new Response('region must be ellada, europi, or kosmos', { status: 400 });
  }

  const stars = num(payload.stars);
  if (stars !== undefined && (stars < 1 || stars > 5)) {
    return new Response('stars must be between 1 and 5', { status: 400 });
  }

  const lat = num(payload?.coordinates?.lat);
  const lng = num(payload?.coordinates?.lng);
  const coordinates = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;

  const body = String(payload.body ?? '');
  const today = new Date().toISOString().slice(0, 10);

  const data = {
    name: String(payload.name),
    aliases: Array.isArray(payload.aliases) ? payload.aliases.map(String).filter(Boolean) : [],
    description: String(payload.description),
    destination: String(payload.destination),
    region: payload.region as 'ellada' | 'europi' | 'kosmos',
    city: str(payload.city),
    address: str(payload.address),
    stars,
    category: str(payload.category),
    hero: str(payload.hero),
    gallery: Array.isArray(payload.gallery) ? payload.gallery.map(String).filter(Boolean) : [],
    intro: str(payload.intro),
    amenities: Array.isArray(payload.amenities) ? payload.amenities.map(String).filter(Boolean) : [],
    roomTypes: Array.isArray(payload.roomTypes)
      ? payload.roomTypes
          .filter((r: any) => r && r.name)
          .map((r: any) => ({
            name: String(r.name),
            description: r.description ? String(r.description) : undefined,
          }))
      : [],
    distances: Array.isArray(payload.distances)
      ? payload.distances
          .filter((d: any) => d && d.place && d.value)
          .map((d: any) => ({ place: String(d.place), value: String(d.value) }))
      : [],
    breakfast: str(payload.breakfast),
    checkIn: str(payload.checkIn),
    checkOut: str(payload.checkOut),
    website: str(payload.website),
    coordinates,
    faqs: Array.isArray(payload.faqs)
      ? payload.faqs
          .filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string' && f.q.trim() && f.a.trim())
          .map((f: any) => ({ q: String(f.q), a: String(f.a) }))
      : [],
    keywords: Array.isArray(payload.keywords) ? payload.keywords.map(String).filter(Boolean) : [],
    sources: Array.isArray(payload.sources) ? payload.sources.map(String).filter(Boolean) : [],
    draft: Boolean(payload.draft),
    updatedAt: today,
  };

  await writeHotel(slug, data, body);
  return new Response(JSON.stringify({ ok: true, slug }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug as string;
  try {
    const entry = await readHotel(slug);
    return new Response(JSON.stringify({ ...entry.data, _body: entry.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const slug = params.slug as string;
  try {
    await deleteHotel(slug);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
