export const prerender = false;

import type { APIRoute } from 'astro';
import { writePeriod, readPeriod } from '@lib/content-io';

export const PUT: APIRoute = async ({ params, request }) => {
  const slug = params.slug as string;
  if (!slug) return new Response('slug required', { status: 400 });
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
    shortName: payload.shortName || undefined,
    dates: payload.dates || undefined,
    intro: payload.intro || undefined,
    hero: payload.hero || undefined,
    popularDestinations: Array.isArray(payload.popularDestinations) ? payload.popularDestinations.map(String) : [],
    faqs: Array.isArray(payload.faqs)
      ? payload.faqs
          .filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string')
          .map((f: any) => ({ q: String(f.q), a: String(f.a) }))
      : [],
    keywords: Array.isArray(payload.keywords) ? payload.keywords.map(String) : [],
    draft: Boolean(payload.draft),
  };
  await writePeriod(slug, data, body);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug as string;
  try {
    const entry = await readPeriod(slug);
    return new Response(JSON.stringify({ ...entry.data, _body: entry.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
