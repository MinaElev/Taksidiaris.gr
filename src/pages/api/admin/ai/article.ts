export const prerender = false;

import type { APIRoute } from 'astro';
import { callClaude, extractJson } from '@lib/ai-client';
import { buildArticlePrompt } from '@lib/ai-prompts';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const topic = String(body?.topic || '').trim();
  const extra = String(body?.extra || '').trim() || undefined;
  if (!topic) {
    return new Response('topic is required', { status: 400 });
  }
  try {
    const { text } = await callClaude(buildArticlePrompt(topic, extra));
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(`AI error: ${err?.message || err}`, { status: 500 });
  }
};
