export const prerender = false;

import type { APIRoute } from 'astro';
import { callClaude, extractJson } from '@lib/ai-client';
import { buildRelatedToursPrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';
import { listToursAdmin } from '@lib/tours-db';

// Plain JSON endpoint (NOT SSE) — the related-suggestion call is short and
// the article-new page already showed a streaming preview for the article
// generation; this is a follow-up that just needs to return a list of slugs.
//
// POST { articleTitle, articleBody } → { related: string[], reason: string }
//
// Strategy: load all admin-visible tours (non-draft preferred but we include
// drafts so the agency can preview unpublished routes if relevant), pass them
// as candidates with their slug + title + destination + region. Model picks
// 2-3 best matches by topical relevance.
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const articleTitle = String(body?.articleTitle || '').trim();
  const articleBody = String(body?.articleBody || '').trim();
  if (!articleTitle) {
    return new Response(JSON.stringify({ error: 'articleTitle is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const startedAt = Date.now();
  let candidates: { slug: string; title: string; destination: string; region: string }[] = [];
  try {
    const all = await listToursAdmin();
    candidates = all
      .filter((t) => !t.data.draft) // only published candidates
      .map((t) => ({
        slug: t.slug,
        title: t.data.title,
        destination: t.data.destination,
        region: t.data.region,
      }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Failed to load tour catalogue: ' + (err?.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (candidates.length === 0) {
    return new Response(JSON.stringify({ related: [], reason: 'Δεν υπάρχουν διαθέσιμες εκδρομές για συσχέτιση.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = buildRelatedToursPrompt({ articleTitle, articleBody, candidates });

  try {
    const { text, usage } = await callClaude(prompt);
    let parsed: { related?: unknown; reason?: unknown };
    try {
      parsed = extractJson(text);
    } catch (parseErr: any) {
      recordUsage({
        kind: 'related', caller: 'admin', usage,
        meta: { articleTitle, ok: false, error: 'parse', ms: Date.now() - startedAt },
      });
      return new Response(JSON.stringify({ error: parseErr?.message || 'JSON parse failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate slugs against the candidate set so we never hand back garbage.
    const validSlugs = new Set(candidates.map((c) => c.slug));
    const related = Array.isArray(parsed.related)
      ? (parsed.related as unknown[])
        .map((s) => String(s))
        .filter((s) => validSlugs.has(s))
        .slice(0, 5)
      : [];
    const reason = typeof parsed.reason === 'string' ? parsed.reason : '';

    recordUsage({
      kind: 'related', caller: 'admin', usage,
      meta: { articleTitle, picked: related.length, ok: true, ms: Date.now() - startedAt },
    });

    return new Response(JSON.stringify({ related, reason }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
