export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaudeWithWebSearch, extractJson } from '@lib/ai-client';
import { buildDestinationPrompt } from '@lib/ai-prompts';
import { listHotels, listTours, type Region } from '@lib/content-io';
import { recordUsage } from '@lib/ai-usage';

// SSE response — emits:
//   event: token       data: "<chunk>"
//   event: status      data: "<message>"
//   event: done        data: { ...destinationData, _heroCandidates: [...] }
//   event: error       data: { message: "..." }
//
// Used by /admin/destinations/[region]/[slug]. We pull our own hotels/tours
// for the destination and feed them into the prompt so Claude name-drops
// real entries from our DB (TourLayout's fuzzy matcher then turns those
// mentions into hyperlinks). Anthropic's web_search runs server-side so
// the body, bestTime, highlights etc. are grounded in current sources
// instead of training-cutoff guesses.
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

  // Pull our own hotels + tours that live in this destination so the
  // generated body cross-links to them. Best-effort — failures here
  // shouldn't block content generation.
  let ourHotels: { name: string; slug: string; city?: string; stars?: number }[] = [];
  let ourTours: { title: string; slug: string; nights?: number }[] = [];
  try {
    const allHotels = await listHotels();
    ourHotels = allHotels
      .filter((h) => h.data.region === region && fuzzyMatchDestination(h.data.destination, name))
      .map((h) => ({
        name: h.data.name,
        slug: h.slug,
        city: h.data.city,
        stars: h.data.stars,
      }));
  } catch (err) {
    console.warn('[ai/destination] listHotels failed:', err);
  }
  try {
    const allTours = await listTours();
    ourTours = allTours
      .filter((t) => fuzzyMatchDestination(t.data.destination, name))
      .map((t) => ({
        title: t.data.title,
        slug: t.slug,
        nights: t.data.duration?.nights,
      }));
  } catch (err) {
    console.warn('[ai/destination] listTours failed:', err);
  }

  const prompt = buildDestinationPrompt({ name, region, ourHotels, ourTours });
  const startedAt = Date.now();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          send('status', `Συγκεντρώθηκαν ${ourHotels.length} ξενοδοχεία και ${ourTours.length} εκδρομές της βάσης για cross-linking.`);

          // Phase 1 — Claude with web_search drafts the JSON.
          const { text, usage, webSearches } = await streamClaudeWithWebSearch(
            prompt,
            (delta) => send('token', delta),
            { maxSearches: 6 },
          );

          let parsed: any;
          try {
            parsed = extractJson(text);
          } catch (parseErr: any) {
            send('error', { message: parseErr?.message || 'JSON parse failed', raw: text });
            recordUsage({
              kind: 'destination', caller: 'admin', usage,
              meta: { name, region, ok: false, error: 'parse', webSearches, ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }

          // Phase 2 — if the model surfaced an officialTourismSite (e.g.
          // visitparis.com, discovergreece.com), scrape it for hero/gallery
          // image candidates so the editor doesn't have to hunt for one.
          const officialSite = String(parsed?.officialTourismSite || '').trim();
          let heroCandidates: string[] = [];
          if (officialSite && /^https?:\/\//.test(officialSite)) {
            send('status', `Συλλογή εικόνων από ${officialSite}`);
            heroCandidates = await extractImagesFromUrl(officialSite);
          }
          parsed._heroCandidates = heroCandidates;
          parsed._dbContext = { hotels: ourHotels.length, tours: ourTours.length };

          send('done', parsed);
          recordUsage({
            kind: 'destination', caller: 'admin', usage,
            meta: {
              name,
              region,
              webSearches,
              heroCandidates: heroCandidates.length,
              ourHotels: ourHotels.length,
              ourTours: ourTours.length,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Loose match: lowercase + strip Greek accents on both sides, then check
 * substring either way. Mirrors how TourLayout fuzzy-links destinations,
 * so what cross-links on the public site also gets pulled in here.
 */
function fuzzyMatchDestination(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const A = norm(a);
  const B = norm(b);
  return A === B || A.includes(B) || B.includes(A);
}

/**
 * Same image extractor as in the hotel SSE endpoint. Walks <img>, srcset,
 * <source>, og:image, and inline CSS background-image — then filters out
 * logos/icons/sprites/thumbnails. Capped at 30.
 */
async function extractImagesFromUrl(url: string): Promise<string[]> {
  let html: string;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TaksidiariBot/1.0; +https://taksidiaris.gr)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    html = await r.text();
  } catch {
    return [];
  }

  const out = new Set<string>();
  const base = new URL(url);

  const push = (raw: string) => {
    if (!raw) return;
    let u = raw.trim();
    u = u.split(/\s+/)[0];
    if (!u || u.startsWith('data:')) return;
    try {
      const abs = new URL(u, base).toString();
      if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs)) return;
      if (/(^|[\/_-])(logo|icon|favicon|sprite|placeholder|loader|spinner|thumb-|thumbnail-)/i.test(abs)) return;
      if (/[_-](\d{2,3})x\1[-_.]/.test(abs)) return;
      out.add(abs);
    } catch {
      // bad URL — skip
    }
  };

  const imgRe = /<img\b[^>]*?\b(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) push(m[1]);

  const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(',')) push(part.trim());
  }

  const sourceRe = /<source\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = sourceRe.exec(html))) {
    for (const part of m[1].split(',')) push(part.trim());
  }

  const ogRe = /<meta\b[^>]*?\bproperty\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\bcontent\s*=\s*["']([^"']+)["']/gi;
  while ((m = ogRe.exec(html))) push(m[1]);

  const bgRe = /background(?:-image)?\s*:\s*url\(["']?([^)"']+)["']?\)/gi;
  while ((m = bgRe.exec(html))) push(m[1]);

  return Array.from(out).slice(0, 30);
}
