export const prerender = false;

import type { APIRoute } from 'astro';
import { streamClaudeWithWebSearch, extractJson } from '@lib/ai-client';
import { buildHotelPrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';

// SSE response — emits:
//   event: token       data: "<chunk>"
//   event: status      data: "scraping <url>"   (UI progress between AI done + image extraction)
//   event: done        data: { ...hotelData, _imageCandidates: [...] }
//   event: error       data: { message: "..." }
//
// Used by /admin/hotels/new (with optional ?name= prefill from the orphan
// detector on /admin/hotels) to draft a hotel entry from real web sources.
// Anthropic's web_search tool runs server-side so Claude grounds its output
// in current data instead of hallucinating from training knowledge.
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
          // Phase 1 — Claude with web_search runs the research + drafts JSON.
          const { text, usage, webSearches } = await streamClaudeWithWebSearch(
            prompt,
            (delta) => send('token', delta),
            { maxSearches: 5 },
          );

          let parsed: any;
          try {
            parsed = extractJson(text);
          } catch (parseErr: any) {
            send('error', { message: parseErr?.message || 'JSON parse failed', raw: text });
            recordUsage({
              kind: 'hotel', caller: 'admin', usage,
              meta: { name, ok: false, error: 'parse', webSearches, ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }

          // Phase 2 — if Claude found an official website, fetch it and pull
          // <img> URLs as candidate hero/gallery photos. We don't trust the
          // model to remember image URLs from search snippets; better to
          // scrape the actual site.
          const officialWebsite = String(parsed?.officialWebsite || '').trim();
          let imageCandidates: string[] = [];
          if (officialWebsite && /^https?:\/\//.test(officialWebsite)) {
            send('status', `Συλλογή εικόνων από ${officialWebsite}`);
            imageCandidates = await extractImagesFromUrl(officialWebsite);
          }

          // Also try sources[] — sometimes Booking.com/TripAdvisor pages have
          // better-curated galleries than the hotel's own homepage.
          const sources = Array.isArray(parsed?.sources) ? parsed.sources.slice(0, 3) : [];
          for (const src of sources) {
            if (typeof src !== 'string' || !/^https?:\/\//.test(src)) continue;
            if (src === officialWebsite) continue;
            const more = await extractImagesFromUrl(src);
            imageCandidates.push(...more);
          }

          // Dedupe + cap
          imageCandidates = Array.from(new Set(imageCandidates)).slice(0, 30);
          parsed._imageCandidates = imageCandidates;

          send('done', parsed);
          recordUsage({
            kind: 'hotel', caller: 'admin', usage,
            meta: {
              name,
              webSearches,
              imagesFound: imageCandidates.length,
              hasWebsite: Boolean(officialWebsite),
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
// Image extraction from a hotel page. Strips noise, walks <img>/<source>/
// srcset/og:image/lazy-load attributes, resolves to absolute URLs, then
// filters out logos/icons/thumbnails most sites embed in headers/footers.
// ---------------------------------------------------------------------------
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
    // Strip srcset width descriptor if pasted in by accident.
    u = u.split(/\s+/)[0];
    if (!u || u.startsWith('data:')) return;
    try {
      const abs = new URL(u, base).toString();
      // Filter: must look like a photo, not an icon/logo/sprite.
      if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs)) return;
      if (/(^|[\/_-])(logo|icon|favicon|sprite|placeholder|loader|spinner|thumb-|thumbnail-)/i.test(abs)) return;
      // Skip very small thumbnails — common sizes: 16, 32, 48, 64, 100, 150
      if (/[_-](\d{2,3})x\1[-_.]/.test(abs)) return;
      out.add(abs);
    } catch {
      // bad URL — skip
    }
  };

  // <img src="..." />, <img data-src="..." />, <img data-original="..." />
  const imgRe = /<img\b[^>]*?\b(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) push(m[1]);

  // srcset (multi-resolution)
  const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(',')) push(part.trim());
  }

  // <source srcset="..." />
  const sourceRe = /<source\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = sourceRe.exec(html))) {
    for (const part of m[1].split(',')) push(part.trim());
  }

  // og:image / twitter:image
  const ogRe = /<meta\b[^>]*?\bproperty\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\bcontent\s*=\s*["']([^"']+)["']/gi;
  while ((m = ogRe.exec(html))) push(m[1]);

  // CSS background-image (inline style)
  const bgRe = /background(?:-image)?\s*:\s*url\(["']?([^)"']+)["']?\)/gi;
  while ((m = bgRe.exec(html))) push(m[1]);

  return Array.from(out).slice(0, 30);
}
