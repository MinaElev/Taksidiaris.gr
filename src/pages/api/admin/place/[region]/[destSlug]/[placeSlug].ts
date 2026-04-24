export const prerender = false;

import type { APIRoute } from 'astro';
import {
  readPlace,
  writePlace,
  deletePlace,
  type PlaceFrontmatter,
  type PlaceType,
  type Region,
} from '@lib/content-io';

const REGIONS: Region[] = ['ellada', 'europi', 'kosmos'];
const TYPES: PlaceType[] = [
  'park', 'beach', 'village', 'monument', 'museum',
  'species', 'island', 'experience', 'landmark',
];

function sanitizeFaqs(raw: unknown): { q: string; a: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string')
    .map((f: any) => ({ q: String(f.q).trim(), a: String(f.a).trim() }))
    .filter((f) => f.q && f.a);
}

function sanitizeSources(raw: unknown): { title: string; url: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s: any) => s && typeof s.title === 'string' && typeof s.url === 'string')
    .map((s: any) => ({ title: String(s.title).trim(), url: String(s.url).trim() }))
    .filter((s) => s.title && s.url);
}

function sanitizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).map((s) => s.trim()).filter(Boolean);
}

export const GET: APIRoute = async ({ params }) => {
  const region = params.region as Region;
  const destSlug = params.destSlug as string;
  const placeSlug = params.placeSlug as string;
  if (!REGIONS.includes(region)) {
    return new Response('Invalid region', { status: 400 });
  }
  try {
    const entry = await readPlace(destSlug, placeSlug);
    return new Response(JSON.stringify({ ...entry.data, _body: entry.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const region = params.region as Region;
  const destSlug = params.destSlug as string;
  const placeSlug = params.placeSlug as string;
  if (!REGIONS.includes(region)) {
    return new Response('Invalid region', { status: 400 });
  }
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!payload?.title || !payload?.description) {
    return new Response('title and description are required', { status: 400 });
  }
  const type = TYPES.includes(payload.type) ? payload.type : 'landmark';
  const body = String(payload.body ?? '');
  const data: PlaceFrontmatter = {
    title: String(payload.title),
    description: String(payload.description),
    destination: `${region}/${destSlug}`,
    type,
    hero: payload.hero || undefined,
    intro: payload.intro || undefined,
    tagline: payload.tagline || undefined,
    faqs: sanitizeFaqs(payload.faqs),
    keywords: sanitizeStringArray(payload.keywords),
    sources: sanitizeSources(payload.sources),
    relatedPlaces: sanitizeStringArray(payload.relatedPlaces),
    draft: Boolean(payload.draft),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await writePlace(destSlug, placeSlug, data, body);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const region = params.region as Region;
  const destSlug = params.destSlug as string;
  const placeSlug = params.placeSlug as string;
  if (!REGIONS.includes(region)) {
    return new Response('Invalid region', { status: 400 });
  }
  try {
    await deletePlace(destSlug, placeSlug);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(`Delete failed: ${err?.message || err}`, { status: 500 });
  }
};
