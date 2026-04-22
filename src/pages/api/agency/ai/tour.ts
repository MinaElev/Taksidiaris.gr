export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaude, extractJson } from '@lib/ai-client';
import { buildTourPrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';

// Same SSE protocol as /api/admin/ai/tour, but:
//   • Gated on agency session (middleware enforces this — we still re-check).
//   • Usage is tagged with caller='agency' + the agency_id so the dashboard
//     and any future per-agency billing can attribute spend correctly.
//
// Costs come out of the platform's shared ANTHROPIC_API_KEY for now. If we
// ever want to charge agencies for AI usage, this is the chokepoint to add a
// quota check + per-agency rate limit.
export const POST: APIRoute = async ({ request, locals }) => {
  const session = (locals as any).agency;
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  const startedAt = Date.now();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          const { text, usage } = await streamClaude(prompt, (delta) => send('token', delta));
          let parsed: any;
          try {
            parsed = extractJson(text);
          } catch (parseErr: any) {
            send('error', { message: parseErr?.message || 'JSON parse failed', raw: text });
            recordUsage({
              kind: 'tour', caller: 'agency', agencyId: session.agencyId, usage,
              meta: { destination, ok: false, error: 'parse', ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }
          send('done', parsed);
          recordUsage({
            kind: 'tour', caller: 'agency', agencyId: session.agencyId, usage,
            meta: { destination, days, ok: true, ms: Date.now() - startedAt },
          });
        } catch (err: any) {
          send('error', { message: String(err?.message || err) });
        } finally {
          controller.close();
        }
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    },
  );
};
