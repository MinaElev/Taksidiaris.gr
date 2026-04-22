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
  // Strip scripts/styles to reduce noise + token usage
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');
  try {
    const { text } = await callClaude(buildScrapePrompt(url, cleaned), { maxTokens: 7500 });
    const data = extractJson(text);
    return new Response(JSON.stringify({ ...data, sourceUrl: url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(`AI error: ${err?.message || err}`, { status: 500 });
  }
};
