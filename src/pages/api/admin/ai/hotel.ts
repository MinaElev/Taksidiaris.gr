export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaude, extractJson } from '@lib/ai-client';
import { buildHotelPrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';

// SSE response — emits:
//   event: token  data: "<chunk>"          (string, JSON-encoded)
//   event: done   data: { ...hotelData }   (parsed JSON object matching HotelFrontmatter)
//   event: error  data: { message: "..." }
//
// Used by /admin/hotels/new (with optional ?name=&destination= prefill from
// the orphan-detector panel on /admin/hotels) to draft a hotel entry from
// just a name + tour context.
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const name = String(body?.name || '').trim();
  if (!name) return new Response('name is required', { status: 400 });

  const region = body?.region as 'ellada' | 'europi' | 'kosmos' | undefined;
  if (region && !['ellada', 'europi', 'kosmos'].includes(region)) {
    return new Response('region must be ellada, europi, or kosmos', { status: 400 });
  }

  const contextTours = Array.isArray(body?.contextTours)
    ? body.contextTours
        .filter((t: any) => t && t.title && t.destination)
        .map((t: any) => ({
          title: String(t.title),
          destination: String(t.destination),
          nights: t.nights ? Number(t.nights) : undefined,
          board: t.board ? String(t.board) : undefined,
        }))
        .slice(0, 8)
    : [];

  const prompt = buildHotelPrompt({
    name,
    destination: body?.destination ? String(body.destination) : undefined,
    region,
    city: body?.city ? String(body.city) : undefined,
    stars: body?.stars ? Number(body.stars) : undefined,
    contextTours,
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
              kind: 'hotel', caller: 'admin', usage,
              meta: { name, ok: false, error: 'parse', ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }
          send('done', parsed);
          recordUsage({
            kind: 'hotel', caller: 'admin', usage,
            meta: { name, contextTourCount: contextTours.length, ok: true, ms: Date.now() - startedAt },
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
