export const prerender = false;

import type { APIRoute } from 'astro';
import { writeArticle, readArticle } from '@lib/content-io';

function sanitizeSlug(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
  if (!payload?.title || !payload?.description) {
    return new Response('title and description are required', { status: 400 });
  }
  const body = String(payload.body ?? '');

  let publishedAt = payload.publishedAt;
  if (!publishedAt) {
    try {
      const existing = await readArticle(slug);
      publishedAt = existing.data.publishedAt;
    } catch {
      publishedAt = new Date().toISOString().slice(0, 10);
    }
  }

  const data = {
    title: String(payload.title),
    description: String(payload.description),
    cover: payload.cover || undefined,
    publishedAt: String(publishedAt).slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
    related: Array.isArray(payload.related) ? payload.related.map(String) : undefined,
    draft: Boolean(payload.draft),
  };
  await writeArticle(slug, data, body);
  return new Response(JSON.stringify({ ok: true, slug }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ params }) => {
  const slug = sanitizeSlug(params.slug as string);
  try {
    const entry = await readArticle(slug);
    return new Response(JSON.stringify({ ...entry.data, _body: entry.body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
