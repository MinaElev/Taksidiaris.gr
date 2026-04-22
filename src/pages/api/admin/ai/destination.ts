export const prerender = false;

import type { APIRoute } from 'astro';
import { callClaude, extractJson } from '@lib/ai-client';
import { buildDestinationPrompt } from '@lib/ai-prompts';
import type { Region } from '@lib/content-io';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const region = body?.region as Region;
  const name = String(body?.name || '').trim();
  if (!['ellada', 'europi', 'kosmos'].includes(region) || !name) {
    return new Response('region and name required', { status: 400 });
  }
  try {
    const { text } = await callClaude(buildDestinationPrompt(name, region));
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(`AI error: ${err?.message || err}`, { status: 500 });
  }
};
