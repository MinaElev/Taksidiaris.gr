export const prerender = false;

import type { APIRoute } from 'astro';
import { callClaude, extractJson } from '@lib/ai-client';
import { buildScrapePrompt } from '@lib/ai-prompts';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const url = String(body?.url || '').trim();
  if (!url || !/^https?:\/\//.test(url)) {
    return new Response('valid URL required', { status: 400 });
  }
  let html: string;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TaksidiariBot/1.0; +https://taksidiaris.gr)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    if (!r.ok) {
      return new Response(`Fetch failed: HTTP ${r.status}`, { status: 502 });
    }
    html = await r.text();
  } catch (err: any) {
    return new Response(`Fetch error: ${err?.message || err}`, { status: 502 });
  }
  // Extract JSON-LD blocks BEFORE stripping scripts — they often hold
  // structured tour data (dates, offers, schemas) the model would otherwise miss.
  const jsonLdBlocks: string[] = [];
  html.replace(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    (_, body) => {
      const trimmed = String(body || '').trim();
      if (trimmed) jsonLdBlocks.push(trimmed);
      return '';
    },
  );

  // Strip remaining scripts/styles/comments to reduce noise + token usage.
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');

  // Re-attach JSON-LD payloads at the end so the prompt can scan them for
  // dates/prices/offers without paying for the surrounding HTML noise.
  if (jsonLdBlocks.length) {
    cleaned += '\n\n<!-- JSON-LD STRUCTURED DATA -->\n' + jsonLdBlocks.join('\n---\n');
  }

  try {
    const { text } = await callClaude(buildScrapePrompt(url, cleaned), { maxTokens: 9000 });
    const data = extractJson(text);
    return new Response(JSON.stringify({ ...data, sourceUrl: url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(`AI error: ${err?.message || err}`, { status: 500 });
  }
};
