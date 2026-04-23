export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaudeWithWebSearch, extractJson } from '@lib/ai-client';
import { buildPeriodPrompt } from '@lib/ai-prompts';
import { listDestinations } from '@lib/content-io';
import { recordUsage } from '@lib/ai-usage';

// SSE response — emits:
//   event: token       data: "<chunk>"
//   event: status      data: "<message>"
//   event: done        data: { ...periodData, _dbContext }
//   event: error       data: { message: "..." }
//
// Used by /admin/periods/[slug]. We pass our existing destinations list to
// the prompt so popularDestinations[] only references real entries — that
// way the public PeriodLayout can hyperlink them automatically. Web_search
// is used to confirm movable-feast dates (Πάσχα, Αγ. Πνεύματος) for the
// current/next year and to surface trending destinations / current events.
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const name = String(body?.name || '').trim();
  const dates = String(body?.dates || '').trim();
  if (!name) {
    return new Response('name is required', { status: 400 });
  }

  // Pull destinations so popularDestinations[] resolves to real pages.
  let ourDestinations: { title: string; slug: string; region: 'ellada' | 'europi' | 'kosmos' }[] = [];
  try {
    const all = await listDestinations();
    ourDestinations = all
      .filter((d) => !d.data.draft)
      .map((d) => ({ title: String(d.data.title), slug: d.slug, region: d.region }));
  } catch (err) {
    console.warn('[ai/period] listDestinations failed:', err);
  }

  const prompt = buildPeriodPrompt({ name, dates, ourDestinations });
  const startedAt = Date.now();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          send('status', `${ourDestinations.length} προορισμοί της βάσης διαθέσιμοι για cross-linking.`);

          const { text, usage, webSearches } = await streamClaudeWithWebSearch(
            prompt,
            (delta) => send('token', delta),
            { maxSearches: 4 },
          );

          let parsed: any;
          try {
            parsed = extractJson(text);
          } catch (parseErr: any) {
            send('error', { message: parseErr?.message || 'JSON parse failed', raw: text });
            recordUsage({
              kind: 'period', caller: 'admin', usage,
              meta: { name, ok: false, error: 'parse', webSearches, ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }

          parsed._dbContext = { destinations: ourDestinations.length };

          send('done', parsed);
          recordUsage({
            kind: 'period', caller: 'admin', usage,
            meta: {
              name,
              webSearches,
              ourDestinations: ourDestinations.length,
              popularDestinationsCount: Array.isArray(parsed?.popularDestinations) ? parsed.popularDestinations.length : 0,
              ok: true,
              ms: Date.now() - startedAt,
            },
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
