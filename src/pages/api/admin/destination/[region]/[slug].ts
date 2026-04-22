export const prerender = false;

import type { APIRoute } from 'astro';
import { writeDestination, readDestination, type Region } from '@lib/content-io';

const REGIONS: Region[] = ['ellada', 'europi', 'kosmos'];

export const PUT: APIRoute = async ({ params, request }) => {
  const region = params.region as Region;
  const slug = params.slug as string;
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
  const body = String(payload.body ?? '');
  const data = {
    title: String(payload.title),
    description: String(payload.description),
    region,
    hero: payload.hero || undefined,
    intro: payload.intro || undefined,
    bestTime: payload.bestTime || undefined,
    duration: payload.duration || undefined,
    highlights: Array.isArray(payload.highlights) ? payload.highlights.map(String) : [],
    faqs: Array.isArray(payload.faqs)
      ? payload.faqs
          .filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string')
          .map((f: any) => ({ q: String(f.q), a: String(f.a) }))
      : [],
    keywords: Array.isArray(payload.keywords) ? payload.keywords.map(String) : [],
    draft: Boolean(payload.draft),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await writeDestination(region, slug, data, body);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ params }) => {
  const region = params.region as Region;
  const slug = params.slug as string;
  if (!REGIONS.includes(region)) {
    return new Response('Invalid region', { status: 400 });
  }
  try {
    const entry = await readDestination(region, slug);
    return new Response(JSON.stringify({ ...entry.data, _body: entry.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
