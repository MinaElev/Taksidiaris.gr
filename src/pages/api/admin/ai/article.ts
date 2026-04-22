export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaude, extractJson } from '@lib/ai-client';
import { buildArticlePrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';

// SSE — see /api/admin/ai/tour.ts for the protocol.
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

  const startedAt = Date.now();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          const { text, usage } = await streamClaude(
            buildArticlePrompt(topic, extra),
            (delta) => send('token', delta),
          );
          let parsed: any;
          try {
            parsed = extractJson(text);
          } catch (parseErr: any) {
            send('error', { message: parseErr?.message || 'JSON parse failed', raw: text });
            recordUsage({
              kind: 'article', caller: 'admin', usage,
              meta: { topic, ok: false, error: 'parse', ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }
          send('done', parsed);
          recordUsage({
            kind: 'article', caller: 'admin', usage,
            meta: { topic, ok: true, ms: Date.now() - startedAt },
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
