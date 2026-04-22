export const prerender = false;

import type { APIRoute } from 'astro';
import { callClaude, extractJson } from '@lib/ai-client';
import { buildTourPrompt } from '@lib/ai-prompts';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const destination = String(body?.destination || '').trim();
  const region = body?.region as 'ellada' | 'europi' | 'kosmos';
  if (!destination) return new Response('destination is required', { status: 400 });
  if (!['ellada', 'europi', 'kosmos'].includes(region)) {
    return new Response('region must be ellada, europi, or kosmos', { status: 400 });
  }

  const days = Number(body?.duration?.days);
  const nights = Number(body?.duration?.nights);
  if (!Number.isFinite(days) || !Number.isFinite(nights) || days < 1 || nights < 0) {
    return new Response('duration.days and duration.nights must be valid numbers', { status: 400 });
  }

  const prompt = buildTourPrompt({
    destination,
    region,
    duration: { days, nights },
    departureCities: Array.isArray(body?.departureCities) ? body.departureCities : undefined,
    dates: body?.dates ? String(body.dates) : undefined,
    priceFrom: body?.priceFrom ? Number(body.priceFrom) : undefined,
    transport: body?.transport ? String(body.transport) : undefined,
    extraInstructions: body?.extraInstructions ? String(body.extraInstructions) : undefined,
  });

  try {
    const { text } = await callClaude(prompt);
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(`AI error: ${err?.message || err}`, { status: 500 });
  }
};
