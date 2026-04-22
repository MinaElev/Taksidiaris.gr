export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaude } from '@lib/ai-client';
import { buildRewritePrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';

// SSE — same protocol as /api/admin/ai/tour but the model returns plain text
// (no JSON wrapper), so the client just concatenates `token` events and pastes
// the result back into the textarea. The `done` event fires with no payload,
// purely as the "stream complete" signal.
//
// Used by the "✨ Βελτίωση με AI" buttons in the admin and agency edit pages.
export const POST: APIRoute = async ({ request, locals }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const text = String(body?.text || '').trim();
  const kind = String(body?.kind || 'free') as
    'intro' | 'description' | 'body' | 'section' | 'faq' | 'free';
  const instruction = body?.instruction ? String(body.instruction).trim() : undefined;
  const context = body?.context ? String(body.context).trim() : undefined;

  if (!text) return new Response('text is required', { status: 400 });
  if (text.length > 30_000) return new Response('text too long (max 30k chars)', { status: 400 });
  if (!['intro', 'description', 'body', 'section', 'faq', 'free'].includes(kind)) {
    return new Response('invalid kind', { status: 400 });
  }

  // Agencies can rewrite their own content via the same endpoint. Detect by
  // session presence so we can attribute the spend correctly.
  const agency = (locals as any).agency;
  const caller: 'admin' | 'agency' = agency ? 'agency' : 'admin';
  const agencyId = agency?.agencyId ?? null;

  const prompt = buildRewritePrompt({ text, kind, instruction, context });
  const startedAt = Date.now();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          const { text: out, usage } = await streamClaude(
            prompt,
            (delta) => send('token', delta),
          );
          // Strip any accidental code fences the model might wrap around the
          // response (despite the instruction). Cheap belt-and-braces.
          const cleaned = out
            .replace(/^```[a-z]*\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          send('done', { text: cleaned });
          recordUsage({
            kind: 'rewrite', caller, agencyId, usage,
            meta: { kind, len: text.length, ok: true, ms: Date.now() - startedAt },
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
